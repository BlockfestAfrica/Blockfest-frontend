import localFont from "next/font/local";

/**
 * Gotham, self-hosted.
 *
 * WOFF2 rather than OTF. The OTF was 165KB on disk and 83KB gzipped on the
 * wire; the same font as WOFF2 is 53KB with all 771 glyphs intact. For an
 * audience that is ~90% Nigeria on mobile, that 30KB was costing well over a
 * second on a slow connection, and /tickets has a TEXT element as its LCP, so
 * anything competing for bandwidth on the critical path delays LCP directly.
 */
export const gotham = localFont({
  src: "../app/fonts/Gotham-Medium.woff2",
  display: "swap",
  variable: "--font-gotham",
  // Not preloaded. With display:swap the text paints in a fallback anyway, so a
  // high-priority preload only takes bandwidth from the render-blocking CSS,
  // which is what actually gates LCP on this site. Measured at 600kbps: the
  // preload cost 304ms of LCP.
  preload: false,
});
