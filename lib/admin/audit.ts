import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import type { AdminIdentity } from "@/lib/admin/session";

/**
 * The audit trail, read for the console.
 *
 * Takes an AdminIdentity so calling this from an unguarded route is a type
 * error, same discipline as every other lib/admin read. The join is LEFT on
 * admin_users because a row's actor can be legitimately absent: the identity
 * mismatch refusal audits with no actor by design, and an admin deleted from
 * the table leaves their history behind with the name detached.
 */

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  /** Null reads as "system": a refusal, or an engine write with no person. */
  adminEmail: string | null;
  note: string | null;
  /** The change, as the function recorded it. Shape varies per action. */
  after: unknown;
  createdAt: Date;
}

/**
 * Newest first, campaign rows plus the campaign-less ones.
 *
 * Sign-ins and identity binds carry no campaign_id, and a trail that hides
 * the sign-in that anchors a day of actions is not a trail. 500 rows is
 * weeks of activity for a two-admin console; the page reveals ten at a time.
 */
export async function auditTrail(
  admin: AdminIdentity,
  limit = 500,
): Promise<AuditRow[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT l.id, l.action, l.entity_type, l.note, l.after, l.created_at,
           a.email AS admin_email
      FROM audit_log l
      LEFT JOIN admin_users a ON a.id = l.actor_admin_id
      LEFT JOIN campaigns c   ON c.id = l.campaign_id
     WHERE l.campaign_id IS NULL OR c.slug = ${MONICA_SLUG}
     ORDER BY l.created_at DESC
     LIMIT ${limit}
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      action: String(r.action),
      entityType: String(r.entity_type),
      adminEmail: r.admin_email ? String(r.admin_email) : null,
      note: r.note ? String(r.note) : null,
      after: r.after ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  });
}
