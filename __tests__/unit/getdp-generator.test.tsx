/**
 * The Get DP page's controls (app/getdp/components/DPGenerator.tsx).
 *
 * jsdom has no canvas, so the drawing is mocked: these check what the page
 * asks drawDP to draw and what it lets a person do, not the pixels (the
 * pixels are app/getdp/lib/dp.ts's rules, tested on their own).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { footerTiers } from "@/app/getdp/lib/dp";
import { headline, partners, sponsors } from "@/lib/partners-2026";

const drawDP = vi.fn<(...args: unknown[]) => Promise<{ hub: { x: number; y: number }; photoR: number }>>(
  async () => ({ hub: { x: 1080, y: 760 }, photoR: 410 }),
);
const nameSubstitutions = vi.fn<(name: string) => Promise<{ letter: string; drawn: string | null }[]>>(
  async () => [],
);
vi.mock("@/app/getdp/lib/draw", () => ({
  drawDP: (...args: unknown[]) => drawDP(...args),
  nameSubstitutions: (name: string) => nameSubstitutions(name),
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

beforeEach(() => {
  drawDP.mockClear();
  nameSubstitutions.mockReset();
  nameSubstitutions.mockResolvedValue([]);
  loadAssets.mockReset();
  loadAssets.mockImplementation(async (tiers) => ({ logo: {}, tiers, logos: {} }));
  readPhoto.mockReset();
  readPhoto.mockResolvedValue({ photo: { width: 900, height: 1600 }, width: 900, height: 1600 });
  // jsdom has no 2D context; the mocked drawDP never touches it.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({}) as unknown as CanvasRenderingContext2D,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The options of the most recent drawDP call. */
const lastDrawn = () => drawDP.mock.calls.at(-1)?.[1] as {
  role: string;
  name: string;
  photo: unknown;
  photoTransform?: { zoom: number; offsetX: number; offsetY: number };
};

const nameInput = () => screen.getByLabelText("Your name") as HTMLInputElement;
const download = () => screen.getByRole("button", { name: /Download PNG/ }) as HTMLButtonElement;
const share = () => screen.getByRole("button", { name: /Share/ }) as HTMLButtonElement;
/** The polite live region under the buttons, and the whole line it sits in. */
const live = () => document.querySelector('[aria-live="polite"]:not(canvas ~ *)') as HTMLElement;
const statusLine = () => live().parentElement as HTMLElement;

/** A promise settled from outside, for photos that open slowly. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function addPhoto(name = "selfie.jpg") {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(["x"], name, { type: "image/jpeg" })] } });
  });
}

async function mount() {
  render(<DPGenerator tiers={tiers} />);
  await waitFor(() => expect(drawDP).toHaveBeenCalled());
}

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

  it("keeps download and share shut until there is a photo and a good name", async () => {
    await mount();
    expect((download() as HTMLButtonElement).disabled).toBe(true);
    expect((share() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Add your name and a photo to download your DP.")).toBeTruthy();

    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    expect((download() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Add a photo to download your DP.")).toBeTruthy();

    await addPhoto();
    await waitFor(() => expect((download() as HTMLButtonElement).disabled).toBe(false));
    expect((share() as HTMLButtonElement).disabled).toBe(false);
    expect(statusLine().textContent).toBe("Ready to download: blockfest-2026-dp-ada-obi.png");

    fireEvent.change(nameInput(), { target: { value: "A" } });
    expect((download() as HTMLButtonElement).disabled).toBe(true);
    expect((share() as HTMLButtonElement).disabled).toBe(true);
    expect(live().textContent).toBe("Fix your name to download your DP.");
  });

  it("announces the state, not the file name, while a name is typed", async () => {
    await mount();
    await addPhoto();
    fireEvent.change(nameInput(), { target: { value: "Ada" } });
    await waitFor(() => expect(download().disabled).toBe(false));
    expect(live().textContent).toBe("Ready to download");
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
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be prepared/);
    expect(download().disabled).toBe(true);
    expect(live().textContent).toBe("Reload the page to try again.");
  });

  it("holds the download back for a letter the lettering cannot draw, and waits for the check", async () => {
    const check = deferred<{ letter: string; drawn: string | null }[]>();
    nameSubstitutions.mockReturnValue(check.promise);
    await mount();
    await addPhoto();
    fireEvent.change(nameInput(), { target: { value: "Aƣba Obi" } });
    // Until the check says what the face can draw, nothing can be downloaded.
    await waitFor(() => expect(nameSubstitutions).toHaveBeenCalledWith("Aƣba Obi"));
    expect(download().disabled).toBe(true);
    await act(async () => check.resolve([{ letter: "Ƣ", drawn: null }]));
    expect((await screen.findByRole("alert")).textContent).toMatch(/cannot draw Ƣ/);
    expect(download().disabled).toBe(true);
    expect(live().textContent).toBe("Fix your name to download your DP.");

    // A stand-in letter is only noted, and the download opens.
    nameSubstitutions.mockResolvedValue([{ letter: "Ɖ", drawn: "D" }]);
    fireEvent.change(nameInput(), { target: { value: "Ɖossou" } });
    expect(await screen.findByText(/has no Ɖ, so it draws D/)).toBeTruthy();
    await waitFor(() => expect(download().disabled).toBe(false));
  });

  it("says a download was started, not that it was saved, and what to do in an in-app browser", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb) {
      cb(new Blob(["png"], { type: "image/png" }));
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = () => "blob:dp";
        static revokeObjectURL = () => undefined;
      },
    );
    await mount();
    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    await addPhoto();
    await waitFor(() => expect(download().disabled).toBe(false));
    await act(async () => fireEvent.click(download()));
    await waitFor(() => expect(live().textContent).toBe("Downloading blockfest-2026-dp-ada-obi.png."));
    expect(screen.queryByText(/Saved as/)).toBeNull();

    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0",
    );
    await act(async () => fireEvent.click(download()));
    await waitFor(() => expect(live().textContent).toMatch(/If nothing is saved, open this page in your browser/));
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

    const frame = screen.getByRole("group", { name: /arrow keys/ });
    expect(frame.getAttribute("tabindex")).toBe("0");
    const before = lastDrawn().photoTransform!.offsetX;
    fireEvent.keyDown(frame, { key: "ArrowRight" });
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
    const frame = screen.getByRole("group", { name: /arrow keys/ });
    expect(frame.className).toContain("focus-visible:-outline-offset-2");
    expect(frame.className).toContain("focus-visible:outline-brand-blue-light");
  });

  it("tells a square photo to zoom before it can move", async () => {
    readPhoto.mockResolvedValue({ photo: { width: 1200, height: 1200 }, width: 1200, height: 1200 });
    await mount();
    await addPhoto();
    expect(await screen.findByText(/Your photo fills its frame\. Zoom in to move it\./)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: "1.5" } });
    expect(await screen.findByText(/Drag the picture to move your photo in its frame\./)).toBeTruthy();
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
    expect(screen.getByText(/Drag the picture up or down/)).toBeTruthy();
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

  it("falls back to a post on X with the share text where files cannot be shared", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    await mount();
    fireEvent.change(nameInput(), { target: { value: "Ada Obi" } });
    fireEvent.click(screen.getByRole("button", { name: "Volunteering" }));
    await addPhoto();
    await waitFor(() => expect((share() as HTMLButtonElement).disabled).toBe(false));
    expect(share().textContent).toContain("Share on X");

    fireEvent.click(share());
    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://x.com/intent/tweet");
    expect(url.searchParams.get("text")).toBe(
      "I'm volunteering at Blockfest Africa 2026 in Lagos, 22–23 October. Get your DP: https://blockfestafrica.com/getdp #Blockfest2026",
    );
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
