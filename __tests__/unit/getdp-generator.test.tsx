/**
 * The Get DP page's controls (app/getdp/components/DPGenerator.tsx).
 *
 * jsdom has no canvas, so the drawing is mocked: these check what the page
 * asks drawDP to draw and what it lets a person do, not the pixels (the
 * pixels are app/getdp/lib/dp.ts's rules, tested on their own). The full
 * 2160 render is a double of lib/draw's renderFull (tested itself in
 * getdp-draw.test.ts) that goes through the same mocked drawDP and the
 * canvas's toBlob, so one render can be told from another.
 *
 * Each device is a user agent, a pointer, and navigator.share, canShare and
 * the clipboard stubbed to match (setDevice).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { footerTiers, shareText } from "@/app/getdp/lib/dp";
import { headline, partners, sponsors } from "@/lib/partners-2026";

type Opts = {
  role: string;
  name: string;
  photo: unknown;
  photoTransform?: { zoom: number; offsetX: number; offsetY: number };
};
type Ctx = { canvas?: { width: number } };

/** Every drawDP call: whether it was a full 2160 render (told at call time), and what it drew. */
const draws: { full: boolean; opts: Opts }[] = [];
let fullRunning = 0;
let fullMostAtOnce = 0;

const drawDP = vi.fn(async (ctx: Ctx, opts: Opts) => {
  draws.push({ full: ctx?.canvas?.width === 2160, opts });
  return { hub: { x: 1080, y: 760 }, photoR: 410, zone: { top: 1400, bottom: 1872 } };
});
const nameSubstitutions = vi.fn<(name: string) => Promise<{ letter: string; drawn: string | null }[]>>(
  async () => [],
);
/** lib/draw's renderFull, through the mocked drawDP and toBlob. */
const renderFull = vi.fn(async (opts: Opts, assets: unknown, type: string, quality?: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = 2160;
  canvas.height = 2160;
  fullRunning += 1;
  fullMostAtOnce = Math.max(fullMostAtOnce, fullRunning);
  try {
    await drawDP(canvas.getContext("2d") as unknown as Ctx, opts);
    void assets;
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No picture file"))), type, quality),
    );
  } finally {
    fullRunning -= 1;
    canvas.width = 0;
    canvas.height = 0;
  }
});
vi.mock("@/app/getdp/lib/draw", () => ({
  drawDP: (ctx: Ctx, opts: Opts) => drawDP(ctx, opts),
  nameSubstitutions: (name: string) => nameSubstitutions(name),
  renderFull: (opts: Opts, assets: unknown, type: string, quality?: number) => renderFull(opts, assets, type, quality),
}));

const readPhoto = vi.fn();
const loadAssets = vi.fn<(tiers: unknown) => Promise<unknown>>();
vi.mock("@/app/getdp/lib/load", async () => {
  class PhotoError extends Error {}
  return {
    PhotoError,
    loadAssets: (tiers: unknown) => loadAssets(tiers),
    readPhoto: (file: File) => readPhoto(file),
  };
});

vi.mock("server-only", () => ({}));

const { default: DPGenerator } = await import("@/app/getdp/components/DPGenerator");
const { PhotoError } = await import("@/app/getdp/lib/load");

const tiers = footerTiers({ headline, sponsors, partners });

/* ------------------------------------------------------------------ */
/* Devices                                                            */
/* ------------------------------------------------------------------ */

const UA = {
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A145F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.30.94 Android (34/14; 450dpi; 1080x2220; samsung; SM-A145F; a14; mt6769; en_GB; 640000000)",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 350.0.0.30.94 (iPhone15,3; iOS 18_5; en_GB; en; scale=3.00; 1290x2796; 640000000)",
};

const share = vi.fn<(data: ShareData) => Promise<void>>();
const canShare = vi.fn<(data?: ShareData) => boolean>();
const writeText = vi.fn<(text: string) => Promise<void>>();
const createObjectURL = vi.fn<(b: Blob) => string>();
const revokeObjectURL = vi.fn<(u: string) => void>();
const scrollTo = vi.fn();
const anchorClick = vi.fn();

function define(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
}

/**
 * A device: its user agent, whether its pointer is coarse (a phone), whether
 * its share list takes files (and text beside them), and whether the screen
 * is as wide as the desktop layout.
 */
function setDevice({
  ua = UA.desktop,
  coarse = false,
  files = false,
  text = true,
  wide = false,
}: { ua?: string; coarse?: boolean; files?: boolean; text?: boolean; wide?: boolean } = {}) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("pointer: coarse")
      ? coarse
      : q.includes("pointer: fine")
        ? !coarse
        : q.includes("min-width: 1024px")
          ? wide
          : false,
  }));
  canShare.mockImplementation((data) => files && (text || !data || !("text" in data)));
  define(navigator, "share", share);
  define(navigator, "canShare", canShare);
  define(navigator, "clipboard", { writeText });
}

beforeEach(() => {
  draws.length = 0;
  fullRunning = 0;
  fullMostAtOnce = 0;
  drawDP.mockClear();
  renderFull.mockClear();
  nameSubstitutions.mockReset();
  nameSubstitutions.mockResolvedValue([]);
  loadAssets.mockReset();
  loadAssets.mockImplementation(async (tiers) => ({ logo: {}, tiers, logos: {} }));
  readPhoto.mockReset();
  readPhoto.mockResolvedValue({ photo: { width: 900, height: 1600 }, width: 900, height: 1600 });
  share.mockReset();
  share.mockResolvedValue(undefined);
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  let urls = 0;
  createObjectURL.mockReset();
  createObjectURL.mockImplementation(() => `blob:dp-${++urls}`);
  revokeObjectURL.mockReset();
  scrollTo.mockReset();
  anchorClick.mockReset();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  vi.stubGlobal("scrollTo", scrollTo);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick);
  // jsdom has no 2D context; the mocked drawDP only reads which canvas it was given.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return { canvas: this } as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement["getContext"]);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb: BlobCallback, type?: string) {
    cb(new Blob(["dp"], { type: type ?? "image/png" }));
  });
  setDevice();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const key of ["share", "canShare", "clipboard"]) Reflect.deleteProperty(navigator, key);
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** The options of the most recent preview draw (not a full render). */
const lastDrawn = () => draws.filter((d) => !d.full).at(-1)!.opts;
/** The full 2160 renders, in order. */
const fullDraws = () => draws.filter((d) => d.full).map((d) => d.opts);

const nameInput = () => screen.getByLabelText("Your name") as HTMLInputElement;
const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
const download = () => button(/Download PNG/);
/** The polite status line under the buttons, and the whole line it sits in. */
const live = () => document.getElementById("dp-status") as HTMLElement;
const statusLine = () => live().parentElement as HTMLElement;
const frame = () => screen.getByRole("group", { name: /arrow keys/ }) as HTMLDivElement;
const handle = () => frame().querySelector(".touch-none") as HTMLDivElement;

/** A promise settled from outside, for photos that open slowly. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Real time passing, with React's updates flushed. */
const settle = (ms = 0) => act(async () => new Promise((r) => setTimeout(r, ms)));

async function addPhoto(name = "selfie.jpg") {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(["x"], name, { type: "image/jpeg" })] } });
  });
}

/** The page, once its first preview is drawn (a test may mount more than one, one after another). */
async function mount() {
  const before = drawDP.mock.calls.length;
  render(<DPGenerator tiers={tiers} />);
  await waitFor(() => expect(drawDP.mock.calls.length).toBeGreaterThan(before));
}

/** Name, photo, and the full picture drawn ahead (the 300ms after the last change, then the render). */
async function readyToShare(primary: string) {
  await mount();
  fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
  await addPhoto();
  await waitFor(() => expect(button(primary).disabled).toBe(false));
  await settle(400);
}

/* ------------------------------------------------------------------ */

describe("the Get DP generator", () => {
  it("starts on attending, draws the empty frame, and switches role on a tap", async () => {
    await mount();
    expect(screen.getByRole("button", { name: "Attending" }).getAttribute("aria-pressed")).toBe("true");
    expect(lastDrawn()).toMatchObject({ role: "attendee", name: "Your name", photo: null });

    fireEvent.click(screen.getByRole("button", { name: "Speaking" }));
    expect(screen.getByRole("button", { name: "Speaking" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Attending" }).getAttribute("aria-pressed")).toBe("false");
    await waitFor(() => expect(lastDrawn().role).toBe("speaker"));
    expect(screen.getByRole("img", { name: /I'M SPEAKING/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Partner" }));
    await waitFor(() => expect(lastDrawn().role).toBe("partner"));
  });

  it("starts on the role a link asks for, such as /getdp?role=speaker from the speakers page", async () => {
    window.history.replaceState({}, "", "/getdp?role=speaker");
    try {
      await mount();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Speaking" }).getAttribute("aria-pressed")).toBe("true"),
      );
      await waitFor(() => expect(lastDrawn().role).toBe("speaker"));
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });

  it("ignores a role a link gets wrong, and starts on attending", async () => {
    window.history.replaceState({}, "", "/getdp?role=organiser");
    try {
      await mount();
      expect(screen.getByRole("button", { name: "Attending" }).getAttribute("aria-pressed")).toBe("true");
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });

  it("says what is wrong with a name, in place", async () => {
    await mount();
    const input = nameInput();

    // Nothing shouts while the first letter goes in.
    fireEvent.change(input, { target: { value: "A" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toContain("Your name needs at least 2 letters.");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("alert").textContent).toContain("Enter your name as you want it on the picture.");

    fireEvent.change(input, { target: { value: "Ada 🎉" } });
    expect(screen.getByRole("alert").textContent).toMatch(/cannot draw 🎉/);

    // The alert keeps the same words as the name grows, so a screen reader
    // does not read it out again at every key; the count is said beside it.
    fireEvent.change(input, { target: { value: "A".repeat(51) } });
    expect(screen.getByRole("alert").textContent).toBe("Keep it to 50 letters or fewer.");
    expect(screen.getByText("That is 51 letters.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "A".repeat(52) } });
    expect(screen.getByRole("alert").textContent).toBe("Keep it to 50 letters or fewer.");
    expect(screen.getByText("That is 52 letters.")).toBeTruthy();

    fireEvent.change(input, { target: { value: "A".repeat(45) } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("5 letters left.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "A".repeat(49) } });
    expect(screen.getByText("1 letter left.")).toBeTruthy();

    fireEvent.change(input, { target: { value: "Ọláolúwa Adéṣínà" } });
    expect(screen.queryByRole("alert")).toBeNull();
    await waitFor(() => expect(lastDrawn().name).toBe("Ọláolúwa Adéṣínà"));
  });

  it("keeps saving and the platform marks shut until there is a photo and a good name", async () => {
    await mount();
    const marks = () => screen.getAllByRole("link", { name: /^(Post|Send) on / });
    expect(download().disabled).toBe(true);
    expect(marks()).toHaveLength(5);
    for (const m of marks()) expect(m.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Add your name and a photo to get your DP.")).toBeTruthy();

    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    expect(download().disabled).toBe(true);
    expect(screen.getByText("Add a photo to get your DP.")).toBeTruthy();

    await addPhoto();
    await waitFor(() => expect(download().disabled).toBe(false));
    for (const m of marks()) expect(m.getAttribute("aria-disabled")).toBe("false");
    expect(statusLine().textContent).toBe("Ready to download: blockfest-2026-dp-ada-obi.png");
    expect(screen.getByText("For your profile picture, upload the PNG in your profile settings.")).toBeTruthy();

    fireEvent.change(nameInput(), { target: { value: "A" } });
    expect(download().disabled).toBe(true);
    expect(live().textContent).toBe("Fix your name to get your DP.");
  });

  it("announces the state, not the file name, while a name is typed", async () => {
    await mount();
    await addPhoto();
    fireEvent.change(nameInput(), { target: { value: "Ada" } });
    await waitFor(() => expect(download().disabled).toBe(false));
    expect(live().textContent).toBe("Ready to download");
    expect(live().getAttribute("aria-live")).toBe("polite");
    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    expect(live().textContent).toBe("Ready to download");
    expect(live().textContent).not.toContain(".png");
    // The file name is shown beside it, and a long one wraps instead of being cut off.
    expect(statusLine().textContent).toContain("blockfest-2026-dp-ada-obi.png");
    expect(statusLine().className).toContain("[overflow-wrap:anywhere]");
  });

  it("never says Ready while the picture is still being prepared, or could not be", async () => {
    loadAssets.mockImplementation(() => new Promise(() => undefined));
    render(<DPGenerator tiers={tiers} />);
    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    await addPhoto();
    expect(download().disabled).toBe(true);
    expect(live().textContent).toBe("Preparing your DP…");
    cleanup();

    loadAssets.mockRejectedValue(new Error("offline"));
    render(<DPGenerator tiers={tiers} />);
    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    await addPhoto();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The picture could not be prepared. Check your connection and try again.",
    );
    expect(download().disabled).toBe(true);
    expect(live().textContent).toBe("Tap Try again to finish your DP.");
  });

  it("tries again without losing the name or the photo", async () => {
    loadAssets.mockRejectedValueOnce(new Error("offline"));
    render(<DPGenerator tiers={tiers} />);
    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    const picked = { width: 900, height: 1600 };
    readPhoto.mockResolvedValue({ photo: picked, ...picked });
    await addPhoto();
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be prepared/);
    expect(loadAssets).toHaveBeenCalledTimes(1);

    fireEvent.click(button("Try again"));
    await waitFor(() => expect(loadAssets).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(download().disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(nameInput().value).toBe("Ada Obi");
    await waitFor(() => expect(draws.some((d) => !d.full)).toBe(true));
    expect(lastDrawn().photo).toBe(picked);
    expect(lastDrawn().name).toBe("Ada Obi");

    // Lettering that would not load: Try again draws again, keeping everything.
    drawDP.mockRejectedValueOnce(new Error("DP fonts timed out"));
    fireEvent.click(screen.getByRole("button", { name: "Speaking" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The picture's lettering did not load. Check your connection and try again.",
    );
    const before = drawDP.mock.calls.length;
    fireEvent.click(button("Try again"));
    await waitFor(() => expect(drawDP.mock.calls.length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(lastDrawn()).toMatchObject({ role: "speaker", name: "Ada Obi", photo: picked });
  });

  it("holds the download back for a letter the lettering cannot draw, and waits for the check", async () => {
    const check = deferred<{ letter: string; drawn: string | null }[]>();
    nameSubstitutions.mockReturnValue(check.promise);
    await mount();
    await addPhoto();
    fireEvent.change(nameInput(), { target: { value: "Aƣba Obi" } });
    // Until the check says what the face can draw, nothing can be saved.
    await waitFor(() => expect(nameSubstitutions).toHaveBeenCalledWith("Aƣba Obi"));
    expect(download().disabled).toBe(true);
    await act(async () => check.resolve([{ letter: "Ƣ", drawn: null }]));
    expect((await screen.findByRole("alert")).textContent).toMatch(/cannot draw Ƣ/);
    expect(download().disabled).toBe(true);
    expect(live().textContent).toBe("Fix your name to get your DP.");

    // A stand-in letter is only noted, and saving opens.
    nameSubstitutions.mockResolvedValue([{ letter: "Ɖ", drawn: "D" }]);
    fireEvent.change(nameInput(), { target: { value: "Ɖossou" } });
    expect(await screen.findByText(/has no Ɖ, so it draws D/)).toBeTruthy();
    await waitFor(() => expect(download().disabled).toBe(false));
  });

  it("keeps saving shut when the letter check could not run, and runs it again on Try again", async () => {
    // The faces timed out on a slow connection: the check never answered.
    const again = deferred<{ letter: string; drawn: string | null }[]>();
    nameSubstitutions.mockRejectedValueOnce(new Error("DP fonts timed out"));
    nameSubstitutions.mockReturnValueOnce(again.promise);
    await mount();
    fireEvent.change(nameInput(), { target: { value: "Aƣba Obi" } });
    await waitFor(() => expect(nameSubstitutions).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The picture's lettering did not load. Check your connection and try again.",
    );
    // A photo added later draws fine, and still opens nothing.
    await addPhoto();
    await settle(40);
    expect(download().disabled).toBe(true);
    expect(live().textContent).toBe("Tap Try again to finish your DP.");
    expect(button("Try again")).toBeTruthy();

    fireEvent.click(button("Try again"));
    await waitFor(() => expect(nameSubstitutions).toHaveBeenCalledTimes(2));
    // While it runs again: waiting on it, not failed.
    expect(live().textContent).toBe("Preparing your DP…");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(download().disabled).toBe(true);
    await act(async () => again.resolve([{ letter: "Ƣ", drawn: null }]));
    expect((await screen.findByRole("alert")).textContent).toMatch(/cannot draw Ƣ/);
    expect(download().disabled).toBe(true);
    expect(live().textContent).toBe("Fix your name to get your DP.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    cleanup();

    // A name with a stand-in letter: its note comes back, and saving opens.
    nameSubstitutions.mockReset();
    nameSubstitutions.mockRejectedValueOnce(new Error("DP fonts timed out"));
    nameSubstitutions.mockResolvedValue([{ letter: "Ɖ", drawn: "D" }]);
    await mount();
    fireEvent.change(nameInput(), { target: { value: "Ɖossou" } });
    await addPhoto();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(download().disabled).toBe(true);
    fireEvent.click(button("Try again"));
    expect(await screen.findByText(/has no Ɖ, so it draws D/)).toBeTruthy();
    await waitFor(() => expect(download().disabled).toBe(false));
  });

  it("says, on every visit, that the photo stays on the device", async () => {
    await mount();
    expect(screen.getByText("Your photo is processed on this device and never uploaded.")).toBeTruthy();
  });

  it("offers moving, zooming and resetting the photo once there is one", async () => {
    await mount();
    expect(screen.queryByLabelText("Zoom")).toBeNull();
    expect(screen.queryByRole("button", { name: /Reset/ })).toBeNull();

    await addPhoto();
    const zoom = await screen.findByLabelText("Zoom");
    // A 9:16 photo starts cropped about a point 39% down.
    await waitFor(() => expect(lastDrawn().photoTransform).toBeDefined());
    const start = lastDrawn().photoTransform!;
    expect(start.zoom).toBe(1);
    expect(start.offsetY).toBeGreaterThan(0);

    fireEvent.change(zoom, { target: { value: "2" } });
    await waitFor(() => expect(lastDrawn().photoTransform?.zoom).toBe(2));

    expect(frame().getAttribute("tabindex")).toBe("0");
    const before = lastDrawn().photoTransform!.offsetX;
    fireEvent.keyDown(frame(), { key: "ArrowRight" });
    await waitFor(() => expect(lastDrawn().photoTransform!.offsetX).toBeCloseTo(before + 0.02, 10));

    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    await waitFor(() => expect(lastDrawn().photoTransform).toEqual(start));

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByLabelText("Zoom")).toBeNull();
    await waitFor(() => expect(lastDrawn().photo).toBeNull());
  });

  it("keeps focus with the photo step as its button changes, and says what happened", async () => {
    await mount();
    await addPhoto();
    const change = await screen.findByRole("button", { name: "Change photo" });
    expect(document.activeElement).toBe(change);
    const status = document.getElementById(change.getAttribute("aria-describedby")!);
    expect(status?.textContent).toBe("Photo added.");

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: /Choose a photo/ })),
    );
  });

  it("rings the photo frame inside its edge, where the card cannot clip it", async () => {
    await mount();
    await addPhoto();
    expect(frame().className).toContain("focus-visible:-outline-offset-2");
    expect(frame().className).toContain("focus-visible:outline-brand-blue-light");
  });

  it("tells a square photo to zoom before it can move", async () => {
    readPhoto.mockResolvedValue({ photo: { width: 1200, height: 1200 }, width: 1200, height: 1200 });
    await mount();
    await addPhoto();
    expect(await screen.findByText(/Your photo fills its frame\. Zoom in to move it\./)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: "1.5" } });
    expect(await screen.findByText(/Drag your photo to move it in its frame\./)).toBeTruthy();
  });

  it("shows a slow change of photo opening, and keeps the newest of two quick picks", async () => {
    await mount();
    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    await addPhoto();
    await waitFor(() => expect(download().disabled).toBe(false));

    const slow = deferred<unknown>();
    const quick = deferred<unknown>();
    readPhoto.mockReturnValueOnce(slow.promise).mockReturnValueOnce(quick.promise);
    await addPhoto("big.jpg");
    expect(screen.getByText("Opening your new photo…")).toBeTruthy();
    expect(download().disabled).toBe(true);

    await addPhoto("small.jpg");
    const newest = { width: 800, height: 1000 };
    await act(async () => quick.resolve({ photo: newest, ...newest }));
    await waitFor(() => expect(lastDrawn().photo).toBe(newest));
    // The first pick finishing late does not replace the newer one.
    const stale = { width: 640, height: 640 };
    await act(async () => {
      slow.resolve({ photo: stale, ...stale });
      await new Promise((r) => setTimeout(r, 80)); // past the next preview frame
    });
    expect(lastDrawn().photo).toBe(newest);
    // A portrait photo, so it moves up and down; the square one would not.
    expect(screen.getByText(/Drag your photo up or down/)).toBeTruthy();
    expect(screen.getByText("Photo added.")).toBeTruthy();
    expect(download().disabled).toBe(false);
  });

  it("shows the reason a photo would not open", async () => {
    readPhoto.mockRejectedValueOnce(
      new PhotoError("This browser cannot open HEIC photos. Open this page in Safari, or save the photo as a JPEG and choose that."),
    );
    await mount();
    await addPhoto("IMG_0001.HEIC");
    expect((await screen.findByRole("alert")).textContent).toMatch(/cannot open HEIC photos/);
    expect(screen.queryByLabelText("Zoom")).toBeNull();
  });

  it("clears the file input after each pick, so the same photo can be chosen again", async () => {
    const setValue = vi.spyOn(HTMLInputElement.prototype, "value", "set");
    await mount();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const same = new File(["x"], "selfie.jpg", { type: "image/jpeg" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [same] } });
    });
    expect(setValue.mock.contexts.some((el, i) => el === input && setValue.mock.calls[i][0] === "")).toBe(true);
    expect(input.value).toBe("");
    await act(async () => {
      fireEvent.change(input, { target: { files: [same] } });
    });
    expect(readPhoto).toHaveBeenCalledTimes(2);
    expect(readPhoto.mock.calls.map((c) => c[0])).toEqual([same, same]);
  });
});

describe("the picture on a phone", () => {
  it("shows the picture's own role, name and days between the role and the name", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await mount();
    const strip = document.querySelector("form canvas") as HTMLCanvasElement;
    expect(strip).toBeTruthy();
    const row = strip.parentElement!;
    expect(row.getAttribute("aria-hidden")).toBe("true");
    expect(row.className).toContain("lg:hidden");
    const fieldset = document.querySelector("form fieldset")!;
    const label = document.querySelector('label[for="dp-name"]')!;
    expect(fieldset.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Its shape is the band's: 1800 wide by the zone's 472 tall.
    await waitFor(() => expect(strip.style.aspectRatio.replace(/\s/g, "")).toBe("1800/472"));
  });

  it("keeps the strip short enough to see over the keyboard held sideways, and the desktop picture full width", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await mount();
    await addPhoto();
    const strip = document.querySelector("form canvas") as HTMLCanvasElement;
    // Never taller than a fifth of the screen: as wide as that height allows, centred.
    expect(strip.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["mx-auto", "w-full", "max-w-[calc(20svh*var(--strip-aspect))]"]),
    );
    await waitFor(() => expect(Number(strip.style.getPropertyValue("--strip-aspect"))).toBeCloseTo(1800 / 472, 6));
    // The picture is capped at the screen's height below lg only.
    const classes = frame().className.split(/\s+/);
    expect(classes).toContain("max-lg:max-w-[calc(100svh-5rem)]");
    expect(classes).not.toContain("max-w-[calc(100svh-5rem)]");
  });

  it("moves the photo only from its circle, so a swipe elsewhere scrolls the page", async () => {
    await mount();
    await addPhoto();
    await waitFor(() => expect(handle()).toBeTruthy());
    expect(frame().className).not.toContain("touch-none");
    expect(frame().className).toContain("select-none");
    expect(handle().className).toContain("touch-none");
    expect(handle().getAttribute("aria-hidden")).toBe("true");
    // Centred on the hub, 1.3 times the photo's radius: 533 of 2160 either side of 1080, 760.
    expect(parseFloat(handle().style.width)).toBeCloseTo(((410 * 1.3 * 2) / 2160) * 100, 3);
    expect(parseFloat(handle().style.left)).toBeCloseTo(((1080 - 410 * 1.3) / 2160) * 100, 3);

    const canvas = screen.getByRole("img", { name: /^Preview/ });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ width: 360, height: 360, top: 0, left: 0, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) });
    await waitFor(() => expect(lastDrawn().photoTransform).toBeDefined());
    const start = lastDrawn().photoTransform!;

    // A swipe that starts on the picture, off the circle.
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 300 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 250 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 20, clientY: 250 });
    await settle(40);
    expect(lastDrawn().photoTransform).toEqual(start);

    // The same swipe from the circle moves the photo: 10px down is 60 of 2160, of an 820 frame.
    fireEvent.pointerDown(handle(), { pointerId: 2, clientX: 180, clientY: 150 });
    fireEvent.pointerMove(frame(), { pointerId: 2, clientX: 180, clientY: 160 });
    await waitFor(() => expect(lastDrawn().photoTransform!.offsetY).toBeCloseTo(start.offsetY + 60 / 820, 6));
    // A cancelled pointer (a call, an edge swipe) leaves the photo where it is.
    fireEvent.pointerCancel(frame(), { pointerId: 2 });
    fireEvent.pointerMove(frame(), { pointerId: 2, clientX: 180, clientY: 200 });
    await settle(40);
    expect(lastDrawn().photoTransform!.offsetY).toBeCloseTo(start.offsetY + 60 / 820, 6);
  });

  it("pinches to zoom with a second finger anywhere on the picture, and drags on without a jump", async () => {
    await mount();
    await addPhoto();
    await waitFor(() => expect(handle()).toBeTruthy());
    const canvas = screen.getByRole("img", { name: /^Preview/ });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ width: 360, height: 360, top: 0, left: 0, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) });
    const zoom = () => Number((screen.getByLabelText("Zoom") as HTMLInputElement).value);

    fireEvent.pointerDown(handle(), { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(frame(), { pointerId: 2, clientX: 300, clientY: 100 }); // twice as far apart
    expect(zoom()).toBeCloseTo(2, 6);
    fireEvent.pointerMove(frame(), { pointerId: 2, clientX: 500, clientY: 100 }); // four times
    expect(zoom()).toBe(3);
    // A third finger is ignored.
    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(frame(), { pointerId: 3, clientX: 300, clientY: 300 });
    expect(zoom()).toBe(3);

    await waitFor(() => expect(lastDrawn().photoTransform!.zoom).toBe(3));
    const atLift = lastDrawn().photoTransform!;
    fireEvent.pointerUp(frame(), { pointerId: 1 });
    fireEvent.pointerMove(frame(), { pointerId: 2, clientX: 510, clientY: 100 });
    await waitFor(() => expect(lastDrawn().photoTransform!.offsetX).toBeCloseTo(atLift.offsetX + 60 / 820, 6));
    expect(lastDrawn().photoTransform!.zoom).toBe(3);
    expect(lastDrawn().photoTransform!.offsetY).toBeCloseTo(atLift.offsetY, 6);
  });

  it("offers the arrow keys with a mouse, pinching on a touch screen, and buttons to a screen reader", async () => {
    await mount();
    await addPhoto();
    expect(await screen.findByText(/On a keyboard, the arrow keys move it\./)).toBeTruthy();
    expect(screen.queryByText(/Pinch to zoom\./)).toBeNull();
    cleanup();

    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await mount();
    await addPhoto();
    expect(await screen.findByText(/Pinch to zoom\./)).toBeTruthy();
    expect(screen.queryByText(/On a keyboard/)).toBeNull();

    const group = screen.getByRole("group", { name: "Move your photo" });
    expect(group.className).toContain("sr-only");
    expect(group.className).toContain("focus-within:not-sr-only");
    fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: "2" } });
    await waitFor(() => expect(lastDrawn().photoTransform!.zoom).toBe(2));
    const before = lastDrawn().photoTransform!.offsetX;
    fireEvent.click(button("Move right"));
    await waitFor(() => expect(lastDrawn().photoTransform!.offsetX).toBeCloseTo(before + 0.02, 10));
  });

  /** Where the picture's card, the picture and the first save button are, and the screen's height. */
  const rect = (r: Partial<DOMRect>) => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...r }) as DOMRect;
  const layout = (l: { section: number; picture: number; primaryBottom: number; vh: number }) => {
    define(window, "innerHeight", l.vh);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.getAttribute("aria-labelledby") === "dp-preview-title") return rect({ top: 900, width: l.section });
      if (this.getAttribute("role") === "group" && this.hasAttribute("tabindex")) return rect({ width: l.picture });
      if (this.textContent?.includes("Download PNG") && this.tagName === "BUTTON") return rect({ bottom: l.primaryBottom });
      return rect({});
    });
  };
  /** The picture's card is 900 down the page; the reveal leaves 12 above it. */
  const top = 900 - 12;
  /**
   * The ring's outer top in the mocked art (hub 760, photo radius 410, a
   * moat of 52 and half the ring's 26), as a share of the picture: as far
   * as the picture may scroll off.
   */
  const ringCut = (picture: number) => ((760 - 410 - 52 - 13) / 2160) * picture;

  it("brings the picture and the first save button into view once a photo is in, on a phone only", async () => {
    // A phone held upright, the button a little low: the mark gives way until it is on screen.
    layout({ section: 358, picture: 356, primaryBottom: 1750, vh: 844 });
    await mount();
    scrollTo.mockClear();
    await addPhoto();
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenCalledWith({ top: 1750 + 12 - 844, behavior: "smooth" });
    cleanup();

    // The button further down: only the mark and the theme go, up to the
    // ring's top, so the ring and the photo stay whole.
    layout({ section: 358, picture: 356, primaryBottom: 1780, vh: 844 });
    await mount();
    scrollTo.mockClear();
    await addPhoto();
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(1780 + 12 - 844).toBeGreaterThan(top + ringCut(356));
    expect(scrollTo).toHaveBeenCalledWith({ top: top + ringCut(356), behavior: "smooth" });
    cleanup();

    // Held sideways: the picture (310) is narrower than its card (812), and
    // the cut is measured on the picture, not on the card.
    layout({ section: 812, picture: 310, primaryBottom: 2000, vh: 390 });
    await mount();
    scrollTo.mockClear();
    await addPhoto();
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenCalledWith({ top: top + ringCut(310), behavior: "smooth" });
    cleanup();

    // Beside the steps on a wide screen: nothing to bring into view.
    setDevice({ wide: true });
    await mount();
    scrollTo.mockClear();
    await addPhoto();
    await settle(60);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("puts the keyboard away on Enter, and shows the picture once it is down", async () => {
    // The screen as the keyboard leaves it: 330 tall while it is up.
    const screenNow = Object.assign(new EventTarget(), { height: 330 });
    vi.stubGlobal("visualViewport", screenNow);
    layout({ section: 358, picture: 356, primaryBottom: 1700, vh: 844 });
    await mount();
    await addPhoto();
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1)); // the photo's own reveal
    const input = nameInput();
    input.focus();
    fireEvent.change(input, { target: { value: "Ada Obi" } });
    await waitFor(() => expect(download().disabled).toBe(false));
    scrollTo.mockClear();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.submit(input.form!);
    expect(document.activeElement).not.toBe(input);
    // Not while the keyboard is still going down.
    expect(scrollTo).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(250));
    screenNow.height = 844;
    screenNow.dispatchEvent(new Event("resize"));
    await act(async () => vi.advanceTimersByTimeAsync(119));
    expect(scrollTo).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    // Measured on the whole screen, the button fits with the picture's top in view.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top, behavior: "smooth" });

    // A keyboard that never resizes the screen (a hardware one): a moment, then the picture.
    scrollTo.mockClear();
    input.focus();
    fireEvent.submit(input.form!);
    await act(async () => vi.advanceTimersByTimeAsync(399));
    expect(scrollTo).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

describe("drawing the full picture ahead", () => {
  it("waits 300ms after the last change, then draws it once", async () => {
    await readyToShare("Download PNG");
    expect(fullDraws()).toHaveLength(1);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Speaking" }));
    await act(async () => vi.advanceTimersByTimeAsync(200));
    fireEvent.click(screen.getByRole("button", { name: "Volunteering" }));
    await act(async () => vi.advanceTimersByTimeAsync(299));
    expect(fullDraws()).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fullDraws()).toHaveLength(2);
    expect(fullDraws()[1].role).toBe("volunteer");
  });

  it("shares the render already running instead of starting another", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    const pending: BlobCallback[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => void pending.push(cb));
    await readyToShare("Share your DP");
    expect(pending).toHaveLength(1); // the background render, waiting on its file

    fireEvent.click(button("Share your DP"));
    expect(share).not.toHaveBeenCalled();
    expect(button("Preparing…").disabled).toBe(true);
    await settle(20);
    expect(pending).toHaveLength(1);
    expect(fullDraws()).toHaveLength(1);

    await act(async () => pending[0](new Blob(["the one"], { type: "image/jpeg" })));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    // The file made from that render's blob (jsdom's File cannot be read back, so by size).
    expect(share.mock.calls[0][0].files![0].size).toBe("the one".length);
  });

  it("draws one at a time, and skips a picture changed before its turn", async () => {
    const pending: BlobCallback[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => void pending.push(cb));
    await readyToShare("Download PNG");
    expect(fullDraws().map((o) => o.role)).toEqual(["attendee"]);

    fireEvent.click(screen.getByRole("button", { name: "Speaking" }));
    await settle(400); // queued behind the first
    fireEvent.click(screen.getByRole("button", { name: "Volunteering" }));
    await settle(400);
    expect(fullDraws()).toHaveLength(1);

    await act(async () => pending[0](new Blob(["a"])));
    await waitFor(() => expect(fullDraws()).toHaveLength(2));
    expect(fullDraws().map((o) => o.role)).toEqual(["attendee", "volunteer"]);
    await act(async () => pending[1](new Blob(["c"])));
    await settle(20);
    expect(fullDraws()).toHaveLength(2);
    expect(fullMostAtOnce).toBe(1);
  });

  it("never downloads a picture changed while it was being drawn", async () => {
    // Android: the JPEG is drawn ahead for the share list, so Download PNG waits on its own render.
    setDevice({ ua: UA.android, coarse: true, files: true });
    const pending: BlobCallback[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => void pending.push(cb));
    await readyToShare("Share your DP");
    expect(pending).toHaveLength(1); // the JPEG, drawn ahead

    fireEvent.click(download());
    expect(button("Saving…").disabled).toBe(true);
    await act(async () => pending[0](new Blob(["attending jpeg"], { type: "image/jpeg" })));
    await waitFor(() => expect(pending).toHaveLength(2)); // the PNG, now drawing
    expect(fullDraws().at(-1)!.role).toBe("attendee");

    // Speaking, while it says Saving…
    fireEvent.click(screen.getByRole("button", { name: "Speaking" }));
    await act(async () => pending[1](new Blob(["attending png"], { type: "image/png" })));
    await settle(20);
    expect(anchorClick).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(live().textContent).not.toMatch(/Downloading/);
    expect(download().disabled).toBe(false);
  });

  it("never shares a picture changed while it was being drawn, and shares the new one on the next tap", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    const pending: BlobCallback[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => void pending.push(cb));
    await readyToShare("Share your DP");
    expect(pending).toHaveLength(1);

    fireEvent.click(button("Share your DP"));
    expect(button("Preparing…").disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Speaking" }));
    await act(async () => pending[0](new Blob(["attending"], { type: "image/jpeg" })));
    await settle(20);
    expect(share).not.toHaveBeenCalled();
    expect(live().textContent).toBe("Tap again to open the share list.");

    // The new picture is drawn ahead, and the next tap shares it inside the tap.
    await settle(400);
    expect(pending).toHaveLength(2);
    expect(fullDraws().at(-1)!.role).toBe("speaker");
    await act(async () => pending[1](new Blob(["speaking!"], { type: "image/jpeg" })));
    fireEvent.click(button("Share your DP"));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].files![0].size).toBe("speaking!".length);
    await settle();
    expect(live().textContent).toBe("Ready to share");
  });
});

describe("sharing on a phone", () => {
  it("opens the share list inside the tap, with the JPEG alone, after copying the caption", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await readyToShare("Share your DP");
    expect(live().textContent).toBe("Ready to share");
    expect(statusLine().textContent).toBe("Ready to share");

    fireEvent.click(button("Share your DP"));
    // No await: the share list opened in the same tap.
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0];
    const file = data.files![0];
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toBe("blockfest-2026-dp-ada-obi.jpg");
    expect("text" in data).toBe(false);
    expect("title" in data).toBe(false);
    expect("url" in data).toBe(false);
    expect(writeText).toHaveBeenCalledWith(shareText("attendee"));
    expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(share.mock.invocationCallOrder[0]);
    await settle();
  });

  it("adds the caption to the share on Android when the browser takes it", async () => {
    setDevice({ ua: UA.android, coarse: true, files: true });
    await readyToShare("Share your DP");
    fireEvent.click(button("Share your DP"));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].text).toBe(shareText("attendee"));
    expect(share.mock.calls[0][0].files![0].type).toBe("image/jpeg");
    await settle();
    cleanup();

    setDevice({ ua: UA.android, coarse: true, files: true, text: false });
    share.mockClear();
    await readyToShare("Share your DP");
    fireEvent.click(button("Share your DP"));
    expect(Object.keys(share.mock.calls[0][0])).toEqual(["files"]);
    await settle();
  });

  it("is quiet when the list is cancelled, and says what to do when sharing fails", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await readyToShare("Share your DP");

    share.mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    fireEvent.click(button("Share your DP"));
    await settle();
    expect(live().textContent).toBe("Ready to share");

    share.mockRejectedValueOnce(new DOMException("no tap", "NotAllowedError"));
    fireEvent.click(button("Share your DP"));
    await settle();
    expect(live().textContent).toBe("Tap again to open the share list.");

    share.mockRejectedValueOnce(new TypeError("bad data"));
    fireEvent.click(button("Share your DP"));
    await settle();
    expect(live().textContent).toBe(
      "Sharing didn't work in this browser. Use Download PNG, then post it from your gallery.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();

    // In an app's browser, the press-and-hold picture instead.
    setDevice({ ua: UA.instagramIos, coarse: true, files: true });
    await readyToShare("Share your DP");
    share.mockRejectedValueOnce(new TypeError("bad data"));
    fireEvent.click(button("Share your DP"));
    expect(await screen.findByRole("dialog", { name: "Save your DP" })).toBeTruthy();
    expect(live().textContent).toBe("Sharing didn't work here. Press and hold your DP to save it.");
  });

  it("stops saying Tap again, or that sharing failed, once the share list opens", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await readyToShare("Share your DP");

    share.mockRejectedValueOnce(new DOMException("no tap", "NotAllowedError"));
    fireEvent.click(button("Share your DP"));
    await settle();
    expect(live().textContent).toBe("Tap again to open the share list.");
    fireEvent.click(button("Share your DP"));
    expect(share).toHaveBeenCalledTimes(2);
    await settle();
    expect(live().textContent).toBe("Ready to share");

    share.mockRejectedValueOnce(new TypeError("bad data"));
    fireEvent.click(button("Share your DP"));
    await settle();
    expect(live().textContent).toMatch(/^Sharing didn't work/);
    // Cancelled this time: the list did open, so the failure is no longer true either.
    share.mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    fireEvent.click(button("Share your DP"));
    await settle();
    expect(live().textContent).toBe("Ready to share");
  });

  it("opens the share list from every mark, with that app's tip", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await mount();
    const mark = (label: string) => button(label);
    for (const label of ["Post on X", "Post on Instagram", "Post on TikTok", "Post on LinkedIn", "Send on WhatsApp"]) {
      expect(mark(label).getAttribute("aria-disabled")).toBe("true");
    }
    fireEvent.click(mark("Post on X"));
    expect(share).not.toHaveBeenCalled();

    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    await addPhoto();
    await waitFor(() => expect(button("Share your DP").disabled).toBe(false));
    await settle(400);

    const tips: Record<string, RegExp> = {
      "Post on X": /^Pick X\./,
      "Post on Instagram": /^Pick Instagram \(Feed or Stories\)/,
      "Post on TikTok": /Choose Save Image, then post it from TikTok/,
      "Post on LinkedIn": /LinkedIn leaves it out/,
      "Send on WhatsApp": /then a chat or My status/,
    };
    let n = 0;
    for (const [label, tip] of Object.entries(tips)) {
      fireEvent.click(mark(label));
      n += 1;
      expect(share).toHaveBeenCalledTimes(n);
      expect(mark(label).getAttribute("aria-pressed")).toBe("true");
      for (const other of Object.keys(tips)) {
        if (other !== label) expect(mark(other).getAttribute("aria-pressed")).toBe("false");
      }
      expect(screen.getByText(tip)).toBeTruthy();
      await settle();
    }
    expect(writeText).toHaveBeenCalledTimes(5);
  });

  it("posts to WhatsApp Status through the share list, saying to pick My status", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await mount();
    const status = () => button("Post to WhatsApp Status");
    expect(status().disabled).toBe(true);
    expect(
      screen.getByText("Opens your share list with your DP: choose WhatsApp, then My status at the top."),
    ).toBeTruthy();
    expect(status().getAttribute("aria-describedby")).toBe("dp-whatsapp-status-how");

    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    await addPhoto();
    await waitFor(() => expect(status().disabled).toBe(false));
    await settle(400);

    // A mark's tip is about another app, so it goes when Status is tapped.
    fireEvent.click(button("Send on WhatsApp"));
    await settle();
    expect(screen.getByText(/then a chat or My status/)).toBeTruthy();
    share.mockClear();
    writeText.mockClear();

    fireEvent.click(status());
    // No await: the share list opened in the same tap, with the picture alone.
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(["files"]);
    expect(data.files![0].type).toBe("image/jpeg");
    expect(writeText).toHaveBeenCalledWith(shareText("attendee"));
    expect(button("Send on WhatsApp").getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText(/then a chat or My status/)).toBeNull();
    await settle();
    cleanup();

    // Android hands WhatsApp the caption beside the picture.
    setDevice({ ua: UA.android, coarse: true, files: true });
    share.mockClear();
    await readyToShare("Post to WhatsApp Status");
    fireEvent.click(button("Post to WhatsApp Status"));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].text).toBe(shareText("attendee"));
    await settle();
  });

  it("saves the DP for WhatsApp Status where the share list cannot take it, once per picture", async () => {
    setDevice({ ua: UA.android, coarse: true, files: false });
    await readyToShare("Download PNG");
    expect(
      screen.getByText(
        "Saves your DP and copies your caption. Then in WhatsApp, open Updates and add it to My status.",
      ),
    ).toBeTruthy();
    fireEvent.click(button("Post to WhatsApp Status"));
    await settle();
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(shareText("attendee"));
    expect(live().textContent).toBe("Downloading blockfest-2026-dp-ada-obi.png. Look for it in Downloads.");
    fireEvent.click(button("Post to WhatsApp Status"));
    await settle();
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(share).not.toHaveBeenCalled();
  });

  it("saves to Photos through the share list on an iPhone, with the file alone", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await readyToShare("Share your DP");
    fireEvent.click(button("Save to Photos"));
    expect(share).toHaveBeenCalledTimes(1);
    expect(Object.keys(share.mock.calls[0][0])).toEqual(["files"]);
    expect(live().textContent).toBe("Choose Save Image in the list to put it in Photos.");
    // Saving a picture does not need the caption, so the clipboard is left alone.
    expect(writeText).not.toHaveBeenCalled();
    await settle();
  });

  it("says where an iPhone download goes, and keeps the file there a minute", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await readyToShare("Share your DP");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(download());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(live().textContent).toBe(
      "Downloading blockfest-2026-dp-ada-obi.png. On iPhone it goes to Files, in Downloads. For Photos, use Save to Photos.",
    );
    await act(async () => vi.advanceTimersByTimeAsync(59_999));
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("sends the marks to the press-and-hold picture on an iPhone that cannot share files", async () => {
    // Lockdown Mode: a download goes to Files, where the apps' pickers do not look.
    setDevice({ ua: UA.iphone, coarse: true, files: false });
    await readyToShare("Download PNG");
    expect(screen.getByText("Save your DP first, then post it in the app. Each copies your caption.")).toBeTruthy();
    expect(screen.queryAllByRole("link", { name: /^(Post|Send) on / })).toHaveLength(0);
    fireEvent.click(button("Post on Instagram"));
    const dialog = await screen.findByRole("dialog", { name: "Save your DP" });
    expect(dialog.textContent).toContain("Press and hold the picture, then choose Save to Photos.");
    expect(dialog.textContent).toContain("Then open Instagram and post it. Your caption is copied.");
    expect(writeText).toHaveBeenCalledWith(shareText("attendee"));
    expect(anchorClick).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(screen.queryByText(/choose your DP and paste your caption/)).toBeNull();
  });

  it("shows the caption with a Copy button, and says when copying fails", async () => {
    await mount();
    expect(screen.getByText(shareText("attendee"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Volunteering" }));
    expect(screen.getByText(shareText("volunteer"))).toBeTruthy();

    fireEvent.click(button("Copy"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
    expect(writeText).toHaveBeenLastCalledWith(shareText("volunteer"));

    writeText.mockRejectedValueOnce(new DOMException("no", "NotAllowedError"));
    fireEvent.click(button("Copied"));
    expect(await screen.findByText("Couldn't copy. Press and hold the caption to copy it.")).toBeTruthy();
  });
});

describe("saving on a desktop", () => {
  it("downloads once for a double click, and says it started", async () => {
    await readyToShare("Download PNG");
    fireEvent.click(download());
    await settle(100);
    fireEvent.click(download());
    await settle();
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(live().textContent).toBe("Downloading blockfest-2026-dp-ada-obi.png.");
    expect(screen.queryByText(/Saved as/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Share…" })).toBeNull();
    // Status is posted from the phone app.
    expect(screen.queryByRole("button", { name: "Post to WhatsApp Status" })).toBeNull();
    expect(document.body.textContent).not.toContain("My status");
  });

  it("makes each mark a real link that also saves the DP and copies the caption", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    await readyToShare("Download PNG");
    const caption = shareText("attendee");
    const link = (label: string) => screen.getByRole("link", { name: label }) as HTMLAnchorElement;
    const hrefs: Record<string, string> = {
      "Post on X": `https://x.com/intent/tweet?text=${encodeURIComponent(caption)}`,
      "Post on Instagram": "https://www.instagram.com/",
      "Post on TikTok": "https://www.tiktok.com/tiktokstudio/upload",
      "Post on LinkedIn": "https://www.linkedin.com/feed/",
      "Send on WhatsApp": `https://wa.me/?text=${encodeURIComponent(caption)}`,
    };
    for (const [label, href] of Object.entries(hrefs)) {
      expect(link(label).getAttribute("href")).toBe(href);
      expect(link(label).getAttribute("target")).toBe("_blank");
      expect(link(label).getAttribute("rel")).toBe("noopener noreferrer");
    }
    // jsdom cannot open a new tab; the page's own handler has run by then.
    const stay = (e: Event) => e.preventDefault();
    document.addEventListener("click", stay);
    fireEvent.click(link("Post on X"));
    expect(writeText).toHaveBeenCalledWith(caption);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/X is open in a new tab with your caption\. Attach your DP \(blockfest-2026-dp-ada-obi\.png\)/)).toBeTruthy();
    await settle();
    fireEvent.click(link("Post on X"));
    fireEvent.click(link("Post on LinkedIn"));
    await settle();
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    document.removeEventListener("click", stay);
  });

  it("offers Share… quietly where the browser can share files, with the PNG", async () => {
    setDevice({ files: true });
    await readyToShare("Download PNG");
    fireEvent.click(button("Share…"));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0]).toEqual({ files: [expect.any(File)] });
    expect(share.mock.calls[0][0].files![0].type).toBe("image/png");
    expect(screen.queryByRole("button", { name: "Post to WhatsApp Status" })).toBeNull();
    await settle();
  });
});

describe("in an app's browser", () => {
  it("says how to get out before anything is typed, and saves by press and hold", async () => {
    // An Android in-app browser has navigator.share for text, never for files.
    setDevice({ ua: UA.instagramAndroid, coarse: true, files: false });
    await mount();
    const note = await screen.findByRole("note");
    expect(note.textContent).toContain("Open this page in Chrome");
    expect(note.textContent).toContain("Instagram's browser can't save your DP.");
    const chrome = screen.getByRole("link", { name: "Open in Chrome" });
    expect(chrome.getAttribute("href")).toMatch(/^intent:\/\//);
    expect(chrome.getAttribute("href")).toContain("package=com.android.chrome");
    expect(button("Copy link")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Download PNG/ })).toBeNull();

    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    await addPhoto();
    await waitFor(() => expect(button("Save image").disabled).toBe(false));
    expect(live().textContent).toBe("Ready to save");
    await settle(400);

    fireEvent.click(button("Save image"));
    const dialog = await screen.findByRole("dialog", { name: "Save your DP" });
    expect(dialog.textContent).toContain("Press and hold the picture, then choose Download image.");
    const img = (await screen.findByRole("img", { name: "Your Blockfest Africa 2026 DP" })) as HTMLImageElement;
    expect(img.getAttribute("src")).toMatch(/^blob:/);
    expect(share).not.toHaveBeenCalled();

    fireEvent.click(button("Done"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(revokeObjectURL).toHaveBeenCalledWith(img.getAttribute("src"));
  });

  it("copies the link, or shows it when copying is refused", async () => {
    setDevice({ ua: UA.instagramAndroid, coarse: true });
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    expect(await screen.findByText("Link copied. Paste it into Chrome.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/getdp`);
    writeText.mockRejectedValueOnce(new Error("no"));
    fireEvent.click(button("Copy link"));
    expect(await screen.findByText(`Copy this link: ${window.location.host}/getdp`)).toBeTruthy();
  });

  it("sends every mark to the press-and-hold picture, naming the app to post in", async () => {
    setDevice({ ua: UA.instagramAndroid, coarse: true });
    await readyToShare("Save image");
    fireEvent.click(button("Post on LinkedIn"));
    const dialog = await screen.findByRole("dialog", { name: "Save your DP" });
    expect(dialog.textContent).toContain("Then open LinkedIn and post it. Your caption is copied.");
    expect(writeText).toHaveBeenCalledWith(shareText("attendee"));
  });

  it("sends WhatsApp Status to the press-and-hold picture, saying where Status is in WhatsApp", async () => {
    setDevice({ ua: UA.instagramAndroid, coarse: true });
    await readyToShare("Save image");
    expect(screen.getByText("Save your DP, then in WhatsApp, open Updates and add it to My status.")).toBeTruthy();
    fireEvent.click(button("Post to WhatsApp Status"));
    const dialog = await screen.findByRole("dialog", { name: "Save your DP" });
    expect(dialog.textContent).toContain("Press and hold the picture, then choose Download image.");
    expect(dialog.textContent).toContain(
      "Then open WhatsApp, go to Updates and add it to My status. Your caption is copied.",
    );
    expect(writeText).toHaveBeenCalledWith(shareText("attendee"));
    expect(share).not.toHaveBeenCalled();
    expect(anchorClick).not.toHaveBeenCalled();

    fireEvent.click(button("Done"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // A refused copy: the picture's line no longer says it is copied.
    writeText.mockRejectedValueOnce(new DOMException("no", "NotAllowedError"));
    fireEvent.click(button("Post to WhatsApp Status"));
    const again = await screen.findByRole("dialog", { name: "Save your DP" });
    await waitFor(() => expect(again.textContent).not.toContain("Your caption is copied."));
    expect(again.textContent).toContain("Then open WhatsApp, go to Updates and add it to My status.");
    expect(live().textContent).toBe("Couldn't copy your caption. Copy it from the box below.");
  });

  it("never says the caption is copied when the browser refused the copy", async () => {
    setDevice({ ua: UA.instagramAndroid, coarse: true });
    await readyToShare("Save image");
    // Before any tap, the marks' line says what a tap does, not that it is done.
    expect(document.body.textContent).not.toContain("Your caption is copied.");
    writeText.mockRejectedValueOnce(new DOMException("no", "NotAllowedError"));
    fireEvent.click(button("Post on LinkedIn"));
    const dialog = await screen.findByRole("dialog", { name: "Save your DP" });
    await waitFor(() => expect(live().textContent).toBe("Couldn't copy your caption. Copy it from the box below."));
    expect(dialog.textContent).toContain("Then open LinkedIn and post it.");
    expect(dialog.textContent).not.toContain("Your caption is copied.");

    fireEvent.click(button("Done"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Then open LinkedIn and post it.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Your caption is copied.");
  });

  it("shows no notice in a normal browser", async () => {
    setDevice({ ua: UA.iphone, coarse: true, files: true });
    await mount();
    await settle();
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("the /getdp link card", () => {
  it("shares as this page, with only the public days, not the homepage's three", async () => {
    const { metadata } = await import("@/app/getdp/page");
    const og = metadata.openGraph as {
      url?: string;
      title?: string;
      description?: string;
      images?: { url: string }[];
    };
    expect(og.url).toBe("https://blockfestafrica.com/getdp");
    expect(og.title).toBe("Get your Blockfest Africa 2026 DP");
    expect(og.description).toContain("22–23 October");
    expect(og.images?.[0]?.url).toMatch(/\/images\/og-image\.jpg$/);
    const twitter = metadata.twitter as { title?: string; description?: string; images?: string[] };
    expect(twitter.title).toBe("Get your Blockfest Africa 2026 DP");
    expect(twitter.description).toContain("22–23 October");
    expect(twitter.images?.length).toBeGreaterThan(0);
    for (const text of [og.description, twitter.description]) expect(text).not.toMatch(/24/);
  });
});
