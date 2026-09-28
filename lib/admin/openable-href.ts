/*
 * A link, but only to a place we can prove it goes.
 *
 * The submitted URL was once never an anchor, because the destination is
 * chosen by whoever submitted it and the reader is somebody who can mint
 * points against a five million naira pool. That reasoning was right when it
 * was written and is only partly right now: submission enforces
 * hostMatchesPlatform, so a stored URL is on x.com, twitter.com,
 * instagram.com, tiktok.com or a subdomain of one of them. The reviewer
 * cannot be sent to an attacker's own server.
 *
 * Partly, because that check lives in the zod schema rather than in the
 * database, and this codebase's whole habit is that a guard which is not in
 * the engine is a guard somebody can route around. So the allowlist is
 * applied AGAIN wherever a submitted URL is rendered: a URL that is not https
 * and on one of those hosts renders as text. Nothing becomes clickable that
 * cannot be shown to point at a platform.
 *
 * What is left is an open redirect on one of those platforms, which a
 * reviewer reaches identically by copying the same string into the same
 * browser. rel="noopener noreferrer" at each anchor closes the tab-nabbing
 * and referrer paths that clicking adds over pasting.
 *
 * One module, because the review queue and the Decided page both render these
 * links. Two copies of an allowlist drift, and the drift is invisible until the
 * looser copy is the one somebody clicks.
 */
export const LINKABLE_HOSTS = [
  "x.com",
  "twitter.com",
  "instagram.com",
  "instagr.am",
  "tiktok.com",
] as const;

export function openableHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const known = LINKABLE_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
    return known ? url : null;
  } catch {
    return null;
  }
}
