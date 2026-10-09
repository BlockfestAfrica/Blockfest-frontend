/**
 * The Get DP picture's rules, as plain data and arithmetic.
 *
 * No canvas, no DOM and no React here, so every decision the picture makes
 * (what each role says and in which colour, how a name breaks, where each
 * logo goes, how a photo is cropped, what the share text and file name are)
 * runs in a unit test. draw.ts only paints what this module decides.
 *
 * Everything is in the picture's own space: a 2160 square.
 */
import { blockfest2026Lagos, type PublicDay } from "@/lib/events";
import type {
  Partner,
  PartnerKind,
  PartnerLogo,
  Sponsor,
} from "@/lib/partners-2026";

export const DP_SIZE = 2160;
/** The live preview is drawn at half size while editing; downloads at full. */
export const PREVIEW_SIZE = 1080;

/**
 * The 2026 mark, white for the navy ground: the transparent cut-out until the
 * official file arrives. Swapping it is this one line; the drawing reads the
 * file's own proportions.
 */
export const DP_LOGO_SRC = "/images/getdp/2026/logo-dark.png";

export const GETDP_URL = "https://blockfestafrica.com/getdp";
export const HASHTAG = "#Blockfest2026";

const EVENT = blockfest2026Lagos;
const EVENT_NAME = `Blockfest Africa ${EVENT.year}`;
/** The edition's theme, the line under the mark. */
export const DP_THEME = EVENT.tagline.toUpperCase();

/* ------------------------------------------------------------------ */
/* Palette: sampled from the mark and app/globals.css.                 */
/* ------------------------------------------------------------------ */

export const DP_COLOR = {
  ground: "#0A1628", // --color-ground
  deep: "#071021", // --color-control, the one surface below the ground
  pink: "#F12D5B",
  blue: "#1B64E4",
  teal: "#1BBE9F",
  yellow: "#F0C224",
  ink: "#FFFFFF",
  ink2: "rgba(255,255,255,0.78)",
  ink3: "rgba(255,255,255,0.60)",
  paper: "#F3F5F9",
  /** Small labels on the paper footer. */
  paperInk: "rgba(10,22,40,0.58)",
  paperLine: "rgba(10,22,40,0.14)",
} as const;

/* ------------------------------------------------------------------ */
/* Roles                                                              */
/* ------------------------------------------------------------------ */

export type DPRole = "attendee" | "speaker" | "volunteer" | "partner";

export const DP_ROLES: readonly DPRole[] = [
  "attendee",
  "speaker",
  "volunteer",
  "partner",
];

export interface RoleCopy {
  /** The choice on the page. */
  label: string;
  /** What the pill on the picture says. */
  line: string;
  /** The pill's colour, one of the mark's four. */
  fill: string;
  /** The pill's text: white on blue and pink, navy on teal and yellow. */
  text: string;
  /** How the share text opens. */
  share: string;
}

const ROLE_COPY: Record<DPRole, RoleCopy> = {
  attendee: {
    label: "Attending",
    line: "I’M ATTENDING",
    fill: DP_COLOR.blue,
    text: DP_COLOR.ink,
    share: "I'm attending",
  },
  speaker: {
    label: "Speaking",
    line: "I’M SPEAKING",
    fill: DP_COLOR.pink,
    text: DP_COLOR.ink,
    share: "I'm speaking at",
  },
  volunteer: {
    label: "Volunteering",
    line: "I’M VOLUNTEERING",
    fill: DP_COLOR.teal,
    text: DP_COLOR.ground,
    share: "I'm volunteering at",
  },
  partner: {
    label: "Partner",
    line: "PROUD PARTNER",
    fill: DP_COLOR.yellow,
    text: DP_COLOR.ground,
    share: "Proud partner of",
  },
};

export function roleCopy(role: DPRole): RoleCopy {
  return ROLE_COPY[role];
}

/* ------------------------------------------------------------------ */
/* Public days                                                        */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-10-22" as numbers, read as written: a Lagos calendar day, no clock. */
function calendarDay(iso: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Not a calendar day: ${iso}`);
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

/** The public days on the picture. Never the private mixer. */
export const DP_DAYS: readonly PublicDay[] = EVENT.publicDays ?? [];

export interface DayLine {
  /** "22 OCT" */
  when: string;
  /** "IBIS HOTEL, LEKKI" */
  where: string;
}

/**
 * The public days as stops on one line, each with its venue's short name:
 * "22 OCT  IBIS HOTEL, LEKKI", "23 OCT  NATIONAL ART THEATRE". The owner
 * wanted both days on a single line (9 October); the year and the fuller
 * addresses are on the page and in the share text.
 */
export function publicDayLines(days: readonly PublicDay[] = DP_DAYS): DayLine[] {
  return days.map((d) => {
    const { month, day } = calendarDay(d.date);
    return {
      when: `${day} ${MONTHS[month].slice(0, 3).toUpperCase()}`,
      where: d.short.toUpperCase(),
    };
  });
}

/** "22–23 October", or "31 October – 1 November" across a month end. */
export function publicDaysRange(days: readonly PublicDay[] = DP_DAYS): string {
  if (!days.length) return "";
  const first = calendarDay(days[0].date);
  const last = calendarDay(days[days.length - 1].date);
  if (days.length === 1) return `${first.day} ${MONTHS[first.month]}`;
  if (first.month === last.month) {
    return `${first.day}–${last.day} ${MONTHS[first.month]}`;
  }
  return `${first.day} ${MONTHS[first.month]} – ${last.day} ${MONTHS[last.month]}`;
}

/* ------------------------------------------------------------------ */
/* Sharing                                                            */
/* ------------------------------------------------------------------ */

export function shareText(
  role: DPRole,
  days: readonly PublicDay[] = DP_DAYS,
): string {
  const when = publicDaysRange(days);
  const where = `in ${EVENT.location.city}${when ? `, ${when}` : ""}`;
  return `${ROLE_COPY[role].share} ${EVENT_NAME} ${where}. Get your DP: ${GETDP_URL} ${HASHTAG}`;
}

export function xIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/** Letters NFD cannot take apart, written the nearest plain way. */
const PLAIN: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  þ: "th",
  ł: "l",
  ı: "i",
  ɓ: "b",
  ɗ: "d",
  ƙ: "k",
  ƴ: "y",
  ŋ: "n",
  ɛ: "e",
  ɔ: "o",
  ə: "e",
  ǝ: "e",
  ɖ: "d",
  ƒ: "f",
  ɣ: "g",
  ʃ: "s",
  ʒ: "z",
  ɲ: "n",
  ƥ: "p",
  ƭ: "t",
  ɨ: "i",
  ʉ: "u",
  ʌ: "v",
};

const SLUG_MAX = 40;

/**
 * blockfest-2026-dp-ada-obi.png: plain letters, short, never empty. A phone's
 * share list gets the same name as a .jpg.
 */
export function dpFileName(name: string, ext: "png" | "jpg" = "png"): string {
  const plain = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/./gu, (ch) => PLAIN[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let slug = plain.slice(0, SLUG_MAX);
  // Cut at a word if the name ran long, not in the middle of one.
  if (plain.length > SLUG_MAX && plain[SLUG_MAX] !== "-" && slug.includes("-")) {
    slug = slug.slice(0, slug.lastIndexOf("-"));
  }
  slug = slug.replace(/-+$/g, "");
  return `blockfest-${EVENT.year}-dp${slug ? `-${slug}` : ""}.${ext}`;
}

/* ------------------------------------------------------------------ */
/* The name                                                           */
/* ------------------------------------------------------------------ */

export const NAME_MIN = 2;
export const NAME_MAX = 50;

/** One space between words, composed accents, no edges. */
export function tidyName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** What the picture's lettering can set: Latin letters and their marks. */
const DRAWABLE = /^[\p{Script=Latin}\p{M}0-9 .'’‘-]$/u;

/**
 * Why a name cannot go on the picture yet, in words for the person typing
 * it, or null when it can. Length is counted in letters as written, so an
 * accented letter counts once.
 */
export function nameLength(raw: string): number {
  return [...tidyName(raw).replace(/\p{M}/gu, "")].length;
}

export function nameProblem(raw: string): string | null {
  const name = tidyName(raw);
  const length = nameLength(name);
  if (!length) return "Enter your name as you want it on the picture.";
  if (length < NAME_MIN) return `Your name needs at least ${NAME_MIN} letters.`;
  // The same words at 51 letters as at 60: the page says this in an alert,
  // and a sentence that changed with every key would be read out each time.
  if (length > NAME_MAX) return `Keep it to ${NAME_MAX} letters or fewer.`;
  const odd = [...new Set([...name].filter((ch) => !DRAWABLE.test(ch)))];
  if (odd.length) {
    const shown = odd.slice(0, 3).join(" ");
    return `The picture's lettering cannot draw ${shown}. Use letters, spaces, hyphens and apostrophes.`;
  }
  if (!/\p{L}/u.test(name)) return "Your name needs at least one letter.";
  return null;
}

/**
 * The name as the picture can set it while it is still being typed: letters
 * the lettering cannot draw left out, cut at NAME_MAX. Empty means "show the
 * stand-in".
 */
export function drawableName(raw: string): string {
  let letters = 0;
  const kept = [...tidyName(raw)].filter((ch) => {
    if (!DRAWABLE.test(ch)) return false;
    if (/\p{M}/u.test(ch)) return letters > 0 && letters <= NAME_MAX;
    letters += 1;
    return letters <= NAME_MAX;
  });
  return tidyName(kept.join(""));
}

export interface NameLayout {
  lines: string[];
  size: number;
}

/** Keeps the name well inside the circle crop. */
export const NAME_MAX_W = 1560;
const ONE_LINE_MAX = 196;
const TWO_LINE_MAX = 156;

/**
 * The largest size that fits NAME_MAX_W. One line up to 196px; when one line
 * would drop below 150px, a two-line break (at a space, or after a hyphen)
 * wins if it is clearly larger. Among breaks that reach the same size the
 * most even pair of lines wins ("CHIMAMANDA NGOZI / ADICHIE-OKONKWO", not
 * "CHIMAMANDA / NGOZI ADICHIE-OKONKWO"). Never clips: one 50-letter word just
 * shrinks until it fits.
 *
 * `widthAt100` is the width of a line set at 100px; draw.ts measures it in
 * the display face, a test passes any consistent ruler.
 *
 * `maxForHeight` is the largest size those lines can take in the height the
 * picture has for the name. Two lines need well over twice one line's
 * height, so without it a two-line break could "win" at a size the picture
 * then has to shrink it from, and come out smaller than one line would have
 * been. With it, every candidate is compared at the size it will really get.
 */
export function chooseNameLayout(
  raw: string,
  widthAt100: (line: string) => number,
  maxW: number = NAME_MAX_W,
  maxForHeight: (lines: string[]) => number = () => Infinity,
): NameLayout {
  const t = tidyName(raw).toUpperCase().normalize("NFC");
  const fit = (lines: string[], cap: number) =>
    Math.min(
      cap,
      maxForHeight(lines),
      Math.floor((100 * maxW) / Math.max(1, ...lines.map(widthAt100))),
    );

  const one = fit([t], ONE_LINE_MAX);
  let two: (NameLayout & { skew: number }) | null = null;
  for (let i = 1; i < t.length - 1; i++) {
    let cand: string[] | null = null;
    if (t[i] === " ") cand = [t.slice(0, i), t.slice(i + 1)];
    else if (t[i] === "-") cand = [t.slice(0, i + 1), t.slice(i + 1)];
    if (!cand || !cand[0].trim() || !cand[1].trim()) continue;
    const size = fit(cand, TWO_LINE_MAX);
    const skew = Math.abs(widthAt100(cand[0]) - widthAt100(cand[1]));
    if (!two || size > two.size || (size === two.size && skew < two.skew)) {
      two = { lines: cand, size, skew };
    }
  }
  if (one >= 150 || !two || two.size <= one * 1.12) return { lines: [t], size: one };
  return { lines: two.lines, size: two.size };
}

/* ------------------------------------------------------------------ */
/* The photo crop                                                     */
/* ------------------------------------------------------------------ */

/** zoom >= 1; offsets are fractions of the photo frame's width and height. */
export interface PhotoTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/** Where, down a portrait photo, the frame centres by default. */
export const FACE_Y = 0.39;
export const ZOOM_MAX = 3;

/** How far the photo can move each way and still cover the frame. */
export function cropLimits(
  iw: number,
  ih: number,
  zoom: number,
): { maxX: number; maxY: number } {
  const z = Math.min(ZOOM_MAX, Math.max(1, zoom));
  const a = iw / ih;
  return {
    maxX: (z * Math.max(1, a) - 1) / 2,
    maxY: (z * Math.max(1, 1 / a) - 1) / 2,
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));

export function clampTransform(
  t: PhotoTransform,
  iw: number,
  ih: number,
): PhotoTransform {
  const zoom = clamp(t.zoom, 1, ZOOM_MAX);
  const { maxX, maxY } = cropLimits(iw, ih, zoom);
  return {
    zoom,
    offsetX: clamp(t.offsetX, -maxX, maxX),
    offsetY: clamp(t.offsetY, -maxY, maxY),
  };
}

/**
 * The crop a photo starts with. A portrait photo is cropped about a point
 * FACE_Y of the way down rather than half way, so a 9:16 selfie keeps the
 * whole head instead of losing the top of it. A square or landscape photo has
 * no spare height, so it stays centred.
 */
export function defaultTransform(iw: number, ih: number): PhotoTransform {
  const h = Math.max(1, ih / iw); // the photo's height, in frames, at zoom 1
  return clampTransform(
    { zoom: 1, offsetX: 0, offsetY: (0.5 - FACE_Y) * h },
    iw,
    ih,
  );
}

/** Moves the photo by a fraction of the frame, never off the frame. */
export function nudgeTransform(
  t: PhotoTransform,
  dx: number,
  dy: number,
  iw: number,
  ih: number,
): PhotoTransform {
  return clampTransform(
    { ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy },
    iw,
    ih,
  );
}

/**
 * Where the photo is drawn, relative to the frame's top-left corner, for a
 * frame `frame` across. Always covers the frame.
 */
export function photoRect(
  iw: number,
  ih: number,
  frame: number,
  t?: PhotoTransform,
): { x: number; y: number; w: number; h: number } {
  const c = clampTransform(t ?? defaultTransform(iw, ih), iw, ih);
  const scale = Math.max(frame / iw, frame / ih) * c.zoom;
  const w = iw * scale;
  const h = ih * scale;
  return {
    x: (frame - w) / 2 + c.offsetX * frame,
    y: (frame - h) / 2 + c.offsetY * frame,
    w,
    h,
  };
}

/** The point of the photo at the frame's centre, as fractions across and down. */
export function cropCentre(
  iw: number,
  ih: number,
  t?: PhotoTransform,
): { x: number; y: number } {
  const r = photoRect(iw, ih, 1, t);
  return { x: (0.5 - r.x) / r.w, y: (0.5 - r.y) / r.h };
}

/* ------------------------------------------------------------------ */
/* Footer tiers, from lib/partners-2026                                */
/* ------------------------------------------------------------------ */

export interface FooterLogo {
  name: string;
  /** What the browser loads: the logo's path, or an SVG made drawable. */
  src: string;
  width: number;
  height: number;
}

export interface FooterGroup {
  kind: PartnerKind;
  /** The small line over the group: "ENDORSED BY", or empty for none. */
  label: string;
  logos: FooterLogo[];
}

export interface FooterTiers {
  /** Centred in the first row, the one logo a circle crop keeps. */
  headline: FooterLogo | null;
  /** Either side of the headline, in their listed order, ecosystem
      partners last. */
  sponsors: FooterLogo[];
  /** The smaller second row, in this order of kinds. */
  groups: FooterGroup[];
}

/* Ecosystem partners are not a group of their own: they sit in the
   sponsors' row, after the sponsors (the owner, 9 October: Hashed Emergent
   beside Hoaq, with no label). Only the government's endorsement is named;
   every other partner is its logo alone, community before media, in one
   unlabelled list (the owner, 9 October: no "Media partners" heading). One
   list, so an unnamed logo can never be stacked under "ENDORSED BY" and
   read as an endorser. */
const UNNAMED_ORDER: readonly PartnerKind[] = ["Community", "Media"];

/**
 * Who goes on the picture, straight from the partners data: the headline
 * sponsor, every sponsor, then government, ecosystem, community and media
 * partners by kind. A new line in lib/partners-2026.ts is a new logo on the
 * picture, with no change here.
 */
export function footerTiers(
  data: {
    headline: Sponsor | null;
    sponsors: readonly Sponsor[];
    partners: readonly Partner[];
  },
  resolveSrc: (logo: PartnerLogo) => string = (logo) => logo.logo,
): FooterTiers {
  // A partner the team keeps off the picture stays on the website's wall.
  const onPicture = data.partners.filter((p) => p.onDp !== false);
  const toLogo = (p: PartnerLogo): FooterLogo => ({
    name: p.name,
    src: resolveSrc(p),
    width: p.width,
    height: p.height,
  });
  return {
    headline: data.headline ? toLogo(data.headline) : null,
    sponsors: [
      ...data.sponsors,
      ...onPicture.filter((p) => p.kind === "Ecosystem"),
    ].map(toLogo),
    groups: [
      {
        kind: "Government" as const,
        label: "ENDORSED BY",
        logos: onPicture.filter((p) => p.kind === "Government").map(toLogo),
      },
      {
        kind: "Media" as const,
        label: "",
        logos: UNNAMED_ORDER.flatMap((kind) =>
          onPicture.filter((p) => p.kind === kind).map(toLogo),
        ),
      },
    ].filter((g) => g.logos.length > 0),
  };
}

/* ------------------------------------------------------------------ */
/* Footer layout                                                      */
/* ------------------------------------------------------------------ */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedLogo extends Box {
  logo: FooterLogo;
}

export interface FooterLayout {
  /** The paper's top edge; DP_SIZE when there is nothing to show. */
  top: number;
  /** "HEADLINE SPONSOR", centred over the headline. */
  headlineLabel: { text: string; cx: number; baseline: number } | null;
  /** Headline first, then the other sponsors. */
  sponsors: PlacedLogo[];
  /** The hairline between the sponsors and the partners. */
  divider: { y: number; x1: number; x2: number } | null;
  labels: { text: string; cx: number; baseline: number }[];
  /** Hairlines between the partner columns, each the full height of its band. */
  separators: { x: number; y1: number; y2: number }[];
  partners: PlacedLogo[];
  /** How many lines of logos the partners took, in their tallest column. */
  partnerLines: number;
}

/** The footer's measures. Label sizes are the Gotham sizes draw.ts uses. */
export const FOOTER = {
  edge: 96,
  padTop: 18,
  padBottom: 20,
  headLabelSize: 20,
  headLabelCap: 14,
  headLabelGap: 10,
  /** Sponsors: sized by area, so a wordmark and a square carry equal weight. */
  headlineArea: 16000,
  headlineMaxH: 58,
  headlineMaxW: 300,
  sponsorArea: 8500,
  sponsorMaxH: 46,
  sponsorMaxW: 200,
  /**
   * No sponsor is drawn shorter than this, above the partners' floor. A wing
   * beside the headline shrinks only this far; past it, the next sponsors
   * move to a line of their own under the headline row, full size.
   */
  sponsorMinH: 36,
  sponsorGap: 60,
  wingGap: 84,
  rowGap: 16,
  groupLabelSize: 18,
  groupLabelCap: 13,
  groupLabelGap: 10,
  /** No partner logo is drawn shorter than this: it must read on the post. */
  partnerMinH: 30,
  /** A square mark (Lagos State's seal) may stand taller than a wordmark. */
  partnerMaxH: 54,
  partnerMaxW: 260,
  partnerBase: 42,
  logoGap: 40,
  groupGap: 92,
  lineGap: 14,
  /** Partners wrap to at most this many lines before their logos get smaller. */
  maxLines: 2,
} as const;

/** A logo's height relative to a 3:1 wordmark (components/home/partner-logo). */
function weight(aspect: number): number {
  return Math.min(1.6, Math.max(0.5, Math.sqrt(3 / aspect)));
}

/**
 * A sponsor's size: the same area for every shape, within maxH and maxW, and
 * never shorter than minH. A very wide wordmark is narrowed only as far as
 * minH allows.
 */
function sizeByArea(
  l: FooterLogo,
  area: number,
  maxH: number,
  maxW: number,
  minH: number = FOOTER.sponsorMinH,
): { w: number; h: number } {
  const aspect = l.width / l.height;
  let h = Math.max(minH, Math.min(Math.sqrt(area / aspect), maxH));
  let w = h * aspect;
  const capW = Math.max(maxW, minH * aspect);
  if (w > capW) {
    w = capW;
    h = w / aspect;
  }
  return { w, h };
}

function sizePartner(l: FooterLogo, base: number): { w: number; h: number } {
  const aspect = l.width / l.height;
  let h = Math.min(FOOTER.partnerMaxH, Math.max(FOOTER.partnerMinH, base * weight(aspect)));
  let w = h * aspect;
  // A very wide wordmark is narrowed only as far as the minimum height allows.
  const maxW = Math.max(FOOTER.partnerMaxW, FOOTER.partnerMinH * aspect);
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  return { w, h };
}

interface Sized {
  logo: FooterLogo;
  w: number;
  h: number;
}

interface FlowItem extends Sized {
  group: number;
}

const rowWidth = (items: readonly Sized[], gap: number) =>
  items.reduce((a, it) => a + it.w, 0) + gap * Math.max(0, items.length - 1);

const rowHeight = (items: readonly Sized[]) => Math.max(0, ...items.map((it) => it.h));

/** Lines stacked with `gap` between them. */
const stackHeight = (lines: readonly (readonly Sized[])[], gap: number) =>
  lines.reduce((a, l) => a + rowHeight(l), 0) + gap * Math.max(0, lines.length - 1);

/**
 * Logos in order, in as few lines no wider than `cap` as they fit, then
 * evened out: the narrowest cap that needs no more lines, so the last line
 * is not a straggler.
 */
function balancedLines<T extends Sized>(items: readonly T[], gap: number, cap: number): T[][] {
  const greedy = (c: number) => {
    const lines: T[][] = [];
    let line: T[] = [];
    let w = 0;
    for (const it of items) {
      const next = line.length ? w + gap + it.w : it.w;
      if (line.length && next > c) {
        lines.push(line);
        line = [it];
        w = it.w;
      } else {
        line.push(it);
        w = next;
      }
    }
    if (line.length) lines.push(line);
    return lines;
  };
  if (!items.length) return [];
  const fewest = greedy(cap).length;
  let lo = Math.max(...items.map((it) => it.w));
  let hi = cap;
  while (hi - lo > 4) {
    const mid = (lo + hi) / 2;
    if (greedy(mid).length <= fewest) hi = mid;
    else lo = mid;
  }
  return greedy(hi);
}

/** One kind of partner: its label, then its logos in one or more lines. */
interface Cell {
  group: number;
  lines: FlowItem[][];
}

/** Kinds stacked one under another, side by side with the next column. */
interface Column {
  cells: Cell[];
  w: number;
}

const LABEL_BAND = FOOTER.groupLabelCap + FOOTER.groupLabelGap;

const cellHeight = (c: Cell) => LABEL_BAND + stackHeight(c.lines, FOOTER.lineGap);

const columnHeight = (col: Column) =>
  col.cells.reduce((a, c) => a + cellHeight(c), 0) +
  FOOTER.lineGap * Math.max(0, col.cells.length - 1);

/** Logos may shrink by this much (about a seventh) to keep a kind in its column. */
const COLUMN_MIN_BASE = FOOTER.partnerBase - 8;

/**
 * The partners as labelled columns, so every logo sits under its own kind's
 * label. The last kind (the media partners, the long list) takes the width
 * the others leave and wraps inside its own column. The kinds before it each
 * keep to one line: side by side in columns of their own (`stack` false), or
 * stacked in one column at the left (`stack` true) when that leaves the
 * media room to stay full size. Null if they are too wide to leave room.
 */
function planColumns(
  groups: readonly FooterGroup[],
  labelW: readonly number[],
  maxLineW: number,
  base: number,
  stack: boolean,
): Column[] | null {
  const sized = groups.map((g, gi) =>
    g.logos.map((logo): FlowItem => ({ group: gi, logo, ...sizePartner(logo, base) })),
  );
  const last = sized.length - 1;
  const cellW = (gi: number) => Math.max(labelW[gi], rowWidth(sized[gi], FOOTER.logoGap));
  const headCells = sized.slice(0, last).map((items, gi): Cell => ({ group: gi, lines: [items] }));
  const head: Column[] = !headCells.length
    ? []
    : stack
      ? [{ cells: headCells, w: Math.max(...headCells.map((c) => cellW(c.group))) }]
      : headCells.map((c) => ({ cells: [c], w: cellW(c.group) }));
  const room = maxLineW - head.reduce((a, c) => a + c.w + FOOTER.groupGap, 0);
  if (room < Math.max(labelW[last], ...sized[last].map((it) => it.w))) return null;
  const lines = balancedLines(sized[last], FOOTER.logoGap, room);
  const w = Math.max(labelW[last], ...lines.map((l) => rowWidth(l, FOOTER.logoGap)));
  return [...head, { cells: [{ group: last, lines }], w }];
}

/**
 * The fallback when no column plan keeps the logos near full size (a great
 * many partners of several kinds): the kinds flow in order across full-width
 * lines, and every run of a kind on a line carries that kind's label, so a
 * logo carried over to the next line is never read as the kind it happens
 * to sit under. Each line is a band of one-line columns.
 */
function flowBands(
  groups: readonly FooterGroup[],
  labelW: readonly number[],
  maxLineW: number,
): Column[][] {
  const runW = (c: Cell) => Math.max(labelW[c.group], rowWidth(c.lines[0], FOOTER.logoGap));
  const lineW = (line: Cell[]) =>
    line.reduce((a, c) => a + runW(c), 0) + FOOTER.groupGap * Math.max(0, line.length - 1);
  for (let base: number = FOOTER.partnerBase; ; base -= 2) {
    const items: FlowItem[] = groups.flatMap((g, gi) =>
      g.logos.map((logo) => ({ group: gi, logo, ...sizePartner(logo, base) })),
    );
    const flow = (cap: number) => {
      const lines: Cell[][] = [];
      let line: Cell[] = [];
      for (const it of items) {
        const run = line[line.length - 1];
        const trial: Cell[] =
          run && run.group === it.group
            ? [...line.slice(0, -1), { group: it.group, lines: [[...run.lines[0], it]] }]
            : [...line, { group: it.group, lines: [[it]] }];
        if (line.length && lineW(trial) > cap) {
          lines.push(line);
          line = [{ group: it.group, lines: [[it]] }];
        } else {
          line = trial;
        }
      }
      if (line.length) lines.push(line);
      return lines;
    };
    const fewest = flow(maxLineW).length;
    let lo = Math.max(...items.map((it) => it.w), ...labelW);
    let hi = maxLineW;
    while (hi - lo > 4) {
      const mid = (lo + hi) / 2;
      if (flow(mid).length <= fewest) hi = mid;
      else lo = mid;
    }
    const lines = flow(hi);
    if (lines.length <= FOOTER.maxLines || base <= FOOTER.partnerMinH) {
      return lines.map((line) => line.map((c) => ({ cells: [c], w: runW(c) })));
    }
  }
}

/**
 * The partner bands: the first column plan (side by side, then stacked)
 * that fits the media in FOOTER.maxLines lines without shrinking a logo by
 * more than about a seventh, else the labelled flow.
 */
function partnerBands(
  groups: readonly FooterGroup[],
  labelW: readonly number[],
  maxLineW: number,
): Column[][] {
  if (!groups.length) return [];
  for (const stack of groups.length > 2 ? [false, true] : [false]) {
    for (let base: number = FOOTER.partnerBase; base >= COLUMN_MIN_BASE; base -= 2) {
      const cols = planColumns(groups, labelW, maxLineW, base, stack);
      if (!cols) break;
      if (cols[cols.length - 1].cells[0].lines.length <= FOOTER.maxLines) return [cols];
    }
  }
  /* The endorsement beside one long unlabelled list: keep the columns and
     let the list take another line, rather than flow it under the label. */
  if (groups.length <= 2 && !groups[groups.length - 1].label) {
    const cols = planColumns(groups, labelW, maxLineW, COLUMN_MIN_BASE, false);
    if (cols) return [cols];
  }
  return flowBands(groups, labelW, maxLineW);
}

/**
 * Where every footer logo goes. The headline sponsor sits dead centre in the
 * first row (the part of the footer a circle crop keeps), the other sponsors
 * split into two wings either side of it, alternating left and right in their
 * listed order. A wing shrinks a little if a new sponsor makes it too wide,
 * never below FOOTER.sponsorMinH; the sponsors that would take it lower (the
 * lowest tiers, last in the list) go to a centred line under the headline
 * row at full size instead. Under a hairline, the partners: each kind under
 * its own small label, the long list of media partners wrapping inside its
 * own column rather than shrinking a logo below FOOTER.partnerMinH.
 *
 * `measureLabel` is the width of a label at the size FOOTER names for it.
 */
export function layoutFooter(
  tiers: FooterTiers,
  measureLabel: (text: string, size: number) => number,
): FooterLayout {
  const S = DP_SIZE;
  const F = FOOTER;
  const maxLineW = S - 2 * F.edge;
  const empty: FooterLayout = {
    top: S,
    headlineLabel: null,
    sponsors: [],
    divider: null,
    labels: [],
    separators: [],
    partners: [],
    partnerLines: 0,
  };

  /* Row one: the headline, its wings, and any sponsors the wings cannot take. */
  const lead: Sized | null = tiers.headline
    ? { logo: tiers.headline, ...sizeByArea(tiers.headline, F.headlineArea, F.headlineMaxH, F.headlineMaxW) }
    : null;
  /* A stacked lockup (a mark over a word, under twice as wide as tall,
     like Microtraction's) stands as tall as the headline may: at a
     wordmark's height its word is a speck. Wordmarks are unchanged. */
  const stacked = (l: FooterLogo) => l.width / l.height < 2;
  const others: Sized[] = tiers.sponsors.map((logo) => ({
    logo,
    ...(stacked(logo)
      ? sizeByArea(logo, F.sponsorArea * 1.5, F.headlineMaxH, F.sponsorMaxW)
      : sizeByArea(logo, F.sponsorArea, F.sponsorMaxH, F.sponsorMaxW)),
  }));
  const half = lead ? lead.w / 2 + F.wingGap : F.wingGap / 2;
  const wingW = S / 2 - half - F.edge;
  const wingScale = (wing: readonly Sized[]) =>
    wing.length ? Math.min(1, wingW / rowWidth(wing, F.sponsorGap)) : 1;
  const wingFits = (wing: readonly Sized[]) =>
    !wing.length || wingScale(wing) * Math.min(...wing.map((s) => s.h)) >= F.sponsorMinH - 1e-9;
  // Higher tiers sit nearest the headline: the left wing reads outward too.
  const wings = (n: number) => {
    const list = others.slice(0, n);
    return {
      left: list.filter((_, i) => i % 2 === 0).reverse(),
      right: list.filter((_, i) => i % 2 === 1),
    };
  };
  let inWings = others.length;
  while (inWings > 0) {
    const { left, right } = wings(inWings);
    if (wingFits(left) && wingFits(right)) break;
    inWings -= 1;
  }
  const { left, right } = wings(inWings);
  const spill = balancedLines(others.slice(inWings), F.sponsorGap, maxLineW);

  const hasSponsors = !!lead || others.length > 0;
  const hasWingRow = !!lead || inWings > 0;
  const wingRowH = Math.max(
    lead?.h ?? 0,
    ...left.map((s) => s.h * wingScale(left)),
    ...right.map((s) => s.h * wingScale(right)),
  );
  const spillH = spill.reduce((a, l) => a + rowHeight(l), 0) + F.rowGap * spill.length;
  const rowOneH = hasSponsors
    ? (lead ? F.headLabelCap + F.headLabelGap : 0) +
      (hasWingRow ? wingRowH : -F.rowGap) +
      spillH
    : 0;

  /* Row two: the partners, by kind. */
  const groups = tiers.groups.filter((g) => g.logos.length);
  const labelW = groups.map((g) => measureLabel(g.label, F.groupLabelSize));
  const bands = partnerBands(groups, labelW, maxLineW);
  const bandH = bands.map((band) => Math.max(...band.map(columnHeight)));
  const rowTwoH =
    bandH.reduce((a, h) => a + h, 0) + F.lineGap * Math.max(0, bands.length - 1);

  if (!hasSponsors && !bands.length) return empty;

  const height =
    F.padTop +
    rowOneH +
    (hasSponsors && bands.length ? 2 * F.rowGap : 0) +
    rowTwoH +
    F.padBottom;
  const top = S - height;
  const out: FooterLayout = { ...empty, top };

  /* Place row one. */
  let y = top + F.padTop;
  if (hasSponsors) {
    if (lead) {
      out.headlineLabel = { text: "HEADLINE SPONSOR", cx: S / 2, baseline: y + F.headLabelCap };
      y += F.headLabelCap + F.headLabelGap;
    }
    if (hasWingRow) {
      const cy = y + wingRowH / 2;
      if (lead) {
        out.sponsors.push({ logo: lead.logo, x: S / 2 - lead.w / 2, y: cy - lead.h / 2, w: lead.w, h: lead.h });
      }
      const layWing = (wing: readonly Sized[], side: -1 | 1) => {
        if (!wing.length) return;
        const k = wingScale(wing);
        const w = rowWidth(wing, F.sponsorGap) * k;
        let x = side < 0 ? F.edge + (wingW - w) / 2 : S / 2 + half + (wingW - w) / 2;
        for (const s of wing) {
          out.sponsors.push({ logo: s.logo, x, y: cy - (s.h * k) / 2, w: s.w * k, h: s.h * k });
          x += s.w * k + F.sponsorGap * k;
        }
      };
      layWing(left, -1);
      layWing(right, 1);
      y += wingRowH;
    } else {
      y -= F.rowGap;
    }
    for (const line of spill) {
      y += F.rowGap;
      const lh = rowHeight(line);
      let x = (S - rowWidth(line, F.sponsorGap)) / 2;
      for (const s of line) {
        out.sponsors.push({ logo: s.logo, x, y: y + (lh - s.h) / 2, w: s.w, h: s.h });
        x += s.w + F.sponsorGap;
      }
      y += lh;
    }
  }

  if (!bands.length) return out;

  /* Place row two. */
  if (hasSponsors) {
    y += F.rowGap;
    out.divider = { y, x1: F.edge, x2: S - F.edge };
    y += F.rowGap;
  }
  out.partnerLines = bands.reduce(
    (a, band) => a + Math.max(...band.map((col) => col.cells.reduce((n, c) => n + c.lines.length, 0))),
    0,
  );
  /*
   * The usual row two: the endorsement, then one unlabelled list. The
   * endorsement sits under the first sponsor on the left (Hashed Emergent
   * today) and the list spreads to the last sponsor's right edge, each line
   * spaced across that width, so the row lines up with the one above
   * instead of huddling in the middle (the owner, 9 October). Heights are
   * untouched: only where things sit across the row.
   */
  // The row beside the headline (not a spill line under it).
  const lead0 = out.sponsors[0];
  const firstRow = lead0
    ? out.sponsors.filter((s) => Math.abs(s.y + s.h / 2 - (lead0.y + lead0.h / 2)) < 1)
    : [];
  const anchored =
    bands.length === 1 &&
    bands[0].length === 2 &&
    !!groups[bands[0][0].cells[0].group].label &&
    !groups[bands[0][1].cells[0].group].label &&
    firstRow.length >= 2;
  const span = anchored
    ? (() => {
        const leftmost = firstRow.reduce((a, b) => (b.x < a.x ? b : a));
        const right = Math.max(...firstRow.map((s) => s.x + s.w));
        const [head, list] = bands[0];
        const headX = Math.max(F.edge, leftmost.x + leftmost.w / 2 - head.w / 2);
        const listX = headX + head.w + F.groupGap;
        const listW = Math.min(right, S - F.edge) - listX;
        return listW >= list.w ? { headX, listX, listW } : null;
      })()
    : null;

  bands.forEach((band, bi) => {
    const h = bandH[bi];
    const totalW = band.reduce((a, c) => a + c.w, 0) + F.groupGap * Math.max(0, band.length - 1);
    let x = span ? span.headX : (S - totalW) / 2;
    band.forEach((col, ci) => {
      const colW = span && ci === 1 ? span.listW : col.w;
      // Every column's first label sits on the band's top line; what is
      // under it is centred in the rest of the band, so a kind with one
      // line sits level with the middle of a kind with two.
      let cy = y;
      col.cells.forEach((cell, k) => {
        if (k > 0) cy += F.lineGap;
        if (groups[cell.group].label) {
          out.labels.push({ text: groups[cell.group].label, cx: x + colW / 2, baseline: cy + F.groupLabelCap });
        }
        cy += LABEL_BAND;
        if (k === 0) cy += (h - columnHeight(col)) / 2;
        for (const line of cell.lines) {
          const lh = rowHeight(line);
          const inked = line.reduce((a, it) => a + it.w, 0);
          // Spread across the list's width when anchored; never wider apart
          // than four ordinary gaps, so a short last line does not scatter.
          const gap =
            span && ci === 1 && line.length > 1
              ? Math.min((colW - inked) / (line.length - 1), F.logoGap * 4)
              : F.logoGap;
          let lx = x + (colW - (inked + gap * (line.length - 1))) / 2;
          for (const it of line) {
            out.partners.push({ logo: it.logo, x: lx, y: cy + (lh - it.h) / 2, w: it.w, h: it.h });
            lx += it.w + gap;
          }
          cy += lh + F.lineGap;
        }
        cy -= F.lineGap;
      });
      x += colW;
      if (ci < band.length - 1) {
        out.separators.push({ x: x + F.groupGap / 2, y1: y, y2: y + h });
        x += F.groupGap;
      }
    });
    y += h + F.lineGap;
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* The art above the footer                                           */
/* ------------------------------------------------------------------ */

export interface ArtLayout {
  /** The masthead mark. */
  logo: Box;
  /** The theme line's baseline, under the mark. */
  themeBaseline: number;
  /** The photo's centre. */
  hub: { x: number; y: number };
  photoR: number;
  /** The ring's centre line. */
  ringR: number;
  /** The band the role pill, name and days are centred in. */
  zoneTop: number;
  zoneBottom: number;
}

/** The art's measures. */
export const ART = {
  logoTop: 60,
  logoW: 480,
  /** Mark's bottom to the theme line's baseline. */
  themeGap: 44,
  /** Theme baseline to the ring's outer edge. */
  ringGap: 40,
  /** Every route and the ring share one weight. */
  line: 26,
  /** Photo edge to the ring's centre line: a navy moat inside the ring. */
  moat: 52,
  /** The ring is never larger than concept C first drew it. */
  maxRingR: 568,
  /** Ring to the role pill, and the days to the footer. */
  zoneGap: 36,
  /**
   * Room for the pill (136), the name (one line at full size, or two lines
   * a little smaller), the two day lines and the gaps between them.
   */
  textBlock: 414,
} as const;

/**
 * The art, rebalanced to the footer: the mark and theme at the top, the role
 * pill, name and days in a band above the footer, and the ring as large as
 * the space between allows. A taller footer (more partners) gives a smaller
 * ring, never a cramped name.
 */
export function layoutArt(footerTop: number, logoAspect: number): ArtLayout {
  const S = DP_SIZE;
  const logoH = ART.logoW / logoAspect;
  const logo = { x: S / 2 - ART.logoW / 2, y: ART.logoTop, w: ART.logoW, h: logoH };
  const themeBaseline = ART.logoTop + logoH + ART.themeGap;
  const ringTop = themeBaseline + ART.ringGap;
  /* The pill, name and days never sit lower than where a profile picture's
     circle crop is still as wide as the name's room, so a shorter footer
     gives the ring the space, not the text. */
  const cropFloor = S / 2 + Math.sqrt((S / 2) ** 2 - (NAME_MAX_W / 2) ** 2);
  const zoneBottom = Math.min(footerTop - ART.zoneGap, cropFloor);
  const ringBottomMax = zoneBottom - ART.textBlock - ART.zoneGap;
  const outer = Math.min(
    ringBottomMax - ringTop,
    2 * (ART.maxRingR + ART.line / 2),
  );
  const ringR = outer / 2 - ART.line / 2;
  const hubY = ringTop + (ringBottomMax - ringTop) / 2;
  return {
    logo,
    themeBaseline,
    hub: { x: S / 2, y: hubY },
    ringR,
    photoR: ringR - ART.moat,
    zoneTop: hubY + outer / 2 + ART.zoneGap,
    zoneBottom,
  };
}

/** Whether a box survives the circle crop a profile picture makes. */
export function insideCircleCrop(b: Box, size: number = DP_SIZE): boolean {
  const c = size / 2;
  return [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
  ].every(([x, y]) => Math.hypot(x - c, y - c) <= c);
}

/* ------------------------------------------------------------------ */
/* SVG logos                                                          */
/* ------------------------------------------------------------------ */

/**
 * An SVG with its root element sized width x height. An SVG sized 100% (Cake
 * Wallet's) has no natural size, and a browser asked to draw one into a
 * canvas may draw it at 0x0, at 300x150 squashed, or refuse; with a size on
 * its root, every browser draws it.
 */
export function sizedSvg(svg: string, width: number, height: number): string {
  return svg.replace(/<svg\b[^>]*>/i, (tag) =>
    tag
      .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "")
      .replace(/^<svg\b/i, `<svg width="${width}" height="${height}"`),
  );
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
