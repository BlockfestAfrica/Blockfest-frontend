/**
 * The DP's looks: the picture's ground, its decoration and its colours.
 *
 * "routes" is concept C, "New trade routes" (the owner, 9 October), drawn by
 * draw.ts itself and still the default: people were already posting it. The
 * others come from the 2026 brand kit the design team shared on 10 October.
 * "Colour fields" (the kit's three great circles on white) keeps concept C's
 * layout (layoutArt). "Sunset" is the design team's own sample for the DP,
 * fitted to the square (layoutSunset): their orange gradient with the kit's
 * tile pattern laid on it in a lighter tone of itself, which is how the team
 * applies a pattern to that colour (it replaced "Wave crown", which laid the
 * kit's colour waves on black: "we don't apply this pattern this way"). All
 * of them keep the partners' band at the foot.
 */
import { DP_COLOR, DP_SIZE, type ArtLayout, type DPRole, roleCopy } from "./dp";

export type DPStyle = "routes" | "sunset" | "fields";

/** In the order the page offers them; the first is the default. */
export const DP_STYLES: readonly DPStyle[] = ["routes", "sunset", "fields"];

/** What the page calls each look. */
export const STYLE_LABEL: Record<DPStyle, string> = {
  routes: "Trade routes",
  sunset: "Sunset",
  fields: "Colour fields",
};

/**
 * Which version of the mark a look puts at the top: white lettering on a dark
 * ground, black lettering on white, or all white on the orange.
 */
export type MarkTone = "onDark" | "onLight" | "white";

export const STYLE_MARK: Record<DPStyle, MarkTone> = {
  routes: "onDark",
  sunset: "white",
  fields: "onLight",
};

/** The versions of the mark that only some designs draw, brought apart (loadMark). */
export type ExtraTone = Exclude<MarkTone, "onDark">;
export const EXTRA_TONES: readonly ExtraTone[] = ["onLight", "white"];

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

export const LOOKS: Record<"fields", Look> = {
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
/* Sunset                                                             */
/* ------------------------------------------------------------------ */

/** The design team's sample, sampled: its gradient, ring, band and icons. */
export const SUN = {
  top: "#F2A843",
  bottom: "#F37A64",
  ring: "rgba(255,255,255,0.45)",
  role: "#0B0B0F",
  name: "#FFFFFF",
  ghost: "rgba(255,255,255,0.62)",
  band: "#000000",
  bandInk: "#FFFFFF",
  icon: DP_COLOR.pink,
  /** The pattern's two tones: the ground, lightened a little and a little more. */
  tile: "rgba(255,255,255,0.10)",
  tile2: "rgba(255,255,255,0.055)",
  frame: "#F6BC8C",
  face: "#FBDCC2",
} as const;

/**
 * The kit's tile pattern: square cells holding the mark's own shapes, rows
 * of domes (two quarter rounds, each cell a tone of its own) between rows of
 * arches and double lobes in turn, as the kit's book cover sets them. Here
 * in the ground's own colour, a shade lighter, as the team's sample lays it.
 */
export function drawPetals(ctx: CanvasRenderingContext2D, bottom: number, cell = 432) {
  const C = cell;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, S, bottom);
  ctx.clip();
  for (let r = 0; r * C - C * 0.3 < bottom; r++) {
    const y = r * C - C * 0.3;
    for (let c = -1; c * C < S; c++) {
      const x = c * C;
      ctx.fillStyle = (r + c) % 2 === 0 ? SUN.tile : SUN.tile2;
      ctx.beginPath();
      if (r % 2 === 0) {
        // A dome: the left cell rounds its top left corner, the right its top right.
        const left = ((c % 2) + 2) % 2 === 0;
        if (left) ctx.arc(x + C, y + C, C, Math.PI, Math.PI * 1.5);
        else ctx.arc(x, y + C, C, Math.PI * 1.5, Math.PI * 2);
        ctx.lineTo(left ? x + C : x, y + C);
      } else if (((c % 2) + 2) % 2 === 0) {
        // An arch: a square with a round top.
        ctx.moveTo(x, y + C);
        ctx.lineTo(x, y + C / 2);
        ctx.arc(x + C / 2, y + C / 2, C / 2, Math.PI, Math.PI * 2);
        ctx.lineTo(x + C, y + C);
      } else {
        // Two lobes side by side.
        ctx.ellipse(x + C * 0.3, y + C / 2, C * 0.3, C / 2, 0, 0, Math.PI * 2);
        ctx.moveTo(x + C, y + C / 2);
        ctx.ellipse(x + C * 0.7, y + C / 2, C * 0.3, C / 2, 0, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Sunset's ground: the sample's gradient down to the band, and the tiles on it. */
export function drawSunsetGround(ctx: CanvasRenderingContext2D, bandTop: number) {
  const g = ctx.createLinearGradient(0, 0, 0, bandTop);
  g.addColorStop(0, SUN.top);
  g.addColorStop(1, SUN.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, bandTop);
  drawPetals(ctx, bandTop);
}

/* ------------------------------------------------------------------ */
/* Grounds                                                            */
/* ------------------------------------------------------------------ */

/** The look's ground and decoration, under the photo and the text. */
export function drawLookGround(ctx: CanvasRenderingContext2D, style: "fields", art: ArtLayout) {
  void style;
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
export function drawLookRing(ctx: CanvasRenderingContext2D, style: "fields", art: ArtLayout, role: DPRole) {
  const { hub, photoR, ringR } = art;
  const outer = (photoR + ringR) / 2 + 26;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hub.x, hub.y, outer, 0, Math.PI * 2);
  void style;
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 18;
  ctx.strokeStyle = roleCopy(role).fill;
  ctx.beginPath();
  ctx.arc(hub.x, hub.y, outer - 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
