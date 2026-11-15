import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { AdminIdentity } from "@/lib/admin/session";
import { MONICA_SLUG } from "@/lib/campaigns";

/**
 * A one-off email to the creators who said yes to future campaigns (0076).
 *
 * The first, and so far the only one, is Monica's ₦50 million Creator
 * Challenge: Monica asked the team to tell its creators once the campaign
 * had closed. The key names that one email, so a later broadcast is a new
 * key and starts with nobody sent.
 *
 * Who it goes to is the consent, not the registration. Hearing about future
 * campaigns was a separate, unticked box at registration, and the privacy
 * notice says the email address is used for the campaign itself and, only
 * for those who ticked it, for future campaigns. A creator who left it
 * unticked was told that refusing changes nothing, and mailing them a
 * sponsor's next campaign would be the thing it promised not to happen.
 *
 * A disqualified enrolment is left out as well. Their consent stands, but
 * disqualification here mostly meant a farmed or duplicate account, and a
 * sponsor's invitation is not owed to those.
 */
export const CREATOR_CHALLENGE = "monica-creator-challenge-2026";

/** A press's hold on one recipient, longer than a press runs. Same as ROVV's. */
const CLAIM_HOLDS = sql`interval '6 minutes'`;

/** The creators this is for, as a condition on `c` (creators). */
const AUDIENCE = sql`
  c.marketing_opt_in
  AND EXISTS (
    SELECT 1 FROM campaign_creators cc JOIN campaigns k ON k.id = cc.campaign_id
     WHERE cc.creator_id = c.id AND k.slug = ${MONICA_SLUG}
       AND cc.status <> 'disqualified')`;

export interface BroadcastCounts {
  /** Everybody who registered for Monica, whatever they ticked. */
  registered: number;
  /** Those who said yes to future campaigns and were not disqualified. */
  audience: number;
  /** Mails that left. Kept even for somebody who has since said stop. */
  sent: number;
  /** In the audience and not sent it yet. */
  left: number;
}

export async function broadcastCounts(admin: AdminIdentity, broadcast: string): Promise<BroadcastCounts> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT
      (SELECT count(DISTINCT cc.creator_id)
         FROM campaign_creators cc JOIN campaigns k ON k.id = cc.campaign_id
        WHERE k.slug = ${MONICA_SLUG})::int AS registered,
      (SELECT count(*) FROM creators c WHERE ${AUDIENCE})::int AS audience,
      (SELECT count(*) FROM broadcast_sends
        WHERE broadcast = ${broadcast} AND sent_at IS NOT NULL)::int AS sent,
      (SELECT count(*) FROM creators c
        WHERE ${AUDIENCE}
          AND NOT EXISTS (SELECT 1 FROM broadcast_sends b
                           WHERE b.broadcast = ${broadcast} AND b.creator_id = c.id
                             AND b.sent_at IS NOT NULL))::int AS left_to_send
  `);
  const r = (result.rows?.[0] ?? {}) as Record<string, unknown>;
  return {
    registered: Number(r.registered ?? 0),
    audience: Number(r.audience ?? 0),
    sent: Number(r.sent ?? 0),
    left: Number(r.left_to_send ?? 0),
  };
}

/** The next press's worth: in the audience, not sent, not held by a live press. */
export async function broadcastRecipients(
  admin: AdminIdentity,
  broadcast: string,
  limit: number,
): Promise<{ id: string; fullName: string; email: string }[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT c.id, c.full_name, c.email
      FROM creators c
      LEFT JOIN broadcast_sends b ON b.broadcast = ${broadcast} AND b.creator_id = c.id
     WHERE ${AUDIENCE}
       AND b.sent_at IS NULL
       AND (b.claimed_at IS NULL OR b.claimed_at <= now() - ${CLAIM_HOLDS})
     ORDER BY c.created_at, c.id
     LIMIT ${limit}
  `);
  return ((result.rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    fullName: String(r.full_name ?? ""),
    email: String(r.email),
  }));
}

/**
 * Claim one recipient just before their mail: true only for the press that
 * got them. Re-checks the audience, so somebody who said stop a moment ago
 * is not mailed. The stop link's hash is written with the claim, so the
 * link works the moment the mail lands.
 */
export async function claimBroadcast(
  admin: AdminIdentity,
  broadcast: string,
  creatorId: string,
  stopHash: string,
): Promise<boolean> {
  void admin;

  const result = await getDb().execute(sql`
    INSERT INTO broadcast_sends (broadcast, creator_id, claimed_at, stop_token_hash)
    SELECT ${broadcast}, c.id, now(), ${stopHash}
      FROM creators c
     WHERE c.id = ${creatorId}::uuid AND ${AUDIENCE}
    ON CONFLICT (broadcast, creator_id) DO UPDATE
       SET claimed_at = now(), stop_token_hash = EXCLUDED.stop_token_hash
     WHERE broadcast_sends.sent_at IS NULL
       AND (broadcast_sends.claimed_at IS NULL OR broadcast_sends.claimed_at <= now() - ${CLAIM_HOLDS})
    RETURNING creator_id
  `);
  return (result.rows?.length ?? 0) > 0;
}

/** Record that their mail left. */
export async function markBroadcastSent(admin: AdminIdentity, broadcast: string, creatorId: string): Promise<void> {
  void admin;

  await getDb().execute(sql`
    UPDATE broadcast_sends SET sent_at = now(), claimed_at = NULL
     WHERE broadcast = ${broadcast} AND creator_id = ${creatorId}::uuid
  `);
}

/** Give a claim back when the mail did not leave, so the next press retries. */
export async function releaseBroadcast(admin: AdminIdentity, broadcast: string, creatorId: string): Promise<void> {
  void admin;

  await getDb().execute(sql`
    UPDATE broadcast_sends SET claimed_at = NULL, stop_token_hash = NULL
     WHERE broadcast = ${broadcast} AND creator_id = ${creatorId}::uuid AND sent_at IS NULL
  `);
}
