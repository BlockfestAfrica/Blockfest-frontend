import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG, monicaRoutes } from "@/lib/campaigns";
import { siteUrl } from "@/lib/email/templates";

/**
 * The "stop these emails" link on a future-campaigns email (0076).
 *
 * The privacy notice promises it: "Every message we send for that reason
 * includes a way to stop it." Each mail gets its own token. Only the hash is
 * kept, beside the record that the mail went (broadcast_sends), so the
 * database alone cannot stop anybody's mail, and a token only ever withdraws
 * the consent of the person it was mailed to.
 *
 * The link opens a page that asks first, and only the page's button stops
 * anything. Mail scanners open every link in a message they inspect, and a
 * link that acted on a GET would quietly unsubscribe whoever's mail server
 * happens to scan.
 */

/** A copy, a test or the console preview: a link that stops nobody. */
export const SAMPLE_STOP_TOKEN = "sample";

export function newStopToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: stopTokenHash(token) };
}

export function stopTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function stopEmailsUrl(token: string): string {
  return `${siteUrl()}${monicaRoutes.stopEmails}?s=${encodeURIComponent(token)}`;
}

/** What pressing "Stop" did, said back on the page. */
export type StopOutcome = "stopped" | "already" | "unknown";

/**
 * Withdraw the marketing consent of whoever this token was mailed to.
 *
 * Immediate and unconditional, as the notice says ("We act on it and do not
 * ask why"). Pressing twice is harmless and answers "already". The opt-in
 * time is cleared with the flag because the table's check requires both
 * together (0006); the withdrawal itself is the audit row.
 */
export async function stopByToken(token: string): Promise<StopOutcome> {
  if (!token || token === SAMPLE_STOP_TOKEN) return "unknown";
  const db = getDb();

  const found = await db.execute(sql`
    SELECT creator_id, broadcast FROM broadcast_sends
     WHERE stop_token_hash = ${stopTokenHash(token)}
     LIMIT 1
  `);
  const hit = found.rows?.[0] as { creator_id?: string; broadcast?: string } | undefined;
  if (!hit?.creator_id) return "unknown";

  const stopped = await db.execute(sql`
    UPDATE creators SET marketing_opt_in = false, marketing_opt_in_at = NULL
     WHERE id = ${hit.creator_id}::uuid AND marketing_opt_in
    RETURNING id
  `);
  if ((stopped.rows?.length ?? 0) === 0) return "already";

  // Under Monica's campaign, so the campaign's purge takes it with the rest.
  await db.execute(sql`
    INSERT INTO audit_log (campaign_id, action, entity_type, entity_id, after)
    VALUES ((SELECT id FROM campaigns WHERE slug = ${MONICA_SLUG}),
            'creator.marketing_stopped', 'creator', ${hit.creator_id}::uuid,
            ${JSON.stringify({ via: "email link", broadcast: hit.broadcast })}::jsonb)
  `);
  return "stopped";
}
