/**
 * Getting pictures into the browser for drawDP: the mark, the partner logos
 * and the person's photo. DOM only, no React.
 *
 * Nothing here sends anything anywhere. The photo is read from the file the
 * person picked, through an object URL that never leaves the tab, and is
 * copied into a canvas; the logos are the site's own files. The privacy
 * policy says the photo never leaves the browser, and
 * __tests__/unit/privacy.test.ts holds this folder to it.
 */
import { DP_LOGO_SRC, DP_MARK_LIGHT_SRC, DP_MARK_WHITE_SRC, type FooterLogo, type FooterTiers } from "./dp";
import type { ExtraTone } from "./looks";
import type { Bitmap, DPAssets } from "./draw";

/** The mark may take this long on a weak connection before the page says so. */
export const MARK_TIMEOUT_MS = 12_000;
/** A footer logo that takes longer than this is left off, as a failed one is. */
export const LOGO_TIMEOUT_MS = 8_000;
/**
 * A logo left off is asked for again, in the background, this many times,
 * each waiting this long: on slow data the first 8 seconds are not enough
 * for the smaller partners' logos, and the picture is drawn again with each
 * one that comes.
 */
export const LATE_LOGO_TRIES = 2;
export const LATE_LOGO_TIMEOUT_MS = 30_000;
/**
 * A logo's bitmap is at most this on its long side. The footer places logos
 * at the sizes recorded in lib/partners-2026 (never the bitmap's), and none
 * is drawn wider than about 600 on the 2160 post, so this keeps every logo
 * sharp while Cake Wallet's 5000x1250 (25 MB of canvas) becomes 1200x300.
 */
export const LOGO_MAX_SIDE = 1200;

/**
 * Loads an image. With a timeout, a request that never answers is given up
 * on: its handlers are cleared and the load is cancelled. A photo is a local
 * file, so it is read without one.
 */
export function loadImage(src: string, timeoutMs?: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (timer !== undefined) clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };
    img.decoding = "async";
    img.onload = () => {
      settle();
      resolve(img);
    };
    img.onerror = () => {
      settle();
      reject(new Error(`Could not load ${src.slice(0, 80)}`));
    };
    if (timeoutMs !== undefined) {
      timer = setTimeout(() => {
        settle();
        img.src = "";
        reject(new Error(`Timed out loading ${src.slice(0, 80)}`));
      }, timeoutMs);
    }
    img.src = src;
  });
}

/** A logo that rasterised to nothing would leave a hole in the footer. */
function inked(c: HTMLCanvasElement): boolean {
  const probe = document.createElement("canvas");
  probe.width = 64;
  probe.height = 16;
  const g = probe.getContext("2d");
  if (!g) return true;
  g.drawImage(c, 0, 0, 64, 16);
  const px = g.getImageData(0, 0, 64, 16).data;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 0) return true;
  return false;
}

/**
 * Every logo becomes a bitmap in the proportions recorded in
 * lib/partners-2026 before drawDP sees it: an SVG sized 100% has no natural
 * size of its own, and some browsers draw it at 0x0 or squashed. (The page
 * hands SVGs over with that size already written on their root element.)
 * The recorded size, capped at LOGO_MAX_SIDE on its long side.
 */
export async function rasteriseLogo(
  logo: FooterLogo,
  timeoutMs: number = LOGO_TIMEOUT_MS,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(logo.src, timeoutMs);
  const k = Math.min(1, LOGO_MAX_SIDE / Math.max(logo.width, logo.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(logo.width * k));
  c.height = Math.max(1, Math.round(logo.height * k));
  const g = c.getContext("2d");
  if (!g) throw new Error("No 2D canvas");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, c.width, c.height);
  if (!inked(c)) throw new Error(`${logo.name}'s logo rasterised blank`);
  return c;
}

/** The assets, and the logos left off them for now (see retryLogos). */
export interface LoadedAssets extends DPAssets {
  missing: FooterLogo[];
}

/**
 * The mark and every footer logo. A logo that fails to load, or takes longer
 * than LOGO_TIMEOUT_MS, is left out (and said so in the console) rather than
 * costing everybody their DP, and listed in `missing` for retryLogos. The
 * mark is not optional: if it has not come in MARK_TIMEOUT_MS this rejects,
 * and the page offers Try again.
 */
export async function loadAssets(tiers: FooterTiers): Promise<LoadedAssets> {
  const all = [
    ...(tiers.headline ? [tiers.headline] : []),
    ...tiers.sponsors,
    ...tiers.groups.flatMap((g) => g.logos),
  ];
  const [logo, settled] = await Promise.all([
    loadImage(DP_LOGO_SRC, MARK_TIMEOUT_MS),
    Promise.allSettled(all.map((l) => rasteriseLogo(l))),
  ]);
  const logos: Record<string, Bitmap> = {};
  const missing: FooterLogo[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") logos[all[i].name] = r.value;
    else {
      missing.push(all[i]);
      console.warn(`DP footer: ${all[i].name} left out:`, r.reason);
    }
  });
  return { logo, tiers, logos, missing };
}

/**
 * The same logo under a new URL, so a second try cannot wait on a request
 * that stalled. A logo written into the page (data:) cannot stall.
 */
export function freshLogo(logo: FooterLogo, attempt: number): FooterLogo {
  if (/^(data|blob):/.test(logo.src)) return logo;
  return { ...logo, src: `${logo.src}${logo.src.includes("?") ? "&" : "?"}dp=${attempt}` };
}

/**
 * Another try at the logos left off, each under a new URL and given
 * LATE_LOGO_TIMEOUT_MS. The ones that come, by name; the rest stay off.
 */
export async function retryLogos(missing: FooterLogo[], attempt: number): Promise<Record<string, Bitmap>> {
  const settled = await Promise.allSettled(
    missing.map((l) => rasteriseLogo(freshLogo(l, attempt), LATE_LOGO_TIMEOUT_MS)),
  );
  const logos: Record<string, Bitmap> = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") logos[missing[i].name] = r.value;
    else console.warn(`DP footer: ${missing[i].name} still left out:`, r.reason);
  });
  return logos;
}

const MARK_SRC: Record<ExtraTone, string> = {
  onLight: DP_MARK_LIGHT_SRC,
  white: DP_MARK_WHITE_SRC,
};

/**
 * A version of the mark only some designs draw: black lettering ("Colour
 * fields", on its white card) or all white ("Sunset"). Not part of
 * loadAssets: nobody on another design waits for it or loses their DP to it.
 * The page asks for each once the rest has come.
 */
export function loadMark(tone: ExtraTone): Promise<HTMLImageElement> {
  return loadImage(MARK_SRC[tone], MARK_TIMEOUT_MS);
}

/** A photo problem, in words for the person who picked it. */
export class PhotoError extends Error {}

/**
 * What to say when a HEIC photo will not open. Safari opens HEIC, but only
 * an Apple device has Safari; anyone else is told only what they can do.
 */
export function heicAdvice(userAgent: string): string {
  const apple = /iPhone|iPad|iPod|Macintosh/.test(userAgent);
  return apple
    ? "This browser cannot open HEIC photos. Open this page in Safari, or save the photo as a JPEG and choose that."
    : "This browser cannot open HEIC photos. Save the photo as a JPEG, or take a screenshot of it, and choose that.";
}

/** Larger than this, a phone runs short of memory decoding it. */
const MAX_BYTES = 40 * 1024 * 1024;
/** The longest side kept: enough for the frame at full zoom on the 2160 post. */
const MAX_SIDE = 2400;

export interface LoadedPhoto {
  photo: Bitmap;
  width: number;
  height: number;
}

/**
 * Reads a picked or dropped file into a canvas, at most MAX_SIDE on its long
 * side so the live preview stays quick. Throws PhotoError with a sentence
 * the page can show as it is.
 */
export async function readPhoto(file: File): Promise<LoadedPhoto> {
  const heic = /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  const looksLikeImage =
    file.type.startsWith("image/") ||
    (!file.type && /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name));
  if (!looksLikeImage) {
    throw new PhotoError("That file is not a photo. Choose a JPEG, PNG or WebP picture.");
  }
  if (file.size > MAX_BYTES) {
    throw new PhotoError("That photo is over 40 MB. Choose a smaller copy of it.");
  }

  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError(
      heic
        ? heicAdvice(typeof navigator === "undefined" ? "" : navigator.userAgent)
        : "This browser could not open that photo. Try a JPEG or PNG copy of it.",
    );
  }

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) {
    URL.revokeObjectURL(url);
    throw new PhotoError("That photo has no picture in it that this browser can read.");
  }
  const k = Math.min(1, MAX_SIDE / Math.max(iw, ih));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(iw * k));
  c.height = Math.max(1, Math.round(ih * k));
  const g = c.getContext("2d");
  if (!g) {
    URL.revokeObjectURL(url);
    throw new PhotoError("This browser cannot draw pictures. Try another browser.");
  }
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return { photo: c, width: c.width, height: c.height };
}
