import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { AdminIdentity } from "@/lib/admin/session";

export interface PendingHandleRequest {
  id: string;
  creatorName: string;
  creatorEmail: string;
  platform: string;
  oldHandle: string;
  requestedHandle: string;
  reason: string;
  createdAt: Date;
}

/**
 * Every request waiting for a decision, oldest first.
 *
 * Oldest first because a request blocks a creator from entering: their
 * submissions keep being refused against the wrong handle until somebody
 * decides, so the queue is worked in the order people got stuck.
 */
export async function pendingHandleRequests(
  admin: AdminIdentity,
): Promise<PendingHandleRequest[]> {
  void admin; // Reading the queue is admin-only; the type is the proof.

  const result = await getDb().execute(sql`
    SELECT r.id, r.platform, r.old_handle, r.requested_handle, r.reason,
           r.created_at, c.full_name, c.email
      FROM handle_change_requests r
      JOIN campaign_creators cc ON cc.id = r.campaign_creator_id
      JOIN creators c ON c.id = cc.creator_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at ASC
     LIMIT 100
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      creatorName: String(r.full_name),
      creatorEmail: String(r.email),
      platform: String(r.platform),
      oldHandle: String(r.old_handle),
      requestedHandle: String(r.requested_handle),
      reason: String(r.reason),
      createdAt: new Date(r.created_at as string),
    };
  });
}
