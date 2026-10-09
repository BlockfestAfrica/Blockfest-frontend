/**
 * Blockfest Africa 2026 DP, concept C: "New trade routes".
 *
 * The photo is the hub. Its ring is the mark's four colours in the mark's own
 * arrangement (pink top-left, blue top-right, teal bottom-left, yellow
 * bottom-right), and each colour runs out of its arc as a route, drawn in
 * transit-map grammar: 45 and 90 degree segments, one bend radius. Out at
 * the edges each route is a train of the mark's tiles, blocks that fuse into
 * one line on the way in. Every route ends at the person: the theme ("New
 * Trade Routes: Bringing Africa Onchain") said without a map.
 *
 * Mirror-symmetric left to right on purpose, never rotationally symmetric:
 * four bent arms in rotation read as a pinwheel.
 *
 * Pure canvas drawing, no React. Draws a 2160 square; a smaller canvas gets a
 * scaled copy. Where things go is decided in dp.ts (layoutFooter, layoutArt,
 * chooseNameLayout, photoRect); this file paints. It awaits its two faces
 * (Bebas Neue for the name and role, the site's Gotham for the small lines)
 * before drawing anything, and throws if either did not load, so a fallback
 * system font never ships in a DP.
 */
import {
  ART,
  DP_COLOR as COLOR,
  DP_SIZE,
  DP_THEME,
  FOOTER,
  NAME_MAX_W,
  chooseNameLayout,
  layoutArt,
  layoutFooter,
  photoRect,
  publicDayLines,
  roleCopy,
  type ArtLayout,
  type DPRole,
  type FooterLayout,
  type FooterTiers,
  type PhotoTransform,
} from "./dp";
import { DP_FONTS } from "./fonts";
import {
  DOT_ABOVE,
  MARK_SOURCES,
  PLAIN_CAPITAL,
  clusters as spell,
  letterNotes,
  markSource,
  type Cluster,
  type LetterNote,
} from "./letters";

/** Anything the canvas can draw that knows its own size. */
export type Bitmap = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export interface DPOptions {
  /** The person's photo, or null for the empty frame the page starts with. */
  photo: Bitmap | null;
  name: string;
  role: DPRole;
  photoTransform?: PhotoTransform;
  /** The name is a stand-in ("Your name"): drawn quieter. */
  ghostName?: boolean;
}

export interface DPAssets {
  /** The white mark for the navy ground (DP_LOGO_SRC). */
  logo: Bitmap;
  /** Who goes in the footer, from footerTiers. */
  tiers: FooterTiers;
  /**
   * Each footer logo as a bitmap, by name. The caller rasterises each at the
   * width x height recorded in lib/partners-2026 first (an SVG sized 100% has
   * no natural size of its own). A logo missing here is left out.
   */
  logos: Record<string, Bitmap>;
}

/** Where the photo frame landed, in the 2160 square: for dragging the photo. */
export interface DPResult {
  hub: { x: number; y: number };
  photoR: number;
}

const S = DP_SIZE;
const LINE = ART.line;
const BEND = 84; // one bend radius for every corner
const TRAIL_X = 424; // distance from the side edge where blocks fuse into line
const ROLE_SIZE = 106; // the role pill's text
const PILL_H = 136;
const DAY_SIZE = 36;
const DAY_PITCH = 58; // baseline to baseline
const LABEL_TRACK = 3.6; // the footer's small group labels

/* ------------------------------------------------------------------ */
/* Fonts                                                              */
/* ------------------------------------------------------------------ */

const DISPLAY = DP_FONTS.display;
const TEXT = DP_FONTS.text;

function primaryFamily(stack: string): string {
  return stack.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

const display = (size: number) => `400 ${size}px ${DISPLAY}`;
const text = (size: number) => `400 ${size}px ${TEXT}`;

const FIXED_DISPLAY = "BLOCKF3ST AFRICA 2026 I’M ATTENDING SPEAKING VOLUNTEERING PROUD PARTNER YOUR NAME .";

/**
 * Load both faces before any drawing. The person's name goes to
 * document.fonts.load as itself and as the letters actually drawn (accented
 * capitals recomposed, dots below taken out), and the accent sources go with
 * it, so every unicode-range file those letters live in (latin, latin-ext) is
 * fetched before the first measure.
 */
/** Every capital a mark may be borrowed from, and every plain stand-in. */
const BORROWED = [
  ...Object.values(MARK_SOURCES).flatMap((sources) => sources.map(([src]) => src)),
  ...Object.values(PLAIN_CAPITAL),
].join("");

async function ensureFonts(name: string): Promise<void> {
  const upper = name.toUpperCase().normalize("NFC");
  const bases = upper.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
  const small = [
    DP_THEME,
    ...publicDayLines().map((d) => `${d.when} · ${d.where}`),
    "HEADLINE SPONSOR ENDORSED BY ECOSYSTEM COMMUNITY MEDIA PARTNERS",
  ].join(" ");
  await Promise.all([
    document.fonts.load(display(120), FIXED_DISPLAY),
    document.fonts.load(display(120), upper || "A"),
    document.fonts.load(display(120), `${bases} ${BORROWED}`),
    document.fonts.load(text(40), small),
  ]);
  await document.fonts.ready;
  const loaded = new Set<string>();
  document.fonts.forEach((face) => {
    if (face.status === "loaded") loaded.add(face.family.replace(/['"]/g, ""));
  });
  const missing = [DISPLAY, TEXT]
    .map(primaryFamily)
    .filter((family) => !loaded.has(family));
  if (missing.length) {
    throw new Error(`DP fonts did not load: ${missing.join(", ")}`);
  }
}

/* ------------------------------------------------------------------ */
/* Primitives                                                         */
/* ------------------------------------------------------------------ */

type Pt = readonly [number, number];

/** A polyline whose corners are all the same radius. */
function tracePolyline(ctx: CanvasRenderingContext2D, pts: Pt[], r: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

/** Rounded rectangle path, corners [tl, tr, br, bl]; no ctx.roundRect needed. */
function tracePill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | [number, number, number, number],
) {
  const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl);
  else ctx.lineTo(x, y);
  ctx.closePath();
}

/** Letter-spaced text without ctx.letterSpacing (older Safari lacks it). */
function trackedWidth(ctx: CanvasRenderingContext2D, s: string, track: number) {
  let w = 0;
  for (const ch of s) w += ctx.measureText(ch).width;
  return w + track * Math.max(0, [...s].length - 1);
}

/** Draws `s` letter-spaced from x (left edge); returns where it ended. */
function fillTrackedFrom(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  baseline: number,
  track: number,
) {
  ctx.textAlign = "left";
  for (const ch of s) {
    ctx.fillText(ch, x, baseline);
    x += ctx.measureText(ch).width + track;
  }
  return x;
}

function fillTracked(
  ctx: CanvasRenderingContext2D,
  s: string,
  cx: number,
  baseline: number,
  track: number,
) {
  const w = trackedWidth(ctx, s, track);
  fillTrackedFrom(ctx, s, cx - w / 2, baseline, track);
  return w;
}

function capHeight(ctx: CanvasRenderingContext2D) {
  return ctx.measureText("H").actualBoundingBoxAscent;
}

function bitmapSize(img: Bitmap): [number, number] {
  if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) {
    return [img.naturalWidth || img.width, img.naturalHeight || img.height];
  }
  return [img.width, img.height];
}

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

interface Route {
  color: string;
  arcDeg: number; // centre of its quadrant arc (canvas angles: 90 = down)
  pts: Pt[]; // the solid run, from the ring out to where the blocks begin
  side: -1 | 1; // which edge it arrives from
  y: number; // the level its blocks travel on
}

function routes(art: ArtLayout): Route[] {
  const { hub, ringR } = art;
  const ringPoint = (deg: number): Pt => {
    const a = (deg * Math.PI) / 180;
    return [hub.x + ringR * Math.cos(a), hub.y + ringR * Math.sin(a)];
  };
  const highY = hub.y - ringR + 2; // where the upper routes level out
  const lowY = hub.y + ringR + 14; // where the lower routes level out
  const tl = ringPoint(225);
  const tr = ringPoint(315);
  const bl = ringPoint(135);
  const br = ringPoint(45);

  // Every route leaves its arc on the 45 degree diagonal, then levels out
  // towards the side of the frame: from each side, two routes converge on
  // the hub.
  const tlBend: Pt = [tl[0] - (tl[1] - highY), highY];
  const blBend: Pt = [bl[0] - (lowY - bl[1]), lowY];

  return [
    { color: COLOR.pink, arcDeg: 225, side: -1, y: highY, pts: [tl, tlBend, [TRAIL_X, highY]] },
    { color: COLOR.blue, arcDeg: 315, side: 1, y: highY, pts: [tr, [S - tlBend[0], highY], [S - TRAIL_X, highY]] },
    { color: COLOR.teal, arcDeg: 135, side: -1, y: lowY, pts: [bl, blBend, [TRAIL_X, lowY]] },
    { color: COLOR.yellow, arcDeg: 45, side: 1, y: lowY, pts: [br, [S - blBend[0], lowY], [S - TRAIL_X, lowY]] },
  ];
}

/* ------------------------------------------------------------------ */
/* Layers                                                             */
/* ------------------------------------------------------------------ */

function drawGround(ctx: CanvasRenderingContext2D, art: ArtLayout) {
  ctx.fillStyle = COLOR.ground;
  ctx.fillRect(0, 0, S, S);
  // A low light behind the hub; the corners sink to the control tone.
  const g = ctx.createRadialGradient(art.hub.x, art.hub.y, 0, art.hub.x, art.hub.y, 1500);
  g.addColorStop(0, "#132A4E");
  g.addColorStop(0.42, "#0C1C36");
  g.addColorStop(1, COLOR.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

function drawRoutes(ctx: CanvasRenderingContext2D, rs: Route[]) {
  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.lineWidth = LINE;
  for (const r of rs) {
    ctx.strokeStyle = r.color;
    tracePolyline(ctx, r.pts, BEND);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRing(ctx: CanvasRenderingContext2D, rs: Route[], art: ArtLayout) {
  // Four arcs with a gap at each cardinal point, as the mark's four tiles
  // are separated by a gutter.
  const gap = 34 / art.ringR; // ~34px of navy at each cardinal point
  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineWidth = LINE;
  for (const r of rs) {
    const c = (r.arcDeg * Math.PI) / 180;
    ctx.strokeStyle = r.color;
    ctx.beginPath();
    ctx.arc(art.hub.x, art.hub.y, art.ringR, c - Math.PI / 4 + gap / 2, c + Math.PI / 4 - gap / 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Each route arrives from beyond the frame as a train of the mark's tiles
 * (the square with its leading side rounded, the "D" of the pink and blue
 * tiles), facing the hub and fading with distance, then fuses into one solid
 * line for the run into Lagos: trade arriving as blocks, Africa onchain.
 */
function drawTrails(ctx: CanvasRenderingContext2D, rs: Route[]) {
  const size = 44;
  const pitch = size + 18;
  const r = size * 0.46;
  ctx.save();
  for (const route of rs) {
    ctx.fillStyle = route.color;
    for (let i = 0; ; i++) {
      // Distance of this tile's centre from the side edge.
      const d = TRAIL_X - 18 - size / 2 - i * pitch;
      if (d < -size) break;
      const x = route.side < 0 ? d : S - d;
      ctx.globalAlpha = Math.max(0.14, 1 - i * 0.135);
      tracePill(
        ctx,
        x - size / 2,
        route.y - size / 2,
        size,
        size,
        route.side < 0 ? [0, r, r, 0] : [r, 0, 0, r],
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  art: ArtLayout,
  photo: Bitmap | null,
  t: PhotoTransform | undefined,
) {
  const { hub, photoR } = art;
  const frame = photoR * 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hub.x, hub.y, photoR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = COLOR.deep;
  ctx.fill();
  ctx.clip();
  if (photo) {
    const [iw, ih] = bitmapSize(photo);
    const r = photoRect(iw, ih, frame, t);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, hub.x - photoR + r.x, hub.y - photoR + r.y, r.w, r.h);
  } else {
    // The empty frame: a quiet head and shoulders in the ground's own blues.
    ctx.fillStyle = "#132A4E";
    ctx.beginPath();
    ctx.arc(hub.x, hub.y - photoR * 0.2, photoR * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hub.x, hub.y + photoR * 0.86, photoR * 0.62, photoR * 0.56, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}

function drawMasthead(ctx: CanvasRenderingContext2D, art: ArtLayout, logo: Bitmap) {
  const { x, y, w, h } = art.logo;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, x, y, w, h);

  ctx.font = text(27);
  ctx.fillStyle = COLOR.ink3;
  ctx.textBaseline = "alphabetic";
  fillTracked(ctx, DP_THEME, S / 2, art.themeBaseline, 5.2);
}

/* ------------------------------------------------------------------ */
/* The name                                                           */
/* ------------------------------------------------------------------ */

/**
 * Whether the display face itself has a glyph for `s` (one character). With
 * two different generic fallbacks behind it, a glyph Bebas lacks measures
 * differently in each; one it has measures the same.
 */
const glyphSeen = new Map<string, boolean>();
function hasGlyph(ctx: CanvasRenderingContext2D, s: string): boolean {
  const seen = glyphSeen.get(s);
  if (seen !== undefined) return seen;
  const family = `"${primaryFamily(DISPLAY)}"`;
  const saved = ctx.font;
  ctx.font = `400 100px ${family}, monospace`;
  const a = ctx.measureText(s).width;
  ctx.font = `400 100px ${family}, serif`;
  const b = ctx.measureText(s).width;
  ctx.font = saved;
  const ok = Math.abs(a - b) < 0.01;
  glyphSeen.set(s, ok);
  return ok;
}

/**
 * A line split into the face's own letters (see letters.ts): accented
 * capitals recomposed where Bebas has them, dots below and borrowed accents
 * set apart, letters it lacks set as their plain stand-in or left out.
 */
const clusters = (ctx: CanvasRenderingContext2D, line: string): Cluster[] =>
  spell(line, (ch) => hasGlyph(ctx, ch));

/** What Bebas actually draws for a line: base letters, no loose marks. */
const drawable = (ctx: CanvasRenderingContext2D, line: string) =>
  clusters(ctx, line)
    .map((c) => c.glyph)
    .join("");

/** Ink above and below the baseline for one line, in the current font. */
function lineInk(ctx: CanvasRenderingContext2D, line: string, size: number) {
  const cs = clusters(ctx, line);
  const m = ctx.measureText(cs.map((c) => c.glyph).join(""));
  let ascent = Math.max(m.actualBoundingBoxAscent, capHeight(ctx));
  let descent = Math.max(0, m.actualBoundingBoxDescent);
  const dotH = ctx.measureText(".").actualBoundingBoxAscent;
  for (const c of cs) {
    if (c.dotBelow) descent = Math.max(descent, size * 0.06 + dotH);
    if (c.above.length) {
      const top = c.above.reduce((y, mark) => y + markHeight(ctx, mark, size), glyphTop(ctx, c.glyph));
      ascent = Math.max(ascent, top);
    }
  }
  return { ascent, descent };
}

/** Height above the baseline of the top of a letter. */
const glyphTop = (ctx: CanvasRenderingContext2D, g: string) =>
  ctx.measureText(g).actualBoundingBoxAscent;

/** How far a borrowed mark rises: its own height plus the face's gap. */
function markHeight(ctx: CanvasRenderingContext2D, mark: string, size: number) {
  const source = markSource(mark, (ch) => hasGlyph(ctx, ch));
  if (source) return glyphTop(ctx, source[0]) - glyphTop(ctx, source[1]);
  if (mark === DOT_ABOVE) return size * 0.06 + ctx.measureText(".").actualBoundingBoxAscent;
  return 0;
}

/** Draws one borrowed mark centred at x, resting `floor` above the baseline. */
function fillMark(
  ctx: CanvasRenderingContext2D,
  mark: string,
  x: number,
  baseline: number,
  floor: number,
  size: number,
) {
  const source = markSource(mark, (ch) => hasGlyph(ctx, ch));
  ctx.save();
  ctx.textAlign = "center";
  if (source) {
    // Bebas's own accent, from a capital that has it (Ǒ's caron from Ě),
    // clipped to what sits above that capital's base letter and lifted so it
    // sits as high above this letter as it does above its own.
    const [src, srcBase] = source;
    const baseTop = glyphTop(ctx, srcBase);
    const lift = floor - baseTop;
    ctx.beginPath();
    ctx.rect(x - size, baseline - lift - size * 2, size * 2, size * 2 - baseTop - 1);
    ctx.clip();
    ctx.fillText(src, x, baseline - lift);
  } else if (mark === DOT_ABOVE) {
    ctx.fillText(".", x, baseline - floor - size * 0.06);
  }
  ctx.restore();
}

function fillName(
  ctx: CanvasRenderingContext2D,
  line: string,
  cx: number,
  baseline: number,
  size: number,
) {
  const cs = clusters(ctx, line);
  const t = cs.map((c) => c.glyph).join("");
  const x0 = cx - ctx.measureText(t).width / 2;
  ctx.textAlign = "left";
  ctx.fillText(t, x0, baseline);
  const dotH = ctx.measureText(".").actualBoundingBoxAscent;
  let prefix = "";
  for (const c of cs) {
    if (!c.glyph) continue; // a letter the face cannot draw is left out
    const x = x0 + ctx.measureText(prefix).width + ctx.measureText(c.glyph).width / 2;
    if (c.dotBelow) {
      ctx.textAlign = "center";
      ctx.fillText(".", x, baseline + size * 0.06 + dotH);
      ctx.textAlign = "left";
    }
    let floor = glyphTop(ctx, c.glyph);
    for (const mark of c.above) {
      fillMark(ctx, mark, x, baseline, floor, size);
      floor += markHeight(ctx, mark, size);
    }
    prefix += c.glyph;
  }
}

/**
 * The letters of a name the face cannot set as typed, each with what is
 * drawn instead (null: nothing, the page then holds the download back), so
 * the page can say so. Empty for nearly every name.
 */
export async function nameSubstitutions(name: string): Promise<LetterNote[]> {
  await ensureFonts(name);
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [];
  ctx.font = display(100);
  return letterNotes(name, (ch) => hasGlyph(ctx, ch));
}

/* ------------------------------------------------------------------ */
/* Footer                                                             */
/* ------------------------------------------------------------------ */

/**
 * A logo bitmap can be many times the size it is drawn at (Cake Wallet's is
 * 5000 wide, drawn at about 240), and one big step down aliases in some
 * browsers. Halve it until the last step is 2x or less. Cached, so a live
 * preview redrawn on every drag does this once per logo and size.
 */
const stepCache = new WeakMap<object, Map<string, CanvasImageSource>>();
function steppedDown(img: Bitmap, w: number, h: number): CanvasImageSource {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  let byKey = stepCache.get(img);
  const hit = byKey?.get(key);
  if (hit) return hit;
  let [sw, sh] = bitmapSize(img);
  let src: CanvasImageSource = img;
  while (sw / 2 >= w && sh / 2 >= h) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(sw / 2);
    c.height = Math.ceil(sh / 2);
    const g = c.getContext("2d");
    if (!g) break;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, c.width, c.height);
    src = c;
    sw = c.width;
    sh = c.height;
  }
  if (!byKey) {
    byKey = new Map();
    stepCache.set(img, byKey);
  }
  byKey.set(key, src);
  return src;
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  f: FooterLayout,
  logos: Record<string, Bitmap>,
) {
  if (f.top >= S) return;
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, f.top, S, S - f.top);

  const scale = ctx.getTransform().a; // device pixels per 2160-space unit
  const place = (p: FooterLayout["sponsors"][number]) => {
    const img = logos[p.logo.name];
    if (!img) return;
    const src = steppedDown(img, p.w * scale, p.h * scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, p.x, p.y, p.w, p.h);
  };

  ctx.fillStyle = COLOR.paperInk;
  ctx.textBaseline = "alphabetic";
  if (f.headlineLabel) {
    ctx.font = text(FOOTER.headLabelSize);
    fillTracked(ctx, f.headlineLabel.text, f.headlineLabel.cx, f.headlineLabel.baseline, 4);
  }
  f.sponsors.forEach(place);

  ctx.strokeStyle = COLOR.paperLine;
  ctx.lineWidth = 2;
  if (f.divider) {
    ctx.beginPath();
    ctx.moveTo(f.divider.x1, f.divider.y);
    ctx.lineTo(f.divider.x2, f.divider.y);
    ctx.stroke();
  }
  for (const s of f.separators) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y1);
    ctx.lineTo(s.x, s.y2);
    ctx.stroke();
  }

  ctx.font = text(FOOTER.groupLabelSize);
  ctx.fillStyle = COLOR.paperInk;
  for (const l of f.labels) fillTracked(ctx, l.text, l.cx, l.baseline, LABEL_TRACK);
  f.partners.forEach(place);
}

/** Footer tiers with only the logos that arrived as bitmaps. */
function present(tiers: FooterTiers, logos: Record<string, Bitmap>): FooterTiers {
  const has = (l: { name: string }) => !!logos[l.name];
  return {
    headline: tiers.headline && has(tiers.headline) ? tiers.headline : null,
    sponsors: tiers.sponsors.filter(has),
    groups: tiers.groups
      .map((g) => ({ ...g, logos: g.logos.filter(has) }))
      .filter((g) => g.logos.length),
  };
}

/* ------------------------------------------------------------------ */
/* drawDP                                                             */
/* ------------------------------------------------------------------ */

export async function drawDP(
  ctx: CanvasRenderingContext2D,
  opts: DPOptions,
  assets: DPAssets,
): Promise<DPResult> {
  await ensureFonts(opts.name);

  ctx.save();
  const k = ctx.canvas.width / S;
  ctx.setTransform(k, 0, 0, k, 0, 0);

  // The footer first: how tall it is decides how large the art can be.
  const footer = layoutFooter(present(assets.tiers, assets.logos), (label, size) => {
    ctx.font = text(size);
    return trackedWidth(ctx, label, LABEL_TRACK);
  });
  const [lw, lh] = bitmapSize(assets.logo);
  const art = layoutArt(footer.top, lw && lh ? lw / lh : 667 / 164);

  const rs = routes(art);
  drawGround(ctx, art);
  drawRoutes(ctx, rs);
  drawRing(ctx, rs, art);
  drawTrails(ctx, rs);
  drawPhoto(ctx, art, opts.photo, opts.photoTransform);
  drawMasthead(ctx, art, assets.logo);

  /* Text block: role, name, the public days, centred in the art's zone. */
  const role = roleCopy(opts.role);

  ctx.font = display(ROLE_SIZE);
  const roleCap = capHeight(ctx);
  const roleTrack = 6;
  const roleW = trackedWidth(ctx, role.line, roleTrack);
  const pillW = roleW + 128;

  const days = publicDayLines();
  ctx.font = text(DAY_SIZE);
  const dayCap = capHeight(ctx);
  const daysH = days.length ? dayCap + DAY_PITCH * (days.length - 1) : 0;

  // One rhythm from the ring down: ring, pill, name, days, footer.
  const g1 = 40; // pill to the top of the name's ink (accents included)
  const g2 = days.length ? 42 : 0; // bottom of the name's ink to the days
  const { zoneTop, zoneBottom } = art;

  // The height the name has: the zone, less the pill, the days and the gaps.
  const room = zoneBottom - zoneTop - (PILL_H + g1 + g2 + daysH);

  // A name's real ink, as fractions of its size: accents above the first
  // line, dots below the last, and a line pitch that keeps one line's dots
  // clear of the next line's accents.
  const inkOf = (lines: string[]) => {
    ctx.font = display(100);
    const inks = lines.map((l) => lineInk(ctx, l, 100));
    let lead = 0.94;
    for (let i = 0; i + 1 < inks.length; i++) {
      lead = Math.max(lead, (inks[i].descent + inks[i + 1].ascent) / 100 + 0.08);
    }
    const top = inks[0].ascent / 100;
    return { top, lead, perSize: top + lead * (lines.length - 1) + inks[inks.length - 1].descent / 100 };
  };

  // One line or two, each compared at the size the room really lets it take.
  ctx.font = display(100);
  const name = chooseNameLayout(
    opts.name,
    (line) => ctx.measureText(drawable(ctx, line)).width,
    NAME_MAX_W,
    (lines) => Math.floor(room / inkOf(lines).perSize),
  );
  const { top: topRatio, lead: leadRatio, perSize } = inkOf(name.lines);

  // A safety net: the chooser already kept the name inside the room.
  name.size = Math.max(40, Math.min(name.size, Math.floor(room / perSize)));

  const nameTop = name.size * topRatio;
  const nameLead = name.size * leadRatio;
  const nameH = name.size * perSize;

  const blockH = PILL_H + g1 + nameH + g2 + daysH;
  let y = zoneTop + Math.max(0, (zoneBottom - zoneTop - blockH) / 2);

  // Role pill: the loudest thing after the face, since it is what still
  // reads in a 48px avatar.
  ctx.fillStyle = role.fill;
  tracePill(ctx, S / 2 - pillW / 2, y, pillW, PILL_H, PILL_H / 2);
  ctx.fill();
  ctx.font = display(ROLE_SIZE);
  ctx.fillStyle = role.text;
  ctx.textBaseline = "alphabetic";
  fillTracked(ctx, role.line, S / 2, y + PILL_H / 2 + roleCap / 2, roleTrack);
  y += PILL_H + g1;

  // Name
  ctx.font = display(name.size);
  ctx.fillStyle = opts.ghostName ? COLOR.ink3 : COLOR.ink;
  name.lines.forEach((line, i) => {
    fillName(ctx, line, S / 2, y + nameTop + i * nameLead, name.size);
  });
  y += nameH + g2;

  // The public days, each with its venue. One left edge for both lines so
  // the dates sit in a column; the pair is centred as a block.
  if (days.length) {
    ctx.font = text(DAY_SIZE);
    const track = 3.4;
    const sep = "  ·  ";
    const widths = days.map((d) => trackedWidth(ctx, `${d.when}${sep}${d.where}`, track));
    const x0 = S / 2 - Math.max(...widths) / 2;
    days.forEach((d, i) => {
      const baseline = y + dayCap + i * DAY_PITCH;
      ctx.fillStyle = COLOR.ink;
      let x = fillTrackedFrom(ctx, d.when, x0, baseline, track);
      ctx.fillStyle = COLOR.ink3;
      x = fillTrackedFrom(ctx, sep, x, baseline, track);
      ctx.fillStyle = COLOR.ink2;
      fillTrackedFrom(ctx, d.where, x, baseline, track);
    });
  }

  drawFooter(ctx, footer, assets.logos);

  ctx.restore();
  return { hub: art.hub, photoR: art.photoR };
}
