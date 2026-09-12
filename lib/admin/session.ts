import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { currentIdentityUser } from "@/lib/admin/identity";

/**
 * Who is allowed to act as an admin, decided on every single request.
 *
 * Netlify Identity answers one question: which verified address is signed in.
 * It does not answer whether that person is still an admin, and it must not be
 * asked to. Roles ride in the nf_jwt, which is valid for about an hour and is
 * not invalidated when a role is stripped, so trusting it would mean a stolen
 * laptop keeps approving entries for an hour after being revoked.
 *
 * So: Identity for identity, a row in admin_users for authorisation, read live.
 * Revoking is one UPDATE and it applies on the next click.
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

export async function requireAdmin(): Promise<AdminResult> {
  const identity = await currentIdentityUser();
  if (!identity.ok) return DENIED;

  const { email, id } = identity.user;
  if (!email || !id) return DENIED;

  try {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT * FROM resolve_admin(${email}, ${id})`,
    );

    const row = result.rows?.[0] as
      | { admin_id?: string; admin_role?: string }
      | undefined;

    if (!row?.admin_id) return DENIED;
    if (row.admin_role !== "owner" && row.admin_role !== "reviewer") {
      return DENIED;
    }

    return {
      ok: true,
      admin: {
        adminId: row.admin_id,
        role: row.admin_role,
        email,
      } as AdminIdentity,
    };
  } catch (error) {
    // A database that cannot answer is not permission to proceed.
    console.error(
      "[admin] could not resolve admin:",
      error instanceof Error ? error.name : String(error),
    );
    return DENIED;
  }
}

/**
 * Only owners may do a thing.
 *
 * Separate from requireAdmin so the narrowing is visible at the call site
 * rather than being an `if` somebody can forget.
 */
export function isOwner(admin: AdminIdentity): boolean {
  return admin.role === "owner";
}
