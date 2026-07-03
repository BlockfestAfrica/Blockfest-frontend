// One-off pipeline that curated + optimized the South Africa 2026 (Cape Town) event
// photos for the web. Reads the raw camera JPGs from public/images/south-africa/day 1..5,
// selects an evenly-spaced spread per day (adjacent DSC frames are near-duplicate burst
// shots, so spacing avoids dupes), auto-orients via EXIF, resizes, and re-encodes to WebP.
// Raw originals (~6 GB) were deleted after this ran; kept here to document provenance.
//
// Usage: node scripts/optimize-sa-photos.mjs
import { readdir, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "public/images/south-africa";
const OUT = "public/images/south-africa/gallery";
const MAX_WIDTH = 1920;
const QUALITY = 80;

// How many frames to keep from each day (proportional to how many were shot).
const PER_DAY = { "day 1": 3, "day 2": 9, "day 3": 16, "day 4": 7, "day 5": 8 };

function evenlySpaced(arr, n) {
  if (n >= arr.length) return arr;
  if (n <= 1) return [arr[Math.floor(arr.length / 2)]];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  }
  return out;
}

const isJpg = (f) => /\.jpe?g$/i.test(f);

async function run() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  let index = 1;
  const written = [];
  for (const day of Object.keys(PER_DAY)) {
    const dir = path.join(SRC, day);
    const files = (await readdir(dir)).filter(isJpg).sort();
    const picks = evenlySpaced(files, PER_DAY[day]);
    for (const file of picks) {
      const name = `sa-${String(index).padStart(2, "0")}.webp`;
      await sharp(path.join(dir, file))
        .rotate() // honor EXIF orientation, then strip metadata (default)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(path.join(OUT, name));
      written.push(`${name}  <-  ${day}/${file}`);
      index++;
    }
  }
  console.log(written.join("\n"));
  console.log(`\nWrote ${written.length} optimized images to ${OUT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
