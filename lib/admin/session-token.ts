import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The admin session token.
 *
 * Minted in Node, stored only as a SHA-256, exactly like the creator access
 * token in lib/creator-access.ts and for the same two reasons: PGlite has no
 * pgcrypto so the database cannot mint it, and a hash means reading the table
 * is not holding the sessions. 32 random bytes, so guessing is not a threat
 * model, only theft is, which is why SHA-256 and not a slow hash.
 */

const TOKEN_BYTES = 32;

/**
 * The __Host- prefix is load-bearing, not decoration. A browser refuses to
 * store a __Host- cookie unless it is Secure, path=/ and carries no Domain,
 * which means no subdomain and no sibling host on the origin can plant or
 * shadow an admin session cookie. That is the property #138 is about.
 */
export const ADMIN_SESSION_COOKIE = "__Host-admin_session";

/** Must equal interval '12 hours' in 0029_admin_sessions.sql. */
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export function newAdminSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashAdminSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * The exact shape newAdminSessionToken mints, checked before the database is
 * touched so a malformed cookie never becomes a query.
 */
export function looksLikeAdminSessionToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Constant-time equality, belt to the hash lookup, as creator-access has. */
export function adminSessionMatches(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const adminSessionCookieOptions = () => ({
  httpOnly: true,
  // Unconditional, not NODE_ENV-gated: the __Host- prefix demands Secure, and
  // admin sign-in has never worked on plain-http localhost because Identity
  // does not run under netlify dev. Nothing is lost.
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: ADMIN_SESSION_MAX_AGE,
});
