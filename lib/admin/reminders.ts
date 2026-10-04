import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { AdminIdentity } from "@/lib/admin/session";
import type { ReminderSent } from "@/lib/reminder-rules";

/**
 * The deadline reminder: who it goes to, and whether it has gone.
 *
 * The owner asked for a button, pressed by a person and never on a timer,
 * that tells creators a stage closes in the next day, the same way "Announce
 * to creators" tells them one has opened. It goes only to creators who have
 * nothing in for the stage: an active enrolment with no submission waiting
 * for review or approved. That is someone who never submitted, took theirs
 * back (withdrawing deletes the submission), or had their only link sent
 * back for a change. Somebody who has already submitted is not nagged.
 *
 * The audit rows are the ledger, as for the announcement: up to two
 * reminders per stage (lib/reminder-rules.ts), each claimed before its first
 * send, with the counts filled in as it goes.
 */

export const REMINDER_ACTION = "challenge.reminded";

/** Active creators in the stage's campaign with nothing in for it. */
const needsReminding = (challengeId: string): SQL => sql`
  FROM campaign_creators cc
  JOIN creators c   ON c.id = cc.creator_id
  JOIN challenges ch ON ch.id = ${challengeId}::uuid
 WHERE cc.campaign_id = ch.campaign_id
   AND COALESCE(cc.status, 'active') = 'active'
   AND NOT EXISTS (
         SELECT 1
           FROM challenge_entries ce
           JOIN submissions s ON s.entry_id = ce.id
          WHERE ce.challenge_id = ch.id
            AND ce.campaign_creator_id = cc.id
            AND s.status IN ('pending', 'approved'))
`;

/** Who the reminder for this stage would go to, now. */
export async function reminderRecipients(
  challengeId: string,
): Promise<{ email: string; fullName: string }[]> {
  const result = await getDb().execute(
    sql`SELECT c.email, c.full_name ${needsReminding(challengeId)}`,
  );
  return ((result.rows ?? []) as { email?: string; full_name?: string }[])
    .filter((row) => Boolean(row.email))
    .map((row) => ({ email: String(row.email), fullName: String(row.full_name ?? "") }));
}

export interface ReminderState {
  /** Active creators with nothing in for the stage, right now. */
  waiting: number;
  /** Active creators in the campaign. */
  active: number;
  /** The reminders already sent for this stage, oldest first. */
  sent: ReminderSent[];
}

/** The reminder rows for a stage, oldest first. */
export async function remindersSent(challengeId: string): Promise<ReminderSent[]> {
  const result = await getDb().execute(sql`
    SELECT created_at, after
      FROM audit_log
     WHERE action = ${REMINDER_ACTION}
       AND entity_type = 'challenge'
       AND entity_id = ${challengeId}::uuid
     ORDER BY created_at
  `);
  return ((result.rows ?? []) as {
    created_at?: Date | string;
    after?: { sent?: number; failed?: number; status?: string; number?: number };
  }[]).map((row, index) => ({
    number: Number(row.after?.number ?? index + 1),
    at: new Date(String(row.created_at)).toISOString(),
    sent: Number(row.after?.sent ?? 0),
    failed: Number(row.after?.failed ?? 0),
    finished: row.after?.status === "finished",
  }));
}

/** What the console shows on the live week's row. */
export async function reminderState(
  admin: AdminIdentity,
  challengeId: string,
): Promise<ReminderState> {
  void admin; // Reading is admin-only; the type is the proof.
  const db = getDb();
  const [waiting, active, sent] = await Promise.all([
    db.execute(sql`SELECT count(*)::int AS n ${needsReminding(challengeId)}`),
    db.execute(sql`
      SELECT count(*)::int AS n
        FROM campaign_creators cc
        JOIN challenges ch ON ch.id = ${challengeId}::uuid
       WHERE cc.campaign_id = ch.campaign_id
         AND COALESCE(cc.status, 'active') = 'active'
    `),
    remindersSent(challengeId),
  ]);
  const count = (r: { rows?: unknown[] }) =>
    Number((r.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
  return { waiting: count(waiting), active: count(active), sent };
}
