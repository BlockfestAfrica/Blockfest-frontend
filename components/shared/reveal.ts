/**
 * Bring something that just opened to the person who opened it.
 *
 * For forms that expand in place, under the row that was pressed, rather than
 * in a dialog. They open next to the button, but a tall one near the bottom of
 * the screen still lands mostly below the fold, and a pressed button with no
 * visible result reads as a button that did nothing. This scrolls the new
 * content into view and, where there is a field to fill in, puts the cursor in
 * it without a second jump.
 *
 * Instant rather than smooth when the reader has asked for reduced motion.
 * Missing in jsdom, so guarded rather than assumed.
 */
export function reveal(
  target: HTMLElement | null,
  focus?: HTMLElement | null,
  block: ScrollLogicalPosition = "nearest",
): void {
  if (!target) return;
  const reduce =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block });
  }
  focus?.focus({ preventScroll: true });
}
