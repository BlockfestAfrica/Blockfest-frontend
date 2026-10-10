/**
 * The DP's looks: the picture's ground, its decoration and its colours.
 *
 * "routes" is concept C, "New trade routes" (the owner, 9 October), drawn by
 * draw.ts itself and still the default: people were already posting it. The
 * others come from the 2026 brand kit the design team shared on 10 October
 * (the four colours, the wave pattern, the colour fields, the mark on a
 * card); the owner picked "Wave crown" and "Colour fields" from three for
 * people to switch to. Every look keeps the
 * same layout (layoutArt): the mark at the top, the photo in its circle, the
 * role, name and days below it, and the partners' band at the foot, so the
 * photo, the name and the partners behave the same whichever is chosen.
 */
import { DP_COLOR, DP_SIZE, type ArtLayout, type DPRole, roleCopy } from "./dp";

export type DPStyle = "routes" | "scallop" | "fields";

/** In the order the page offers them; the first is the default. */
export const DP_STYLES: readonly DPStyle[] = ["routes", "scallop", "fields"];

/** What the page calls each look. */
export const STYLE_LABEL: Record<DPStyle, string> = {
  routes: "Trade routes",
  scallop: "Wave crown",
  fields: "Colour fields",
};

/** Which version of the mark a look puts at the top. */
export type MarkTone = "onDark" | "onLight";

export interface Look {
  /** The mark: white lettering for a dark ground, black for a light one. */
  mark: MarkTone;
  /** A rounded card behind the mark, as the kit sets it on busy grounds. */
  markCard: string | null;
  /** The theme line under the mark. */
  theme: string;
  /** The name, and the stand-in name before one is typed. */
  name: string;
  ghost: string;
  /** The days: the date, then the venue. */
  day: string;
  day2: string;
  /** A station's inside on the days' route. */
  stop: string;
  /** The empty frame's head and shoulders, and the frame behind them. */
  face: string;
  frame: string;
  /** The role pill. */
  pill: (role: DPRole) => { fill: string; text: string };
  /** The line between the days' stops, and each stop's ring. */
  route: (role: DPRole) => string;
}

const S = DP_SIZE;
const INK = "#0B0B0F";

export const LOOKS: Record<Exclude<DPStyle, "routes">, Look> = {
  scallop: {
    mark: "onDark",
    markCard: INK,
    theme: "rgba(255,255,255,0.72)",
    name: "#FFFFFF",
    ghost: "rgba(255,255,255,0.55)",
    day: "#FFFFFF",
    day2: "rgba(255,255,255,0.78)",
    stop: "#FFFFFF",
    face: "#26262E",
    frame: "#15151B",
    pill: (role) => ({ fill: roleCopy(role).fill, text: roleCopy(role).text === DP_COLOR.ink ? "#FFFFFF" : INK }),
    route: (role) => roleCopy(role).fill,
  },
  fields: {
    mark: "onLight",
    markCard: "#FFFFFF",
    theme: "rgba(11,11,15,0.66)",
    name: INK,
    ghost: "rgba(11,11,15,0.40)",
    day: INK,
    day2: "rgba(11,11,15,0.72)",
    stop: "#FFFFFF",
    face: "#E4E6EC",
    frame: "#F3F4F7",
    pill: (role) => ({ fill: roleCopy(role).fill, text: roleCopy(role).text === DP_COLOR.ink ? "#FFFFFF" : INK }),
    route: (role) => roleCopy(role).fill,
  },
};

/* ------------------------------------------------------------------ */
/* The scallop pattern                                                */
/* ------------------------------------------------------------------ */

/**
 * The kit's wave pattern: rows of circles, each a set of rings, every row
 * half a circle along from the one above and drawn over its lower part, so
 * what shows of each is an arch. `fill(row)` colours a row's rings; `gap` is
 * the colour between them.
 */
export function drawScallops(
  ctx: CanvasRenderingContext2D,
  o: {
    r: number;
    top: number;
    bottom: number;
    fill: (row: number) => string;
    gap: string;
    rings?: number;
    pitch?: number;
  },
) {
  const rings = o.rings ?? 4;
  const pitchY = o.r * (o.pitch ?? 0.56);
  for (let j = 0; ; j++) {
    const cy = o.top + j * pitchY;
    if (cy - o.r > o.bottom) break;
    const shift = (j % 2) * o.r;
    for (let cx = -2 * o.r + shift; cx < S + 2 * o.r; cx += 2 * o.r) {
      for (let k = 0; k < rings * 2; k++) {
        const rr = o.r * (1 - k / (rings * 2));
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fillStyle = k % 2 === 0 ? o.gap : o.fill(j);
        ctx.fill();
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Grounds                                                            */
/* ------------------------------------------------------------------ */

/** The look's ground and decoration, under the photo and the text. */
export function drawLookGround(ctx: CanvasRenderingContext2D, style: Exclude<DPStyle, "routes">, art: ArtLayout) {
  if (style === "scallop") {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, S, S);
    // A crown of the kit's colour waves, fading into black behind the text.
    const colours = [DP_COLOR.pink, DP_COLOR.yellow, DP_COLOR.blue, DP_COLOR.teal];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, S, art.zoneTop);
    ctx.clip();
    drawScallops(ctx, { r: 92, top: -40, bottom: art.zoneTop, fill: (j) => colours[j % 4], gap: INK });
    ctx.restore();
    const fade = ctx.createLinearGradient(0, art.hub.y - art.ringR * 0.2, 0, art.zoneTop + 40);
    fade.addColorStop(0, "rgba(11,11,15,0)");
    fade.addColorStop(1, INK);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, S, S);
    // Quiet behind the mark, so it reads on its card.
    // Fading out by the ring's top, so no line crosses the waves.
    const until = art.hub.y - art.ringR;
    const top = ctx.createLinearGradient(0, 0, 0, until);
    top.addColorStop(0, "rgba(11,11,15,0.55)");
    top.addColorStop(1, "rgba(11,11,15,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, S, until);
    return;
  }
  // fields: white, with the kit's three great discs behind the photo.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, S, art.zoneTop - 10);
  ctx.clip();
  const disc = (x: number, y: number, r: number, c: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  };
  disc(S * 0.5, -S * 0.9, S * 1.25, DP_COLOR.blue);
  disc(S * 1.06, art.zoneTop + S * 0.2, S * 0.78, DP_COLOR.pink);
  disc(-S * 0.08, art.zoneTop + S * 0.26, S * 0.86, DP_COLOR.yellow);
  ctx.restore();
}

/**
 * The photo's surround: a clean band of the ground's opposite, and a ring of
 * the role's colour, where concept C has its four arcs.
 */
export function drawLookRing(ctx: CanvasRenderingContext2D, style: Exclude<DPStyle, "routes">, art: ArtLayout, role: DPRole) {
  const { hub, photoR, ringR } = art;
  const outer = (photoR + ringR) / 2 + 26;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hub.x, hub.y, outer, 0, Math.PI * 2);
  ctx.fillStyle = style === "scallop" ? INK : "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 18;
  ctx.strokeStyle = roleCopy(role).fill;
  ctx.beginPath();
  ctx.arc(hub.x, hub.y, outer - 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
