// Partner logos, prepared for the white tiles on the home page.
//
// The 2025 wall drew every logo on a dark tile, and about half the files were
// made for that: white wordmarks on transparent ground. On the white tiles
// the 2026 wall uses, those vanish (Sui, WID, MGS Web3, Web3 Nigeria, Base)
// or lose their words (Jupiter, Web3Bridge, Ife Media). Several others carry
// so much empty canvas that they render as a speck (Hyperbridge, DTCSI,
// Business Day, SIBAN).
//
// This writes a copy of each, trimmed to its artwork, and for the light ones
// with only the white and grey parts turned dark: the brand colours stay as
// they are, which is what a brand's own light-background version usually
// is. The 2026 files are only trimmed (Cake Wallet is an SVG and needs
// nothing): three media logos were 300x150 canvases
// with the artwork in a 52px band, so they rendered at a third of their
// neighbours' size. The originals are left untouched.
//
// Adding a partner: put the file in public/, add a line below, run this, and
// copy the printed width and height into the partner's entry, so the wall
// can size it by its shape.
//
// Usage: node scripts/logos-on-white.mjs
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUBLIC = "public";
const OUT = { 2025: "public/images/partners-2025", 2026: "public/2026/logos" };

/** The ink a white wordmark becomes: the site's ground, so it reads as ours. */
const INK = [11, 18, 32];

/*
 * `light`: drawn for a dark ground, so its neutral pixels are turned dark.
 * Chosen by eye from a contact sheet of every logo on white and on dark,
 * not detected: a white glyph inside a coloured mark (Avalanche's A) must
 * stay white, and only a person can tell those apart from a white wordmark.
 *
 * `keep`: points in the source, [x, y], whose white area is part of the mark
 * and stays white: the whole light region connected to the point is left
 * alone. Jupiter's flag stripe (green, white, green, not green, black,
 * green), Gidi's disc (its G is black, so a dark disc hides it) and the
 * pupil in Jeroid's O.
 *
 * `trim: false`: the artwork is drawn on its own opaque plate, and trimming
 * cuts the plate's margin off. `solid`: faint pixels round the edge (Guild's
 * near-invisible app-icon corners) stopped the trim, so the box is taken
 * from the pixels at least half opaque.
 */
const LOGOS = [
  { year: 2025, from: "images/sponsors/jeroid-logo.png", to: "jeroid.png", light: true, keep: [[545, 140]] },
  { year: 2025, from: "images/sponsors/hb-logo.png", to: "hyperbridge.png" },
  { year: 2025, from: "images/sponsors/gidi-logo.png", to: "gidi.png", light: true, keep: [[700, 1800]] },
  { year: 2025, from: "images/sponsors/jupiter.png", to: "jupiter.png", light: true, keep: [[1670, 442]] },
  { year: 2025, from: "images/sponsors/hb.png", to: "huele-bien.png", light: true },
  { year: 2025, from: "images/sponsors/somnia.png", to: "somnia.png" },
  { year: 2025, from: "images/sponsors/avalanche.png", to: "avalanche.png" },
  { year: 2025, from: "images/sponsors/sui.png", to: "sui.png", light: true },
  { year: 2025, from: "images/community/web3bridge-logo.webp", to: "web3bridge.png", light: true },
  { year: 2025, from: "images/community/web3afrika-logo.png", to: "web3afrika.png", light: true },
  { year: 2025, from: "images/community/bchain-logo.png", to: "bchain.png" },
  { year: 2025, from: "images/community/wid-logo.png", to: "wid.png", light: true },
  { year: 2025, from: "images/community/web3unilag.png", to: "web3unilag.png" },
  { year: 2025, from: "images/community/dtcsi-logo.png", to: "dtcsi.png" },
  { year: 2025, from: "images/community/mgsweb3-logo.png", to: "mgsweb3.png", light: true },
  // Black wordmark: it was invisible on the old dark tiles, and is fine here.
  { year: 2025, from: "images/community/polkadot-logo.png", to: "polkadot-africa.png" },
  { year: 2025, from: "images/community/webnig.png", to: "web3nigeria.png", light: true },
  { year: 2025, from: "images/community/guild.png", to: "guild.png", solid: true },
  { year: 2025, from: "images/community/bnug.png", to: "bnug.png" },
  { year: 2025, from: "images/community/hive2.png", to: "inside-the-hive.png" },
  { year: 2025, from: "images/media/ifemedia.png", to: "ife-media.png", light: true },
  { year: 2025, from: "images/media/amd-logo.webp", to: "ambcrypto.png" },
  { year: 2025, from: "images/media/3FBA.png", to: "forex-blogger-ayo.png", trim: false },
  { year: 2025, from: "images/media/businessday.svg", to: "businessday.png" },
  { year: 2025, from: "images/media/guardian.svg", to: "guardian.png" },
  { year: 2025, from: "images/media/legit.svg", to: "legit.png" },
  { year: 2025, from: "images/media/Punch.svg", to: "punch.png" },
  { year: 2025, from: "images/media/tclogo.svg", to: "techcabal.png" },
  { year: 2025, from: "images/media/techpoint.svg", to: "techpoint.png" },
  { year: 2025, from: "images/media/mona.png", to: "mona.png", light: true },
  { year: 2025, from: "images/ecosystem/lsg2.png", to: "lagos-state.png" },
  { year: 2025, from: "images/ecosystem/gadget2.png", to: "igadgetmart.png" },
  { year: 2025, from: "images/ecosystem/siban.png", to: "siban.png" },
  { year: 2025, from: "images/ecosystem/fan.png", to: "fanyogo.png" },
  { year: 2025, from: "images/ecosystem/base.png", to: "base-west-africa.png", light: true },
  { year: 2026, from: "2026/sponsors/Monica.png", to: "monica.png" },
  { year: 2026, from: "2026/sponsors/rovv.png", to: "rovv.png" },
  { year: 2026, from: "2026/sponsors/hoaq.png", to: "hoaq.png" },
  { year: 2026, from: "2026/sponsors/reeva.PNG", to: "reeva.PNG" },
  { year: 2026, from: "2026/media/allconf.png", to: "allconfsbot.png" },
  { year: 2026, from: "2026/media/BMN.png", to: "blockchain-marketing-ninja.png" },
  { year: 2026, from: "2026/media/BSN.png", to: "blockchain-staffing-ninja.png" },
  { year: 2026, from: "2026/media/coingabbar.png", to: "coingabbar.png" },
  { year: 2026, from: "2026/media/Coinn.png", to: "coinnewsspan.png" },
  { year: 2026, from: "2026/media/Crypto.png", to: "cryptonewsz.png" },
  { year: 2026, from: "2026/media/timesoblock.png", to: "times-of-blockchain.png" },
  { year: 2026, from: "2026/partners/hashed-emergent.png", to: "hashed-emergent.png" },
  { year: 2026, from: "2026/partners/microtraction.png", to: "microtraction.png" },
];

/** The lightness of a light neutral pixel (white, light grey, cream), else 0. */
function lightNeutral(data, i) {
  if (data[i + 3] === 0) return 0;
  const r = data[i] / 255;
  const g = data[i + 1] / 255;
  const b = data[i + 2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Colour is left alone. Cream counts as neutral (Mona's wordmark).
  if (max - min > 0.2) return 0;
  const lightness = (max + min) / 2;
  return lightness > 0.5 ? lightness : 0;
}

/** The light region connected to each point, as a mask of pixels to keep. */
function keptRegions(data, width, height, points) {
  const kept = new Uint8Array(width * height);
  for (const [x, y] of points) {
    const start = y * width + x;
    if (!lightNeutral(data, start * 4)) {
      throw new Error(`keep point ${x},${y} is not on a light pixel`);
    }
    const stack = [start];
    kept[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const px = p % width;
      for (const next of [p - width, p + width, px > 0 ? p - 1 : -1, px < width - 1 ? p + 1 : -1]) {
        if (next < 0 || next >= kept.length || kept[next]) continue;
        if (!lightNeutral(data, next * 4)) continue;
        kept[next] = 1;
        stack.push(next);
      }
    }
  }
  return kept;
}

/**
 * Turns the light neutral pixels dark, lightest darkest, except the regions
 * `keep` points at. Dark neutrals already read on white and are left alone,
 * as is anything with colour.
 */
function darkenNeutrals(data, width, height, keep = []) {
  const kept = keptRegions(data, width, height, keep);
  for (let i = 0; i < data.length; i += 4) {
    if (kept[i / 4]) continue;
    const lightness = lightNeutral(data, i);
    if (!lightness) continue;
    // 1 becomes the ink, 0.5 stays a mid grey.
    const toWhite = 1 - lightness;
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.round(INK[c] + (255 - INK[c]) * toWhite);
    }
  }
  return data;
}

async function run() {
  for (const dir of Object.values(OUT)) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  }

  for (const logo of LOGOS) {
    const file = path.join(PUBLIC, logo.from);
    const svg = file.endsWith(".svg");
    let image = sharp(file, svg ? { density: 600 } : {}).ensureAlpha();

    if (logo.light) {
      const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });
      image = sharp(darkenNeutrals(data, info.width, info.height, logo.keep), {
        raw: { width: info.width, height: info.height, channels: 4 },
      });
    }

    let trimmed;
    if (logo.trim === false) {
      trimmed = await image.png().toBuffer();
    } else if (logo.solid) {
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
      const raw = { raw: { width: info.width, height: info.height, channels: 4 } };
      const mask = Buffer.from(data);
      for (let i = 3; i < mask.length; i += 4) if (mask[i] < 128) mask[i] = 0;
      const { info: box } = await sharp(mask, raw)
        .trim({ threshold: 8 })
        .toBuffer({ resolveWithObject: true });
      trimmed = await sharp(data, raw)
        .extract({
          left: -box.trimOffsetLeft,
          top: -box.trimOffsetTop,
          width: box.width,
          height: box.height,
        })
        .png()
        .toBuffer();
    } else {
      trimmed = await image.trim({ threshold: 8 }).png().toBuffer();
    }
    const out = path.join(OUT[logo.year], logo.to);
    const { width, height } = await sharp(trimmed)
      .resize({ width: 1280, height: 480, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toFile(out);
    console.log(
      `${out.replace(PUBLIC, "").padEnd(48)} width: ${width}, height: ${height}${logo.light ? "  (darkened)" : ""}`,
    );
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
