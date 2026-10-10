/**
 * The canvas painting's edges (app/getdp/lib/draw.ts), without pixels: it
 * draws nothing until the DP's own faces have loaded, and in nothing else,
 * it reports where the role, name and days band landed (the page shows
 * that band beside the name field on a phone), and a full-size render lets
 * go of its 2160 canvas whether or not a file came out.
 *
 * jsdom has no 2D canvas, so the context is a stand-in that records nothing
 * and measures every letter alike. The faces are faces.ts's, tested on
 * their own in getdp-faces.test.ts; here they load (or do not) on cue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let facesLoad: () => Promise<void>;
vi.mock("@/app/getdp/lib/faces", () => ({
  DP_FAMILY: { display: "Blockfest DP Display", text: "Blockfest DP Text" },
  primaryFamily: (stack: string) => stack.split(",")[0].trim().replace(/^['"]|['"]$/g, ""),
  loadDpFaces: () => facesLoad(),
}));

const { drawDP, nameSubstitutions, renderFull } = await import("@/app/getdp/lib/draw");
const { DP_SIZE } = await import("@/app/getdp/lib/dp");
const { FontLoadError } = await import("@/app/getdp/lib/errors");

/** A 2D context that accepts every call and measures each letter as half its size. */
function fakeContext(canvas: { width: number; height: number }): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = {
    canvas,
    font: "400 100px sans-serif",
    measureText(s: string) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 100);
      return {
        width: [...s].length * size * 0.5,
        actualBoundingBoxAscent: size * 0.7,
        actualBoundingBoxDescent: size * 0.02,
      };
    },
    getTransform: () => ({ a: canvas.width / DP_SIZE }),
    drawImage: (img: unknown) => {
      drawnImages.push(img);
    },
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
  };
  return new Proxy(state, {
    get: (t, k) => (k in t ? t[k] : () => undefined),
    set: (t, k, v) => {
      if (k === "font") fontsSet.push(String(v));
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** The fonts each draw used, as set on the context. */
let fontsSet: string[];
/** Every bitmap drawn, in order. */
let drawnImages: unknown[];

beforeEach(() => {
  facesLoad = async () => undefined;
  fontsSet = [];
  drawnImages = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return fakeContext(this);
  } as unknown as HTMLCanvasElement["getContext"]);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const assets = {
  logo: { width: 667, height: 164 } as unknown as HTMLCanvasElement,
  tiers: { headline: null, sponsors: [], groups: [] },
  logos: {},
};
const opts = { photo: null, name: "Ada Obi", role: "attendee" as const };

describe("drawing the DP", () => {
  it("draws nothing, and checks no letter, until both faces have loaded, and says why", async () => {
    const why = new FontLoadError("DP fonts timed out");
    facesLoad = () => Promise.reject(why);
    const ctx = fakeContext({ width: 1080, height: 1080 });
    await expect(drawDP(ctx, opts, assets)).rejects.toBe(why);
    await expect(nameSubstitutions("Ọlá")).rejects.toBe(why);
    expect(fontsSet).toEqual([]);
  });

  it("draws in the DP's own faces only, with no fallback family behind them", async () => {
    await drawDP(fakeContext({ width: 1080, height: 1080 }), opts, assets);
    await nameSubstitutions("Ọlá Ńkem");
    const families = new Set(fontsSet.map((f) => f.replace(/^400 [\d.]+px /, "")));
    expect([...families].filter((f) => !/^"Blockfest DP (Display|Text)"(, (monospace|serif))?$/.test(f))).toEqual([]);
    expect(families).toContain('"Blockfest DP Display"');
    expect(families).toContain('"Blockfest DP Text"');
  });

  it("keeps the photo and the name band where they are whichever design is picked, and uses the right mark", async () => {
    const onDark = { width: 1536, height: 420, tone: "dark" } as unknown as HTMLCanvasElement;
    const onLight = { width: 1536, height: 420, tone: "light" } as unknown as HTMLCanvasElement;
    const kit = { ...assets, logo: onDark, marks: { onLight } };
    const results = [];
    for (const style of ["routes", "scallop", "fields"] as const) {
      drawnImages = [];
      results.push(await drawDP(fakeContext({ width: 1080, height: 1080 }), { ...opts, style }, kit));
      // The mark is the first bitmap drawn: black lettering only on the white ground.
      expect(drawnImages[0], style).toBe(style === "fields" ? onLight : onDark);
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    // Colour fields is never drawn with white lettering on its white card.
    await expect(drawDP(fakeContext({ width: 1080, height: 1080 }), { ...opts, style: "fields" }, { ...kit, marks: {} })).rejects.toThrow(
      "The fields design needs its mark",
    );
    // Unset is the design people were already posting.
    drawnImages = [];
    expect(await drawDP(fakeContext({ width: 1080, height: 1080 }), opts, kit)).toEqual(results[0]);
    expect(drawnImages[0]).toBe(onDark);
  });

  it("says where the role, name and days band landed, under the photo", async () => {
    const result = await drawDP(fakeContext({ width: 1080, height: 1080 }), opts, assets);
    expect(result.zone.bottom).toBeGreaterThan(result.zone.top);
    expect(result.zone.top).toBeGreaterThan(result.hub.y + result.photoR);
    expect(result.zone.bottom).toBeLessThanOrEqual(DP_SIZE);
  });

  it("lets go of the full-size canvas once the file is made", async () => {
    const seen: { canvas: HTMLCanvasElement; width: number; type?: string; quality?: unknown }[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
      type?: string,
      quality?: unknown,
    ) {
      seen.push({ canvas: this, width: this.width, type, quality });
      cb(new Blob(["dp"], { type }));
    });
    const blob = await renderFull(opts, assets, "image/jpeg", 0.92);
    expect(blob.type).toBe("image/jpeg");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ width: DP_SIZE, type: "image/jpeg", quality: 0.92 });
    expect([seen[0].canvas.width, seen[0].canvas.height]).toEqual([0, 0]);
  });

  it("lets go of it too when no file comes out, and says so", async () => {
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => cb(null));
    await expect(renderFull(opts, assets, "image/png")).rejects.toThrow("No picture file");
    expect(toBlob).toHaveBeenCalledTimes(1);
    const canvas = toBlob.mock.contexts[0] as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });
});
