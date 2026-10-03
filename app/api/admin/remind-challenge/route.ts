import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { REMINDER_ACTION, reminderRecipients } from "@/lib/admin/reminders";
import { logError } from "@/lib/log";
import { MONICA_SLUG } from "@/lib/campaigns";
import { closesWhen, closingAt } from "@/lib/format";
import { sendEmail } from "@/lib/email/client";
import { deadlineReminderEmail, personalPage } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Hundreds of sends in one call; see announce-challenge. */
export const maxDuration = 300;

/**
 * Remind creators who have nothing in that a stage is about to close.
 *
 * The owner asked for this as a button, pressed by a person the day before
 * or on the day of the close, not a scheduled job, the same way "Announce to
 * creators" tells them a stage has opened. It mirrors that route on purpose:
 * owners only, the stage must be live and still taking entries, one send per
 * stage held by an audit row claimed before the first mail, small batches,
 * and the counts written back to that row.
 *
 * Only to those with nothing waiting for review or approved for the stage
 * (lib/admin/reminders.ts), so a creator who has submitted is not nagged.
 */

const schema = z.object({
  challengeId: z.string().uuid("That is not a challenge."),
});

/** Sends started together, as the announcement does. */
const BATCH = 4;

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const ALREADY =
  "The reminder for this stage has already gone out. Check the audit log to see when, and by whom.";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  const db = getDb();

  try {
    const found = await db.execute(sql`
      SELECT ch.id, ch.week_no, ch.title, ch.starts_at, ch.ends_at, ch.status, ch.campaign_id
        FROM challenges ch
        JOIN campaigns c ON c.id = ch.campaign_id
       WHERE ch.id = ${parsed.data.challengeId}::uuid
         AND c.slug = ${MONICA_SLUG}
    `);
    const week = (found.rows?.[0] ?? null) as {
      id?: string;
      week_no?: number;
      title?: string;
      starts_at?: string | Date;
      ends_at?: string | Date;
      status?: string;
      campaign_id?: string;
    } | null;

    if (!week?.id) {
      return NextResponse.json(
        { ok: false, message: "That challenge does not exist." },
        { status: 404 },
      );
    }

    /* A reminder to submit to a week that is not taking entries would send
       people to a page that refuses them. */
    if (week.status !== "active") {
      return NextResponse.json(
        { ok: false, message: "That week is not live, so there is nothing to remind people about." },
        { status: 409 },
      );
    }
    /* Active is not open: an owner can set next week live ahead of its
       Monday, and the dates hold it shut until then. A reminder for it
       would tell everyone a stage closes that they cannot yet enter, and
       use up that stage's only send before the day it is due. */
    const startsAt = new Date(String(week.starts_at));
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() > Date.now()) {
      return NextResponse.json(
        {
          ok: false,
          message: `Week ${week.week_no} has not opened yet, so there is nothing to remind people about.`,
        },
        { status: 409 },
      );
    }
    const endsAt = new Date(String(week.ends_at));
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          ok: false,
          message: `Submissions for week ${week.week_no} have already closed, so a reminder would arrive too late.`,
        },
        { status: 409 },
      );
    }

    const already = await db.execute(sql`
      SELECT 1 FROM audit_log
       WHERE action = ${REMINDER_ACTION}
         AND entity_type = 'challenge'
         AND entity_id = ${week.id}::uuid
       LIMIT 1
    `);
    if ((already.rows?.length ?? 0) > 0) {
      return NextResponse.json({ ok: false, message: ALREADY }, { status: 409 });
    }

    const people = await reminderRecipients(week.id);
    /* Nothing claimed when there is nobody to remind, so a stage where
       everyone was in at the time can still be reminded later if that
       changes (a submission sent back for a change, say). */
    if (people.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Every active creator already has an entry in for this week." },
        { status: 409 },
      );
    }

    /*
     * Claimed before the first send, by a key derived from the stage, so a
     * crash mid-batch refuses the retry rather than mailing everybody
     * again, and two presses landing together cannot both hold it. Same
     * shape as the announcement's claim.
     */
    const claimed = await db.execute(sql`
      INSERT INTO audit_log (id, campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      SELECT md5(${`${REMINDER_ACTION}:`} || ${week.id}::text)::uuid,
             ${week.campaign_id}::uuid, ${admin.admin.adminId}::uuid,
             ${REMINDER_ACTION}, 'challenge', ${week.id}::uuid,
             ${JSON.stringify({ week_no: week.week_no, recipients: people.length, sent: 0, failed: 0, status: "started" })}::jsonb
       WHERE NOT EXISTS (
             SELECT 1 FROM audit_log
              WHERE action = ${REMINDER_ACTION}
                AND entity_type = 'challenge'
                AND entity_id = ${week.id}::uuid)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);
    const claimId = (claimed.rows?.[0] as { id?: string } | undefined)?.id;
    if (!claimId) {
      return NextResponse.json({ ok: false, message: ALREADY }, { status: 409 });
    }

    const when = closesWhen(endsAt);
    const closes = closingAt(endsAt);
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < people.length; i += BATCH) {
      const results = await Promise.allSettled(
        people.slice(i, i + BATCH).map((person) =>
          sendEmail(
            deadlineReminderEmail({
              to: person.email,
              fullName: person.fullName,
              weekNo: Number(week.week_no ?? 0),
              title: String(week.title ?? ""),
              closesWhen: when,
              closesAtLagos: closes,
              pageUrl: personalPage(),
            }),
          ),
        ),
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.sent) sent += 1;
        else failed += 1;
      }
      /* The running totals, so a send cut off part way (the 300 second
         budget, a deploy) leaves a row saying how far it got, and the
         console can say so rather than guess. */
      await db.execute(sql`
        UPDATE audit_log
           SET after = ${JSON.stringify({ week_no: week.week_no, recipients: people.length, sent, failed, status: "started" })}::jsonb
         WHERE id = ${claimId}::uuid
      `);
    }

    await db.execute(sql`
      UPDATE audit_log
         SET after = ${JSON.stringify({ week_no: week.week_no, recipients: people.length, sent, failed, status: "finished" })}::jsonb
       WHERE id = ${claimId}::uuid
    `);

    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    logError("admin/remind-challenge", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
