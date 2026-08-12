#!/usr/bin/env node
/**
 * Generates every raster brand asset from one source of truth.
 *
 * Why this exists: public/images/logo.svg is not vector art — it is a 1536x420
 * PNG embedded in an SVG wrapper declared at 140x38. The previous generator
 * resized that wrapper with `withoutEnlargement: true`, so nothing was ever
 * scaled up and every icon on the site ended up 140x38: the PWA icons, the
 * apple-touch-icon, even favicon-32x32.png (which was 32x9). Chrome discards
 * icons whose bitmap does not match the declared `sizes`, so the site had no
 * valid installable icon at all.
 *
 * This script extracts the embedded bitmap, crops the square mark out of the
 * horizontal wordmark, and composites each asset at its exact declared size.
 * Every output is asserted against its spec before being written.
 *
 * Run: node scripts/generate-brand-assets.mjs
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

/** The dark ground every icon sits on. Matches --color-ground. */
const GROUND = { r: 0x0a, g: 0x16, b: 0x28, alpha: 1 };

/** Pull the real bitmap out of the SVG wrapper. */
function extractLogo() {
  const svg = readFileSync(join(PUBLIC, "images/logo.svg"), "utf8");
  const m = svg.match(/xlink:href="data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)"/);
  if (!m) throw new Error("no embedded raster in logo.svg");
  return Buffer.from(m[1], "base64");
}

/** The 2x2 colour block, cropped out of the wordmark. */
async function markOnly(logo) {
  return sharp(logo).extract({ left: 30, top: 18, width: 380, height: 384 }).toBuffer();
}

/** Composite `art` centred on a square ground, at exactly `size`. */
async function square(art, size, { inset = 0.72, ground = GROUND } = {}) {
  const inner = Math.round(size * inset);
  const resized = await sharp(art)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: ground },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function write(path, buf, expect) {
  const full = join(PUBLIC, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, buf);
  const meta = await sharp(buf).metadata();
  const ok = meta.width === expect[0] && meta.height === expect[1];
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${path.padEnd(34)} ${meta.width}x${meta.height}` +
      (ok ? "" : `  expected ${expect[0]}x${expect[1]}`)
  );
  if (!ok) process.exitCode = 1;
}

const logo = extractLogo();
const mark = await markOnly(logo);

console.log("Icons (square mark on the brand ground)");
await write("icon-192.png", await square(mark, 192), [192, 192]);
await write("icon-512.png", await square(mark, 512), [512, 512]);
// Maskable icons are cropped to a circle by the OS, so the art sits inside the
// central 80% safe zone.
await write("icon-maskable-192.png", await square(mark, 192, { inset: 0.56 }), [192, 192]);
await write("icon-maskable-512.png", await square(mark, 512, { inset: 0.56 }), [512, 512]);
await write("apple-touch-icon.png", await square(mark, 180), [180, 180]);
await write("mstile-150x150.png", await square(mark, 150), [150, 150]);
await write("favicon-32x32.png", await square(mark, 32, { inset: 0.82 }), [32, 32]);
await write("favicon-16x16.png", await square(mark, 16, { inset: 0.88 }), [16, 16]);

console.log("\nSocial cards (1200x630, from the current edition's hero photo)");
const OG_W = 1200;
const OG_H = 630;

async function ogCard(photoPath, { title, subtitle, meta }) {
  const photo = await sharp(join(PUBLIC, photoPath))
    .resize(OG_W, OG_H, { fit: "cover", position: "centre" })
    .toBuffer();

  // Same scrim logic as the hero: dark enough for type, open enough to read.
  const scrim = Buffer.from(
    `<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#0A1628" stop-opacity="0.97"/>
        <stop offset="60%" stop-color="#0A1628" stop-opacity="0.80"/>
        <stop offset="100%" stop-color="#0A1628" stop-opacity="0.35"/>
      </linearGradient></defs>
      <rect width="${OG_W}" height="${OG_H}" fill="url(#g)"/>
    </svg>`
  );

  const wordmark = await sharp(logo).resize({ width: 280 }).toBuffer();

  // Per-edition text. Sourced from the arguments so a new edition regenerates
  // the card without touching this file's layout.
  const text = Buffer.from(
    `<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .t { font-family: Helvetica, Arial, sans-serif; font-weight: 700; fill: #FFFFFF; }
        .s { font-family: Helvetica, Arial, sans-serif; font-weight: 400; fill: #F2CB45; letter-spacing: 3px; }
      </style>
      <text x="72" y="330" class="t" font-size="76">${title}</text>
      <text x="72" y="392" class="t" font-size="34" opacity="0.85">${subtitle}</text>
      <text x="72" y="470" class="s" font-size="24">${meta.toUpperCase()}</text>
    </svg>`
  );

  return sharp(photo)
    .composite([
      { input: scrim, top: 0, left: 0 },
      { input: wordmark, top: 56, left: 72 },
      { input: text, top: 0, left: 0 },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// PER-EDITION. Change these three lines and re-run for the next edition.
const EDITION = {
  title: "Blockf3st Africa '26",
  subtitle: "New Trade Routes: Bringing Africa Onchain",
  meta: "Oct 22-24, 2026 - National Art Theatre, Lagos",
};

const main = await ogCard("images/home/img4.jpg", EDITION);
await write("images/og-image.jpg", main, [OG_W, OG_H]);
await write("images/twitter-image.jpg", main, [OG_W, OG_H]);

const speakers = await ogCard("images/home/img1.jpg", {
  ...EDITION,
  title: "Speakers",
  subtitle: "The voices shaping Africa's next decade",
});
await write("images/og-speakers.jpg", speakers, [OG_W, OG_H]);
await write("images/twitter-speakers.jpg", speakers, [OG_W, OG_H]);

console.log("\nDone.");
