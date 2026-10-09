/**
 * How the page tells a failure apart and says it. Its own module, with no
 * imports, so the page's tests can mock the drawing and keep these.
 */

/** The DP's lettering did not load, as against any other fault in a draw. */
export class FontLoadError extends Error {
  name = "FontLoadError";
}

/** An error as a person can read it out or paste it: its name and message. */
export function errorDetail(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 160);
  return String(e).slice(0, 160);
}
