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

/**
 * Hand focus back to a row's control once a request settles, without taking
 * it from wherever the reader has gone meanwhile.
 *
 * It moves only while focus is nowhere, because the control that had it was
 * removed or (in Chrome) disabled mid-request, which drops focus to the
 * body, or while it is still inside the row the request came from, and never
 * out of a field. Somebody who moved on to another card, or back into the
 * form to fix it, during a slow request keeps their place.
 * Scrolls only when the target is out of view, so a return that is already
 * on screen does not jolt the page.
 */
export function returnFocus(
  target: HTMLElement | null | undefined,
  row: Element | null | undefined,
): void {
  if (!target) return;
  const active = document.activeElement;
  if (active && active !== document.body && !row?.contains(active)) return;
  // Never out of a field the reader went back into: the fields stay
  // editable while a request runs, and a return from there to the submit
  // button sent the request again on the next Space.
  if (active && active !== target && active.matches("input, textarea, select, [contenteditable]")) return;
  const box = target.getBoundingClientRect();
  const inView = box.top >= 0 && box.bottom <= window.innerHeight;
  target.focus(inView ? { preventScroll: true } : undefined);
}
