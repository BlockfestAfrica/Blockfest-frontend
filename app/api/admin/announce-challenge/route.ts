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

/** Sends started together, as the vote announcement does. One at a time
    against a provider at about a second a mail runs out the 300 second
    budget at roughly three hundred creators, and the ledger claimed before
    the batch then refuses the retry, so the rest are never told. Four at a
    time is well inside any sane provider limit. */
const BATCH = 4;

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
         AND entity_type = 'challenge'
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

    /*
     * The ledger is claimed BEFORE the first send, not after the last one.
     *
     * It used to be written after the loop, which made it a report rather
     * than a lock. This handler carries maxDuration = 300 and mails every
     * active creator in small batches; a batch that outruns that, or a deploy
     * mid-send, left no row at all. The repeat guard above then passed, and
     * pressing Announce again re-mailed everybody already reached - up to
     * several hundred duplicates, out of the same quota that carries the
     * personal links people log in with.
     *
     * Claiming first inverts the failure: a crash mid-batch now leaves a
     * row that REFUSES the retry, which is the safe direction. Somebody has
     * to read the counts to see how far it got, and the counts are filled
     * in below.
     */
    /*
     * And claimed by the primary key, so exactly one press can hold it. The
     * check above is two round trips before this line, and two presses
     * landing together both passed it; the claim's id is derived from the
     * challenge, so the second insert waits on the first's key and does
     * nothing. The NOT EXISTS keeps refusing a stage announced before this
     * change, whose row carries a random id. Same shape as the vote
     * announcement's claim.
     */
    const claimed = await db.execute(sql`
      INSERT INTO audit_log (id, campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      SELECT md5('challenge.announced:' || ${week.id}::text)::uuid,
             ${week.campaign_id}::uuid, ${admin.admin.adminId}::uuid,
             'challenge.announced', 'challenge', ${week.id}::uuid,
             ${JSON.stringify({ week_no: week.week_no, sent: 0, failed: 0, status: "started" })}::jsonb
       WHERE NOT EXISTS (
             SELECT 1 FROM audit_log
              WHERE action = 'challenge.announced'
                AND entity_type = 'challenge'
                AND entity_id = ${week.id}::uuid)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);
    const claimId = (claimed.rows?.[0] as { id?: string } | undefined)?.id;
    if (!claimId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This stage has already been announced. Check the audit log to see when, and by whom.",
        },
        { status: 409 },
      );
    }

    let sent = 0;
    let failed = 0;

    const people = (recipients.rows ?? [])
      .map((row) => row as { email?: string; full_name?: string })
      .filter((person) => Boolean(person.email));

    for (let i = 0; i < people.length; i += BATCH) {
      const results = await Promise.allSettled(
        people.slice(i, i + BATCH).map((person) =>
          sendEmail(
            challengeLiveEmail({
              to: person.email as string,
              fullName: person.full_name ?? "",
              weekNo: Number(week.week_no ?? 0),
              title: String(week.title ?? ""),
              question: week.question ?? null,
              brief: String(week.description ?? ""),
              basePoints: Number(week.base_points ?? 100),
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
    }

    /*
     * The counts, filled into the row claimed before the batch, because
     * "we announced stage 2 and 3 of 140 bounced" is the question this row
     * exists to answer. If this update never runs the row still stands and
     * still refuses a retry, carrying status 'started' to say the batch did
     * not finish cleanly.
     */
    await db.execute(sql`
      UPDATE audit_log
         SET after = ${JSON.stringify({ week_no: week.week_no, sent, failed, status: "finished" })}::jsonb
       WHERE id = ${claimId}::uuid
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
