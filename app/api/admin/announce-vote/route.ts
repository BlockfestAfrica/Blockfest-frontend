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
import { voteLiveEmail, votingPage } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Hundreds of sends in one call, like the stage announcement. The provider
   is fast but not instant, and this handler must outlive the batch rather
   than be killed halfway with nobody knowing who was reached. */
export const maxDuration = 300;

/**
 * Tell the campaign the community vote is open.
 *
 * Opening a round already mails the three to five nominees. Everybody else
 * heard nothing, which for the one prize decided purely by turnout made it
 * a contest between whoever already had the largest audience. A stage
 * opening has an Announce button that mails everyone; the vote, which
 * decides a hundred thousand naira, had no equivalent.
 *
 * A deliberate owner press rather than a side effect of opening the round.
 * The round is often staged the day before it runs, and a send riding along
 * with the open would mail the whole campaign about a vote that does not
 * accept a ballot yet.
 *
 * Paced rather than fired in parallel. Sequential sends are what the stage
 * announcement does and they are the safest thing for a young sending
 * reputation, but one at a time against a slow provider is the shape that
 * runs out the 300 second budget: at roughly a second each that is about
 * three hundred creators and then a silent truncation. Small fixed batches
 * keep the whole run comfortably inside the window without asking the
 * provider to accept everything at once.
 */

const schema = z.object({
  roundId: z.string().uuid("That is not a round."),
});

/** Sends started together. Four is well inside any sane provider limit and
    turns a five minute sequential run into about a minute. */
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
      SELECT r.id, r.week_no, r.status, r.opens_at, r.closes_at, r.campaign_id
        FROM vote_rounds r
        JOIN campaigns c ON c.id = r.campaign_id
       WHERE r.id = ${parsed.data.roundId}::uuid
         AND c.slug = ${MONICA_SLUG}
    `);
    const round = (found.rows?.[0] ?? null) as {
      id?: string;
      week_no?: number;
      status?: string;
      opens_at?: string;
      closes_at?: string;
      campaign_id?: string;
    } | null;

    if (!round?.id) {
      return NextResponse.json(
        { ok: false, message: "That round does not exist." },
        { status: 404 },
      );
    }

    /*
     * Open, and actually taking ballots. A round staged for tomorrow
     * morning is a page that refuses every cast, and mailing the campaign
     * to it spends the one announcement on a closed door.
     */
    if (round.status !== "open") {
      return NextResponse.json(
        { ok: false, message: "That round is not open." },
        { status: 409 },
      );
    }
    if (round.opens_at && new Date(round.opens_at).getTime() > Date.now()) {
      return NextResponse.json(
        {
          ok: false,
          message: `Voting has not started yet. It opens ${closingAt(String(round.opens_at))}, Lagos time. Announce it then.`,
        },
        { status: 409 },
      );
    }

    /*
     * Once per round, and the audit row IS the ledger, the same shape the
     * stage announcement uses.
     */
    const already = await db.execute(sql`
      SELECT 1 FROM audit_log
       WHERE action = 'vote.announced'
         AND entity_id = ${round.id}::uuid
       LIMIT 1
    `);
    if ((already.rows?.length ?? 0) > 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This vote has already been announced. Check the audit log to see when, and by whom.",
        },
        { status: 409 },
      );
    }

    const nominees = await db.execute(sql`
      SELECT c.full_name
        FROM vote_round_nominees n
        JOIN challenge_entries ce  ON ce.id = n.entry_id
        JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
        JOIN creators c            ON c.id = cc.creator_id
       WHERE n.round_id = ${round.id}::uuid
         AND n.withdrawn_at IS NULL
       ORDER BY n.display_order
    `);
    const names = (nominees.rows ?? [])
      .map((row) => String((row as { full_name?: string }).full_name ?? "").trim())
      .filter(Boolean);

    const recipients = await db.execute(sql`
      SELECT c.email, c.full_name
        FROM campaign_creators cc
        JOIN creators c ON c.id = cc.creator_id
       WHERE cc.campaign_id = ${round.campaign_id}::uuid
         AND COALESCE(cc.status, 'active') = 'active'
    `);

    /*
     * Claimed before the first send, not after the last. Written the other
     * way round it is a report rather than a lock: a batch that outruns
     * maxDuration leaves no row, the repeat check above passes, and a
     * retry mails everybody already reached. Failing toward a refused
     * retry is the safe direction when the alternative is several hundred
     * duplicates out of the quota that carries people's login links.
     */
    await db.execute(sql`
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (
        ${round.campaign_id}::uuid, ${admin.admin.adminId}::uuid,
        'vote.announced', 'vote_round', ${round.id}::uuid,
        ${JSON.stringify({ week_no: round.week_no, sent: 0, failed: 0, status: "started" })}::jsonb
      )
    `);

    const closes = closingAt(String(round.closes_at));
    const people = (recipients.rows ?? [])
      .map((row) => row as { email?: string; full_name?: string })
      .filter((person) => Boolean(person.email));

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < people.length; i += BATCH) {
      const results = await Promise.allSettled(
        people.slice(i, i + BATCH).map((person) =>
          sendEmail(
            voteLiveEmail({
              to: person.email as string,
              fullName: person.full_name ?? "",
              weekNo: Number(round.week_no ?? 0),
              nominees: names,
              closesAtLagos: closes,
              votingUrl: votingPage(),
            }),
          ),
        ),
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.sent) sent += 1;
        else failed += 1;
      }
    }

    await db.execute(sql`
      UPDATE audit_log
         SET after = ${JSON.stringify({ week_no: round.week_no, sent, failed, status: "finished" })}::jsonb
       WHERE action = 'vote.announced'
         AND entity_id = ${round.id}::uuid
    `);

    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    logError("admin/announce-vote", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
