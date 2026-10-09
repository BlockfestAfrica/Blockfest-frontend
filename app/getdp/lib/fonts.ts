import { Bebas_Neue } from "next/font/google";
import { gotham } from "@/lib/fonts";

/**
 * The two faces the DP is drawn in.
 *
 * Bebas Neue sets the name and the role. next/font self-hosts it (the site's
 * CSP allows fonts from 'self' only) with both subsets Google publishes for
 * it: latin carries the tone marks (Á À É È Í Ì Ó Ò Ú Ù), latin-ext the rest
 * of the Latin letters a Nigerian name can hold (Ń and friends, where the
 * face has them). Bebas has no Vietnamese file, so the dot-below vowels
 * (Ẹ Ị Ọ Ụ) are in no file at all; draw.ts sets those as the base letter
 * plus Bebas's own full stop, never in a fallback font.
 *
 * Gotham is the site's own face, already loaded by the root layout; the DP
 * uses it for the small tracked lines.
 *
 * Neither is page text, only canvas paint, so neither is preloaded: draw.ts
 * asks document.fonts for each by name before it draws, and refuses to draw
 * if either is missing.
 */
export const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "block",
  preload: false,
});

export const DP_FONTS = {
  display: bebas.style.fontFamily,
  text: gotham.style.fontFamily,
};
