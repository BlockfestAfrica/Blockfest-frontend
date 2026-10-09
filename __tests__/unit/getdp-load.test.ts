/**
 * Getting the mark and the partner logos in (app/getdp/lib/load.ts) on a weak
 * connection: a stalled logo costs only its place in the footer until it is
 * asked for again (under a new URL, for longer), a stalled
 * mark ends in an error the page can offer Try again on, and no logo's bitmap
 * is bigger than it needs to be. jsdom loads no images, so Image is a
 * stand-in that answers, fails or never answers on cue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DP_LOGO_SRC, type FooterTiers } from "@/app/getdp/lib/dp";
import {
  LATE_LOGO_TIMEOUT_MS,
  LATE_LOGO_TRIES,
  LOGO_MAX_SIDE,
  LOGO_TIMEOUT_MS,
  MARK_TIMEOUT_MS,
  freshLogo,
  loadAssets,
  loadImage,
  rasteriseLogo,
  retryLogos,
} from "@/app/getdp/lib/load";

/** Sources that never answer. Anything else loads on the next microtask. */
const stalled = new Set<string>();
const cancelled: string[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = "auto";
  naturalWidth = 400;
  naturalHeight = 100;
  width = 400;
  height = 100;
  private current = "";
  get src() {
    return this.current;
  }
  set src(url: string) {
    if (url === "" && this.current) cancelled.push(this.current);
    this.current = url;
    if (!url || stalled.has(url)) return;
    queueMicrotask(() => this.onload?.());
  }
}

const logo = (name: string, width = 400, height = 100) => ({ name, src: `/logos/${name}.png`, width, height });

beforeEach(() => {
  stalled.clear();
  cancelled.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal("Image", FakeImage);
  // Every logo has ink in it.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        drawImage: () => undefined,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }),
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      }) as unknown as CanvasRenderingContext2D,
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("loading the picture's parts", () => {
  it("leaves a logo that never answers off the footer after 8 seconds, and carries on", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const slow = logo("Slow");
    stalled.add(slow.src);
    const tiers: FooterTiers = { headline: logo("Monica"), sponsors: [slow, logo("Hoaq")], groups: [] };
    let settled = false;
    const done = loadAssets(tiers).then((a) => {
      settled = true;
      return a;
    });
    await vi.advanceTimersByTimeAsync(LOGO_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const assets = await done;
    expect(Object.keys(assets.logos).sort()).toEqual(["Hoaq", "Monica"]);
    expect(assets.missing).toEqual([slow]);
    expect(cancelled).toEqual([slow.src]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Slow left out"), expect.anything());
    expect(LOGO_TIMEOUT_MS).toBe(8000);
  });

  it("asks again for a logo left off, under a new URL so it cannot wait on the stalled one, for 30 seconds", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const slow = logo("Slow");
    const gone = logo("Gone");
    stalled.add(slow.src);
    stalled.add(`${gone.src}?dp=1`);
    const got = retryLogos([slow, gone], 1).then((l) => Object.keys(l));
    await vi.advanceTimersByTimeAsync(LATE_LOGO_TIMEOUT_MS - 1);
    let early: string[] | null = null;
    void got.then((k) => (early = k));
    await Promise.resolve();
    expect(early).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(await got).toEqual(["Slow"]);
    expect(cancelled).toEqual([`${gone.src}?dp=1`]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Gone still left out"), expect.anything());
    expect([LATE_LOGO_TRIES, LATE_LOGO_TIMEOUT_MS]).toEqual([2, 30000]);
  });

  it("keeps a logo written into the page as it is when asking again", () => {
    const inline = { name: "Cake Wallet", src: "data:image/svg+xml,%3Csvg%3E", width: 4, height: 1 };
    expect(freshLogo(inline, 2)).toBe(inline);
    expect(freshLogo(logo("Hoaq"), 2).src).toBe("/logos/Hoaq.png?dp=2");
    expect(freshLogo({ ...logo("Hoaq"), src: "/logos/Hoaq.png?v=3" }, 1).src).toBe("/logos/Hoaq.png?v=3&dp=1");
  });

  it("gives up on a mark that never loads after 12 seconds, so the page can offer Try again", async () => {
    stalled.add(DP_LOGO_SRC);
    const tiers: FooterTiers = { headline: logo("Monica"), sponsors: [], groups: [] };
    const outcome = loadAssets(tiers).then(
      () => "loaded",
      (e: Error) => e.message,
    );
    await vi.advanceTimersByTimeAsync(MARK_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toMatch(/^Timed out loading/);
    expect(MARK_TIMEOUT_MS).toBe(12000);
  });

  it("waits as long as it takes for a photo, which is a file on the device", async () => {
    stalled.add("blob:photo");
    let settled = false;
    void loadImage("blob:photo").then(() => (settled = true), () => (settled = true));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);
  });

  it("draws a huge logo at no more than 1200 on its long side, in its proportions", async () => {
    const big = await rasteriseLogo(logo("Cake Wallet", 5000, 1250));
    expect([big.width, big.height]).toEqual([1200, 300]);
    const tall = await rasteriseLogo(logo("Seal", 1600, 2400));
    expect([tall.width, tall.height]).toEqual([800, 1200]);
    const small = await rasteriseLogo(logo("Hoaq", 480, 120));
    expect([small.width, small.height]).toEqual([480, 120]);
    expect(LOGO_MAX_SIDE).toBe(1200);
  });
});
