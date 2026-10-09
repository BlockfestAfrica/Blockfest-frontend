/**
 * The canvas painting's edges (app/getdp/lib/draw.ts), without pixels: it
 * gives up on fonts that never arrive instead of saying "Preparing" for
 * ever, it reports where the role, name and days band landed (the page shows
 * that band beside the name field on a phone), and a full-size render lets
 * go of its 2160 canvas whether or not a file came out.
 *
 * jsdom has no 2D canvas and no document.fonts, so both are stand-ins: a
 * context that records nothing and measures every letter alike, and a font
 * set whose loads settle (or never do) on cue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/getdp/lib/fonts", () => ({
  DP_FONTS: { display: "'Bebas Neue', sans-serif", text: "Gotham, sans-serif" },
}));

const { FONT_TIMEOUT_MS, drawDP, nameSubstitutions, renderFull } = await import("@/app/getdp/lib/draw");
const { DP_SIZE } = await import("@/app/getdp/lib/dp");

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
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
  };
  return new Proxy(state, {
    get: (t, k) => (k in t ? t[k] : () => undefined),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

let fontLoad: () => Promise<unknown>;

beforeEach(() => {
  fontLoad = async () => [];
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      load: () => fontLoad(),
      get ready() {
        return Promise.resolve();
      },
      forEach: (cb: (f: { family: string; status: string }) => void) => {
        cb({ family: "Bebas Neue", status: "loaded" });
        cb({ family: "Gotham", status: "loaded" });
      },
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return fakeContext(this);
  } as unknown as HTMLCanvasElement["getContext"]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (document as { fonts?: unknown }).fonts;
});

const assets = {
  logo: { width: 667, height: 164 } as unknown as HTMLCanvasElement,
  tiers: { headline: null, sponsors: [], groups: [] },
  logos: {},
};
const opts = { photo: null, name: "Ada Obi", role: "attendee" as const };

describe("drawing the DP", () => {
  it("gives up on fonts that never arrive after 12 seconds, so the page can offer Try again", async () => {
    vi.useFakeTimers();
    fontLoad = () => new Promise(() => undefined);
    const ctx = fakeContext({ width: 1080, height: 1080 });
    const drawn = drawDP(ctx, opts, assets).then(() => "drawn", (e: Error) => e.message);
    const checked = nameSubstitutions("Ọlá").then(() => "checked", (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(FONT_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await drawn).toBe("DP fonts timed out");
    expect(await checked).toBe("DP fonts timed out");
    expect(FONT_TIMEOUT_MS).toBe(12000);
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
