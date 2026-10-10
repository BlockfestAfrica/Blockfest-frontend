/**
 * The DP's own faces (app/getdp/lib/faces.ts): found in the page's
 * @font-face rules as next/font writes them, loaded under the DP's own
 * family names, and loaded afresh when a try fails or stalls, which the CSS
 * faces never do.
 *
 * jsdom has no FontFace and no font set, so both are stand-ins: a FontFace
 * whose file answers as set per URL (loads, fails, stalls, or arrives on
 * cue), and a font set that records what is added.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/getdp/lib/fonts", () => ({
  DP_FONTS: { display: "'Bebas Neue', 'Bebas Neue Fallback'", text: "'gotham', 'gotham Fallback'" },
}));

const { DP_FAMILY, FONT_TIMEOUT_MS, faceSources, loadDpFaces, resetDpFaces } = await import(
  "@/app/getdp/lib/faces"
);
const { FontLoadError } = await import("@/app/getdp/lib/errors");

const LATIN = "/_next/static/media/6c25f6e897d845a3-s.woff2";
const LATIN_EXT = "/_next/static/media/8b44c7e6549520b2-s.woff2";
const GOTHAM = "/_next/static/media/415e26477a48d603-s.woff2";

/** A @font-face rule as the browser's CSSOM gives it. */
const face = (props: Record<string, string>) => ({
  type: 5,
  style: { getPropertyValue: (name: string) => props[name] ?? "" },
});

/** next/font's rules for the two faces, fallbacks included, as built. */
const NEXT_FONT_RULES = [
  face({
    "font-family": "\"Bebas Neue\"",
    "font-style": "normal",
    "font-weight": "400",
    src: `url("${LATIN_EXT}") format("woff2")`,
    "unicode-range": "U+100-2BA, U+2BD-2C5",
  }),
  face({
    "font-family": "\"Bebas Neue\"",
    "font-style": "normal",
    "font-weight": "400",
    src: `url("${LATIN}") format("woff2")`,
    "unicode-range": "U+0-FF, U+131",
  }),
  face({ "font-family": "\"Bebas Neue Fallback\"", src: "local(\"Arial\")" }),
  face({ "font-family": "gotham", src: `url("${GOTHAM}") format("woff2")` }),
  face({ "font-family": "\"gotham Fallback\"", src: "local(\"Arial\")" }),
  { type: 1 }, // a style rule
];

type Answer = "ok" | "fail" | "stall";
let answers: Map<string, Answer[]>;
/** Each file asked for, as the path and query a FontFace was given. */
let asked: string[];
let added: { family: string; descriptors: FontFaceDescriptors }[];
/** A file held back until the test lets it come. */
let held: (() => void) | null;

/** The next answer for a path (the last one repeats). */
function answerFor(path: string): Answer {
  const list = answers.get(path) ?? ["ok"];
  return list.length > 1 ? list.shift()! : list[0];
}

class FakeFontFace {
  status = "unloaded";
  constructor(
    public family: string,
    public source: string,
    public descriptors: FontFaceDescriptors = {},
  ) {}
  load(): Promise<this> {
    const url = new URL(/url\("([^"]+)"\)/.exec(this.source)![1]);
    asked.push(url.pathname + url.search);
    const answer = answerFor(url.pathname);
    if (answer === "fail") {
      this.status = "error";
      return Promise.reject(new DOMException("A network error occurred.", "NetworkError"));
    }
    if (answer === "stall") return new Promise(() => undefined);
    return new Promise((resolve) => {
      const done = () => {
        this.status = "loaded";
        resolve(this);
      };
      if (held === null && url.pathname === holdPath) held = done;
      else done();
    });
  }
}
/** The path whose file waits for the test (see `held`). */
let holdPath = "";

beforeEach(() => {
  resetDpFaces();
  answers = new Map();
  asked = [];
  added = [];
  held = null;
  holdPath = "";
  vi.stubGlobal("FontFace", FakeFontFace);
  Object.defineProperty(document, "styleSheets", {
    configurable: true,
    value: [{ cssRules: NEXT_FONT_RULES }],
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      add: (f: FakeFontFace) => added.push({ family: f.family, descriptors: f.descriptors }),
      load: vi.fn(() => Promise.reject(new Error("the DP never asks the CSS faces"))),
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (document as { fonts?: unknown }).fonts;
  delete (document as { styleSheets?: unknown }).styleSheets;
});

describe("finding the faces' files", () => {
  it("reads Bebas's two files and Gotham's from next/font's rules, never the Arial fallbacks", () => {
    const sources = faceSources([{ cssRules: NEXT_FONT_RULES }], "https://blockfestafrica.com/getdp");
    expect(sources).toEqual([
      {
        family: DP_FAMILY.display,
        url: `https://blockfestafrica.com${LATIN_EXT}`,
        descriptors: { style: "normal", weight: "400", unicodeRange: "U+100-2BA, U+2BD-2C5" },
      },
      {
        family: DP_FAMILY.display,
        url: `https://blockfestafrica.com${LATIN}`,
        descriptors: { style: "normal", weight: "400", unicodeRange: "U+0-FF, U+131" },
      },
      {
        family: DP_FAMILY.text,
        url: `https://blockfestafrica.com${GOTHAM}`,
        descriptors: { style: "normal", weight: "400" },
      },
    ]);
  });

  it("skips a stylesheet it may not read, and says which face is missing", () => {
    const foreign = {
      get cssRules(): ArrayLike<{ type: number }> {
        throw new DOMException("Cannot access rules", "SecurityError");
      },
    };
    expect(faceSources([foreign, { cssRules: NEXT_FONT_RULES }], "https://x.test/")).toHaveLength(3);
    const noBebas = NEXT_FONT_RULES.filter(
      (r) => !("style" in r && /Bebas Neue"$/.test(r.style.getPropertyValue("font-family"))),
    );
    expect(() => faceSources([{ cssRules: noBebas }], "https://x.test/")).toThrow(
      new FontLoadError("DP font not in the page's styles: Bebas Neue"),
    );
  });
});

describe("loading the faces", () => {
  it("loads each file once under the DP's own names, and never asks the CSS faces", async () => {
    await loadDpFaces();
    expect(asked).toEqual([LATIN_EXT, LATIN, GOTHAM]);
    expect(added.map((a) => a.family)).toEqual([DP_FAMILY.display, DP_FAMILY.display, DP_FAMILY.text]);
    expect(added[0].descriptors.unicodeRange).toBe("U+100-2BA, U+2BD-2C5");
    // Two draws at once share the try, and a loaded face is not asked for again.
    await Promise.all([loadDpFaces(), loadDpFaces()]);
    expect(asked).toHaveLength(3);
    expect(document.fonts.load).not.toHaveBeenCalled();
  });

  it("shares one try between draws that ask while it runs", async () => {
    holdPath = GOTHAM;
    const a = loadDpFaces();
    const b = loadDpFaces();
    expect(b).toBe(a);
    await Promise.resolve();
    await Promise.resolve();
    expect(loadDpFaces()).toBe(a);
    held!();
    await Promise.all([a, b]);
    expect(asked).toEqual([LATIN_EXT, LATIN, GOTHAM]);
  });

  it("takes a slow file that lands during the next try, rather than waiting on the try's own copy", async () => {
    vi.useFakeTimers();
    holdPath = GOTHAM;
    answers.set(GOTHAM, ["ok", "stall"]);
    const first = loadDpFaces().then(() => "loaded", (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(FONT_TIMEOUT_MS);
    expect(await first).toBe("DP fonts timed out");

    // The next try asks again (the first copy is a whole try old), and that copy stalls...
    let second = "";
    void loadDpFaces().then(() => (second = "loaded"), (e: Error) => (second = e.message));
    await vi.advanceTimersByTimeAsync(2000);
    expect(asked.filter((a) => a.startsWith(GOTHAM))).toEqual([GOTHAM, `${GOTHAM}?dp=1`]);
    // ...but the first copy lands: that is Gotham, and the try is done.
    held!();
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toBe("loaded");
    expect(added.filter((a) => a.family === DP_FAMILY.text)).toHaveLength(1);
  });

  it("waits on a file still coming when another fails at once, instead of asking for it twice", async () => {
    holdPath = GOTHAM;
    answers.set(LATIN, ["fail", "ok"]);
    await expect(loadDpFaces()).rejects.toThrow("NetworkError");
    const again = loadDpFaces();
    await Promise.resolve();
    await Promise.resolve();
    expect(asked).toEqual([LATIN_EXT, LATIN, GOTHAM, `${LATIN}?dp=1`]);
    held!();
    await again;
    expect(added.map((a) => a.family).sort()).toEqual([DP_FAMILY.display, DP_FAMILY.display, DP_FAMILY.text]);
  });

  it("tries again for real after a file fails, asking only for what did not load, under a new URL", async () => {
    answers.set(LATIN, ["fail", "ok"]);
    const first = await loadDpFaces().catch((e: Error) => e);
    expect(first).toBeInstanceOf(FontLoadError);
    expect((first as Error).message).toBe("DP fonts did not load (NetworkError: A network error occurred.)");

    asked = [];
    await loadDpFaces();
    expect(asked).toEqual([`${LATIN}?dp=1`]);
    expect(added.filter((a) => a.family === DP_FAMILY.display)).toHaveLength(2);
  });

  it("gives up on a stalled file after 12 seconds, and the next try does not wait on it", async () => {
    vi.useFakeTimers();
    answers.set(LATIN_EXT, ["stall", "ok"]);
    const first = loadDpFaces().then(() => "loaded", (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(FONT_TIMEOUT_MS - 1);
    let early = "";
    void first.then((m) => (early = m));
    await Promise.resolve();
    expect(early).toBe("");
    await vi.advanceTimersByTimeAsync(1);
    expect(await first).toBe("DP fonts timed out");
    expect(FONT_TIMEOUT_MS).toBe(12000);

    asked = [];
    await loadDpFaces();
    expect(asked).toEqual([`${LATIN_EXT}?dp=1`]);
  });

  it("waits out a slow file that does arrive inside the time, and adds each face once", async () => {
    vi.useFakeTimers();
    holdPath = GOTHAM;
    const done = loadDpFaces().then(() => "loaded");
    await vi.advanceTimersByTimeAsync(FONT_TIMEOUT_MS - 1000);
    held!();
    expect(await done).toBe("loaded");
    expect(added.map((a) => a.family)).toEqual([DP_FAMILY.display, DP_FAMILY.display, DP_FAMILY.text]);
  });
});
