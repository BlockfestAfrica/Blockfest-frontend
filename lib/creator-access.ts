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

export const CREATOR_SESSION_COOKIE = "monica_creator";

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
 */
export const CREATOR_PENDING_COOKIE = "monica_pending";
export const CREATOR_PENDING_MAX_AGE = 60 * 10;
export const CREATOR_PENDING_PATH = "/campaigns/monica-money-story/enter";

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
