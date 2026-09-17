import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { AdminIdentity } from "@/lib/admin/session";

export interface AdminRow {
  adminId: string;
  email: string;
  role: "owner" | "reviewer";
  isActive: boolean;
  createdAt: Date;
  /** Sessions not yet expired. Zero means signed out everywhere. */
  liveSessions: number;
  /** Last activity across their sessions, null if they have never signed in. */
  lastSeenAt: Date | null;
  /** True for the admin reading the page. */
  isYou: boolean;
}

/**
 * Who has admin access, and who is using it.
 *
 * Until now the only answer was a psql query. The roster was set by two
 * migrations (0009 and 0033) and the only way to know whether a third had
 * been added, or whether somebody's access was still live, was to read the
 * table by hand. 0033 said so itself: "Adding the next admin is this file
 * again with a different address. That does not scale."
 *
 * This is the read half of that, and only the read half. There is no route
 * that writes to admin_users, deliberately: granting console access to a
 * campaign holding real prize money should cost a code review and a deploy,
 * not one click from somebody whose own session might be the thing that was
 * stolen. A screen that can only tell you the truth cannot be turned against
 * you.
 *
 * Sessions are counted, never described. admin_sessions holds a SHA-256 of
 * the session token and nothing else identifying, so there is nothing here
 * that would help somebody impersonate a colleague, and no client address or
 * user agent exists to leak because 0029 declined to store them.
 *
 * password_hash is never selected. Every row in this table carries the
 * sentinel 'netlify-identity' rather than a real hash, but a query that
 * reaches for the column is one refactor away from rendering it.
 */
export async function adminRoster(admin: AdminIdentity): Promise<AdminRow[]> {
  const result = await getDb().execute(sql`
    SELECT a.id, a.email, a.role, a.is_active, a.created_at,
           count(s.id) FILTER (WHERE s.expires_at > now())::int AS live_sessions,
           max(s.last_seen_at) AS last_seen_at
      FROM admin_users a
      LEFT JOIN admin_sessions s ON s.admin_id = a.id
     GROUP BY a.id, a.email, a.role, a.is_active, a.created_at
     ORDER BY a.role = 'owner' DESC, a.is_active DESC, a.email ASC
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const seen = r.last_seen_at ? new Date(String(r.last_seen_at)) : null;
    return {
      adminId: String(r.id),
      email: String(r.email ?? ""),
      role: r.role === "owner" ? "owner" : "reviewer",
      isActive: Boolean(r.is_active),
      createdAt: new Date(String(r.created_at)),
      liveSessions: Number(r.live_sessions ?? 0),
      lastSeenAt: seen && !Number.isNaN(seen.getTime()) ? seen : null,
      isYou: String(r.id) === admin.adminId,
    };
  });
}
