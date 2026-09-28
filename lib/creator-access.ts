import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The creator access token.
 *
 * A creator has to be able to come back after registering to see their points,
 * find their referral link and submit an entry. There is no email provider
 * configured and no date for one, so the token is minted at registration, shown
 * once, and never recoverable from the database afterwards.
 *
 * That last part is the trade. Losing the link means losing the way back in
 * until email recovery exists, which is a real cost accepted deliberately: the
 * alternative is storing something we could replay ourselves, and a stored
 * secret that can be read is a stored secret that can be taken.
 */

/** 32 bytes. Enough that guessing is not a threat model, only theft is. */
const TOKEN_BYTES = 32;

/**
 * The session cookie. The __Host- prefix is the control, not decoration.
 *
 * A browser stores a __Host- cookie only when it is Secure, Path=/ and has no
 * Domain, so the one thing able to set it is this exact host over HTTPS. The
 * plain name it replaces could be set by any host under the registrable domain
 * with a Domain attribute, and by anybody on the network over plain HTTP on a
 * first visit, and nothing on the server can tell those from the cookie this
 * site set: a Cookie header carries names and values and nothing else. A
 * planted value that was an attacker's own token signed the victim into the
 * attacker's enrolment without ever reaching the confirm page, and the
 * victim's Instagram entry was filed as the attacker's work. The admin cookie
 * carries the same prefix for the same reason (#138).
 */
export const CREATOR_SESSION_COOKIE = "__Host-monica_creator";

/**
 * The name every creator was signed in under before the prefix. Still read,
 * never as a session.
 *
 * It is exactly the cookie a sibling host can plant. Honouring it alone would
 * keep the hole open for as long as it was honoured, and quietly re-issuing it
 * under the __Host- name would be worse: a planted value would be handed the
 * very protection the prefix exists to give. It is read as a claim instead,
 * the same as a token parked by an entry link. The confirm page names the
 * account and its handles, and only the POST from that page turns it into a
 * __Host- session and clears it. Nobody is signed out in the middle of the
 * campaign; each browser is asked once.
 */
export const CREATOR_LEGACY_SESSION_COOKIE = "monica_creator";

/**
 * How long the cookie lasts. Through the campaign and its disputes, since
 * making somebody dig out a link mid-campaign is how they stop taking part.
 */
export const CREATOR_SESSION_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * Where a token waits between arriving in a link and the creator confirming it
 * is theirs.
 *
 * Separate from the session cookie on purpose. Clicking a link no longer signs
 * anybody in, so a link that arrives from a group chat, or that a mail client
 * prefetches, cannot establish a session on its own. This holds the claim; only
 * a confirmed POST turns it into one.
 *
 * Ten minutes, because it exists for the seconds between a redirect and a tap.
 * Scoped to the entry path so it is not attached to any other request.
 *
 * Not __Host-, deliberately: that prefix demands Path=/, which would attach a
 * live token to every request on the site and undo the scoping above. A
 * planted one buys nothing a link does not, since either way the page names
 * the account before anything is committed. What one could do is shadow the
 * claim a creator's own link has just parked, by sorting after it, which is
 * why it is read with soleCookie and two different values count as none. The
 * recovery cookie below is read the same way for the same reason.
 */
export const CREATOR_PENDING_COOKIE = "monica_pending";
export const CREATOR_PENDING_MAX_AGE = 60 * 10;
export const CREATOR_PENDING_PATH = "/campaigns/monica-money-story/enter";

/**
 * Where a recovery token waits between the confirmation link being opened
 * and a person confirming it is theirs.
 *
 * The same shape as CREATOR_PENDING_COOKIE, and for the same reason: opening
 * a mailed link is not a decision anybody made on purpose, since a mail
 * client can prefetch it or a group chat can forward it. This cookie only
 * ever lets somebody reach the confirm screen; only the POST from that
 * screen rotates anything.
 */
export const CREATOR_RECOVERY_PENDING_COOKIE = "monica_recovery_pending";
export const CREATOR_RECOVERY_PENDING_MAX_AGE = 60 * 10;
export const CREATOR_RECOVERY_PENDING_PATH =
  "/campaigns/monica-money-story/recover";

/**
 * How long a minted recovery token is honoured before it must be requested
 * again. Short, because unlike the access link this one is not meant to be
 * kept: it exists for the few minutes between an inbox and a click.
 */
export const RECOVERY_TOKEN_MAX_AGE_SECONDS = 60 * 30;

/** Base64url, so it survives a URL, a cookie and a WhatsApp message intact. */
export function newAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * SHA-256, deliberately, and not bcrypt or argon2.
 *
 * Slow hashes exist to make guessing a low-entropy secret expensive, and a
 * password is low entropy because a person chose it. This is 32 random bytes,
 * so there is no guessing rate worth slowing down, and a slow hash would spend
 * a serverless function's time budget on every authenticated request for
 * nothing. The hash is here so that reading the database is not the same as
 * holding the tokens.
 */
export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Compare two hashes without leaking where they diverge.
 *
 * The lookup is by hash, so the database does the matching and this is belt and
 * braces. It costs nothing and means a future change to lookup-then-compare
 * does not quietly introduce a timing oracle.
 */
export function accessTokenMatches(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Tokens arrive from a query string, a cookie or a pasted link. Anything that
 * is not the exact shape we mint is rejected before it reaches the database,
 * so a malformed value never becomes a query.
 */
export function looksLikeAccessToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
