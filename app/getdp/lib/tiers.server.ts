import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { headline, partners, sponsors, type PartnerLogo } from "@/lib/partners-2026";
import { footerTiers, sizedSvg, svgDataUrl, type FooterTiers } from "./dp";

/**
 * An SVG logo, read from public/ when the page is built and handed over with
 * its recorded size written on its root, so every browser can draw it into
 * the picture (see sizedSvg). Any other logo is just its path. Done on the
 * server so the generator in the browser makes no requests of its own beyond
 * loading the site's images.
 */
function drawableSrc(logo: PartnerLogo): string {
  if (!/\.svg$/i.test(logo.logo)) return logo.logo;
  try {
    const svg = readFileSync(join(process.cwd(), "public", logo.logo), "utf8");
    return svgDataUrl(sizedSvg(svg, logo.width, logo.height));
  } catch {
    return logo.logo;
  }
}

/** Who goes on the picture, from lib/partners-2026, ready for the browser. */
export function pageTiers(): FooterTiers {
  return footerTiers({ headline, sponsors, partners }, drawableSrc);
}
