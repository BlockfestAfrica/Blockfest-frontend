import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { logError } from "@/lib/log";
import { MONICA_SLUG } from "@/lib/campaigns";
import { closingAt } from "@/lib/format";
import { sendEmail } from "@/lib/email/client";
import { challengeLiveEmail, personalPage } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Hundreds of sends in one call. The provider is fast but not instant, and
   this handler must outlive the batch rather than be killed halfway with
   nobody knowing who was reached. */
export const maxDuration = 300;

/**
 * Tell every active creator that a stage is live.
 *
 * The campaign promises "a new challenge drops with every stage" and,
 * until this route, nothing delivered it. Every other template fires
 * because a creator acted or because an admin acted on one creator; none
 * fired because the campaign itself moved, so four Mondays of retention
 * rested on people remembering to open a bookmarked link.
 *
 * A deliberate owner action, not a side effect of flipping the status.
 * Editing a challenge is something the team does repeatedly while writing
 * it, and a send that rode along with the edit would mail the campaign on
 * a typo fix. So the console asks, the owner presses, and this records
 * what it did.
 *
 * It carries no credential, and could not even if we wanted it to: only
 * a hash of each creator's token is stored, so no bulk sender can rebuild
 * a personal link. The mail points at the page; a signed-in creator lands
 * on it and anybody else meets the locked screen, which offers a way
 * back. Still owners only, and still written to a per-challenge ledger so
 * the same stage cannot be announced twice by two people or one double
 * click.
 */

const schema = z.object({
  challengeId: z.string().uuid("That is not a challenge."),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

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
      SELECT ch.id, ch.week_no, ch.title, ch.description, ch.question,
             ch.base_points, ch.ends_at, ch.status, ch.campaign_id
        FROM challenges ch
        JOIN campaigns c ON c.id = ch.campaign_id
       WHERE ch.id = ${parsed.data.challengeId}::uuid
         AND c.slug = ${MONICA_SLUG}
    `);
    const week = (found.rows?.[0] ?? null) as {
      id?: string;
      week_no?: number;
      title?: string;
      description?: string;
      question?: string | null;
      base_points?: number;
      ends_at?: string;
      status?: string;
      campaign_id?: string;
    } | null;

    if (!week?.id) {
      return NextResponse.json(
        { ok: false, message: "That challenge does not exist." },
        { status: 404 },
      );
    }

    /*
     * A draft is not live, and announcing one would send creators to a
     * week the engine refuses entries for. The status is the campaign's
     * own statement about whether the week has started.
     */
    if (week.status !== "active") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "That week is not active yet. Flip it active first, then announce it.",
        },
        { status: 409 },
      );
    }

    /*
     * Once per stage. The audit row IS the ledger: a second press finds
     * the first one and refuses, which is cheaper and harder to get wrong
     * than a new column, and it means the record of who announced what is
     * the same record that prevents the double send.
     */
    const already = await db.execute(sql`
      SELECT 1 FROM audit_log
       WHERE action = 'challenge.announced'
         AND entity_id = ${week.id}::uuid
       LIMIT 1
    `);
    if ((already.rows?.length ?? 0) > 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This stage has already been announced. Check the audit log to see when, and by whom.",
        },
        { status: 409 },
      );
    }

    /*
     * Active creators only. A disqualified enrolment is not invited to a
     * new week, which is also the one place this route touches the state
     * the void endpoint sets.
     */
    const recipients = await db.execute(sql`
      SELECT c.email, c.full_name
        FROM campaign_creators cc
        JOIN creators c ON c.id = cc.creator_id
       WHERE cc.campaign_id = ${week.campaign_id}::uuid
         AND COALESCE(cc.status, 'active') = 'active'
    `);

    const closes = closingAt(String(week.ends_at));
    let sent = 0;
    let failed = 0;

    for (const row of recipients.rows ?? []) {
      const person = row as { email?: string; full_name?: string };
      if (!person.email) continue;

      const result = await sendEmail(
        challengeLiveEmail({
          to: person.email,
          fullName: person.full_name ?? "",
          weekNo: Number(week.week_no ?? 0),
          title: String(week.title ?? ""),
          question: week.question ?? null,
          brief: String(week.description ?? ""),
          basePoints: Number(week.base_points ?? 100),
          closesAtLagos: closes,
          pageUrl: personalPage(),
        }),
      );
      if (result.sent) sent += 1;
      else failed += 1;
    }

    /*
     * Written after the batch, carrying the counts, because "we announced
     * stage 2 and 3 of 140 bounced" is the question this row exists to
     * answer. It is also the lock the repeat check above reads.
     */
    await db.execute(sql`
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (
        ${week.campaign_id}::uuid, ${admin.admin.adminId}::uuid,
        'challenge.announced', 'challenge', ${week.id}::uuid,
        ${JSON.stringify({ week_no: week.week_no, sent, failed })}::jsonb
      )
    `);

    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    logError("admin/announce-challenge", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
