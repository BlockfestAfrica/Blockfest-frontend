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
import { DP_LOGO_SRC, type FooterLogo, type FooterTiers } from "./dp";
import type { Bitmap, DPAssets } from "./draw";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src.slice(0, 80)}`));
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
 * Every logo becomes a bitmap at exactly the width x height recorded in
 * lib/partners-2026 before drawDP sees it: an SVG sized 100% has no natural
 * size of its own, and some browsers draw it at 0x0 or squashed. (The page
 * hands SVGs over with that size already written on their root element.)
 */
export async function rasteriseLogo(logo: FooterLogo): Promise<HTMLCanvasElement> {
  const img = await loadImage(logo.src);
  const c = document.createElement("canvas");
  c.width = logo.width;
  c.height = logo.height;
  const g = c.getContext("2d");
  if (!g) throw new Error("No 2D canvas");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, logo.width, logo.height);
  if (!inked(c)) throw new Error(`${logo.name}'s logo rasterised blank`);
  return c;
}

/**
 * The mark and every footer logo. A logo that fails to load is left out
 * (and said so in the console) rather than costing everybody their DP.
 */
export async function loadAssets(tiers: FooterTiers): Promise<DPAssets> {
  const all = [
    ...(tiers.headline ? [tiers.headline] : []),
    ...tiers.sponsors,
    ...tiers.groups.flatMap((g) => g.logos),
  ];
  const [logo, settled] = await Promise.all([
    loadImage(DP_LOGO_SRC),
    Promise.allSettled(all.map(rasteriseLogo)),
  ]);
  const logos: Record<string, Bitmap> = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") logos[all[i].name] = r.value;
    else console.warn(`DP footer: ${all[i].name} left out:`, r.reason);
  });
  return { logo, tiers, logos };
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
