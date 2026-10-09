/**
 * Reading the person's photo (app/getdp/lib/load.ts readPhoto): the
 * sentence they see when a file will not do. jsdom decodes no images, so the
 * decoder is a stand-in that fails or succeeds on cue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoError, heicAdvice, readPhoto } from "@/app/getdp/lib/load";

let decodes = false;
const revoked: string[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = "auto";
  naturalWidth = 0;
  naturalHeight = 0;
  set src(_url: string) {
    queueMicrotask(() => {
      if (decodes) {
        this.naturalWidth = 3000;
        this.naturalHeight = 4000;
        this.onload?.();
      } else {
        this.onerror?.();
      }
    });
  }
}

beforeEach(() => {
  decodes = false;
  revoked.length = 0;
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = () => "blob:local-photo";
      static revokeObjectURL = (u: string) => void revoked.push(u);
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({ drawImage: () => undefined, imageSmoothingEnabled: true, imageSmoothingQuality: "high" }) as unknown as CanvasRenderingContext2D,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const file = (name: string, type: string) => new File(["x"], name, { type });

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("reading a photo", () => {
  it("only suggests Safari for a HEIC photo on a device that has Safari", async () => {
    expect(heicAdvice(IPHONE)).toMatch(/Open this page in Safari/);
    for (const ua of [ANDROID, WINDOWS]) {
      expect(heicAdvice(ua)).toBe(
        "This browser cannot open HEIC photos. Save the photo as a JPEG, or take a screenshot of it, and choose that.",
      );
    }
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ANDROID);
    const err = await readPhoto(file("IMG_0003.HEIC", "image/heic")).catch((e) => e);
    expect(err.message).not.toMatch(/Safari/);
  });

  it("names HEIC when this browser cannot open one", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    const err = await readPhoto(file("IMG_0001.HEIC", "image/heic")).catch((e) => e);
    expect(err).toBeInstanceOf(PhotoError);
    expect(err.message).toBe(
      "This browser cannot open HEIC photos. Open this page in Safari, or save the photo as a JPEG and choose that.",
    );
    // A HEIC from a picker that gives no type is still recognised by its name.
    const untyped = await readPhoto(file("IMG_0002.heic", "")).catch((e) => e);
    expect(untyped.message).toMatch(/cannot open HEIC photos/);
    expect(revoked).toEqual(["blob:local-photo", "blob:local-photo"]);
  });

  it("says plainly when a file is not a photo, or will not open", async () => {
    expect((await readPhoto(file("cv.pdf", "application/pdf")).catch((e) => e)).message).toBe(
      "That file is not a photo. Choose a JPEG, PNG or WebP picture.",
    );
    expect((await readPhoto(file("broken.jpg", "image/jpeg")).catch((e) => e)).message).toBe(
      "This browser could not open that photo. Try a JPEG or PNG copy of it.",
    );
  });

  it("keeps a large photo at most 2400 on its long side, and lets go of the file", async () => {
    decodes = true;
    const photo = await readPhoto(file("big.jpg", "image/jpeg"));
    expect([photo.width, photo.height]).toEqual([1800, 2400]);
    expect(revoked).toEqual(["blob:local-photo"]);
  });
});
