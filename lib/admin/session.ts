import { cache } from "react";
import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  hashAdminSessionToken,
  looksLikeAdminSessionToken,
} from "@/lib/admin/session-token";

/**
 * Who is allowed to act as an admin, decided on every single request.
 *
 * The credential is a server-minted session cookie (#138), not the Netlify
 * Identity JWT. Identity is spent once at sign-in, server side, in
 * app/api/admin/session; what the browser carries afterwards is an opaque
 * __Host- token whose SHA-256 is a row in admin_sessions, readable by no page
 * script. touch_admin_session resolves it, checks it has not expired, and
 * checks the admin is still active, all in one call.
 *
 * Authorisation stays live: is_active is read on every request, so revoking is
 * one UPDATE and it applies on the next click, and the 0029 trigger deletes the
 * revoked admin\'s sessions in the same statement.
 */

/**
 * Proof that requireAdmin ran.
 *
 * The brand is the point. Nothing else in the codebase can construct one of
 * these, so a function that demands an AdminIdentity cannot be called from an
 * unguarded place: it does not compile.
 *
 * The alternative, which the security review took apart, is checking the path.
 * Every path-based guard is bypassed by a Server Action posting to a page, or
 * by a handler saved somewhere the matcher does not name, and both of those
 * look completely ordinary in review.
 */
declare const ADMIN_BRAND: unique symbol;

export interface AdminIdentity {
  readonly [ADMIN_BRAND]: true;
  readonly adminId: string;
  readonly role: "owner" | "reviewer";
  readonly email: string;
  /** When this session ends, for the header clock. Not an authorization input. */
  readonly sessionExpiresAt: Date;
}

export type AdminResult =
  | { ok: true; admin: AdminIdentity }
  /**
   * One reason for everybody who is not a current admin.
   *
   * Not signed in, signed in but unknown, known but revoked, and known but
   * bound to a different Netlify account are all the same answer. A caller who
   * can tell them apart can enumerate the admin list by trying addresses.
   */
  | { ok: false };

const DENIED: AdminResult = { ok: false };

/**
 * Deduplicated per request.
 *
 * The console layout resolves the admin and so does every page inside it, which
 * on a force-dynamic route is two round trips for one answer. cache() makes the
 * second call free without either caller having to know about the other, and it
 * is per request rather than shared, so one admin's result can never be handed
 * to the next.
 */
export const requireAdmin = cache(async function requireAdmin(): Promise<AdminResult> {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value?.trim();

  // Shape checked before the database is touched, like the creator session.
  if (!looksLikeAdminSessionToken(token)) return DENIED;

  try {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT * FROM touch_admin_session(${hashAdminSessionToken(token)})`,
    );

    const row = result.rows?.[0] as
      | {
          admin_id?: string;
          admin_role?: string;
          admin_email?: string;
          expires_at?: string | Date;
        }
      | undefined;

    if (!row?.admin_id || !row.admin_email || !row.expires_at) return DENIED;
    if (row.admin_role !== "owner" && row.admin_role !== "reviewer") {
      return DENIED;
    }

    return {
      ok: true,
      admin: {
        adminId: row.admin_id,
        role: row.admin_role,
        email: row.admin_email,
        sessionExpiresAt: new Date(row.expires_at as string | Date),
      } as AdminIdentity,
    };
  } catch (error) {
    // A database that cannot answer is not permission to proceed.
    console.error(
      "[admin] could not resolve session:",
      error instanceof Error ? error.name : String(error),
    );
    return DENIED;
  }
})

/**
 * Only owners may do a thing.
 *
 * Separate from requireAdmin so the narrowing is visible at the call site
 * rather than being an `if` somebody can forget.
 */
export function isOwner(admin: AdminIdentity): boolean {
  return admin.role === "owner";
}
