import "server-only";
import type { NextRequest } from "next/server";

/**
 * Guards that every state-changing admin request has to pass before the body is
 * even parsed.
 */

/**
 * Refuse a cross-site POST.
 *
 * The session is a cookie, so without this a page on any other origin can make
 * a logged-in admin approve an entry by loading a form and submitting it. The
 * admin sees nothing. On a surface that mints prize money that is the cheapest
 * attack available and needs no access to anything.
 *
 * Checked against the request's own host rather than a configured site URL, so
 * it is correct on production, on every deploy preview, and on a branch deploy
 * without a variable to keep in step.
 *
 * Fails closed on a missing Origin. Every browser sends it on a cross-origin
 * POST and modern browsers send it on same-origin POSTs too, so absent means a
 * client we have no reason to trust with this.
 */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  // x-forwarded-host is set by the platform in front of the function; host is
  // the fallback. Both are compared, and either matching is enough, because a
  // proxy may rewrite one of them.
  const candidates = [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    request.nextUrl.host,
  ]
    .filter((h): h is string => Boolean(h))
    .map((h) => h.toLowerCase());

  return candidates.includes(originHost);
}

/**
 * The client address, from the header the platform sets and nothing else.
 *
 * x-forwarded-for is attacker-controlled: anybody can send one. Using it as a
 * throttle key lets an attacker both evade their own budget and spend somebody
 * else's, which during a live review window means locking a named reviewer out
 * of the queue at will.
 *
 * Netlify sets x-nf-client-connection-ip itself and it cannot be spoofed by the
 * client. When it is absent, everybody shares one bucket rather than falling
 * back to something forgeable.
 */
export const SHARED_BUCKET = "shared";

export function throttleKey(request: NextRequest): string {
  return request.headers.get("x-nf-client-connection-ip")?.trim() || SHARED_BUCKET;
}

/** A review decision is a few hundred bytes. Anything larger is not one. */
export const MAX_ADMIN_BODY_BYTES = 4 * 1024;

export async function readJsonBody(
  request: NextRequest,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_ADMIN_BODY_BYTES) return { ok: false };

  try {
    const raw = await request.text();
    // Re-measured, because content-length is advisory and can simply lie.
    if (raw.length > MAX_ADMIN_BODY_BYTES) return { ok: false };
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}
