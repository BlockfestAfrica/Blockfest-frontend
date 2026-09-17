import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { sendEmailQuietly } from "@/lib/email/client";
import {
  awardEmail,
  disqualifiedEmail,
  personalPage,
} from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Disqualify a creator, which is the campaign's last resort.
 *
 * void_enrolment has existed since 0027 and could not be called: no route,
 * no console control, nothing. The engine has been enforcing the state all
 * along, refusing submissions and approvals and announcements for a
 * disqualified creator, while the act of disqualifying anybody was
 * reachable only by somebody with a psql prompt. A rule nobody can invoke
 * is a rule the campaign does not actually have, and the fraud the voting
 * and points engines are built to survive ends here or nowhere.
 *
 * Owners only, like announcing a winner and for the same reason: this one
 * takes money away rather than giving it. The engine clamps the ledger
 * reversal and writes its own audit row; this route validates shape,
 * forwards, and translates. The reason is mandatory in SQL, which is what
 * makes a disqualification answerable later.
 */

const schema = z.object({
  enrolmentId: z.string().uuid("That is not a creator."),
  reason: z
    .string()
    .trim()
    .min(1, "Say why. A disqualification with no reason cannot be answered.")
    .max(300, "Keep the reason under three hundred characters."),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, string> = {
  P0401: "Only a signed-in admin can do this.",
  P0502: "Say why. A disqualification with no reason cannot be answered.",
  P0201: "That creator is not in this campaign.",
};

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

  try {
    const result = await getDb().execute(
      sql`SELECT void_enrolment(${parsed.data.enrolmentId}::uuid, ${admin.admin.adminId}::uuid, ${parsed.data.reason}::text) AS reversed`,
    );
    const row = (result.rows?.[0] ?? {}) as { reversed?: number };
    /*
     * void_enrolment returns the number of social handles it released, not
     * points: the name this route gave it was simply wrong, and the figure
     * was being quoted to a disqualified creator as the points they lost.
     * The real numbers are both in the audit row the function writes, in
     * the same transaction, so they are readable the moment it returns.
     */
    const handlesReleased = Number(row.reversed ?? 0);

    const ledger = await getDb().execute(sql`
      SELECT (after->>'referral_points_reversed')::int AS points
        FROM audit_log
       WHERE action = 'enrolment.voided'
         AND entity_id = ${parsed.data.enrolmentId}::uuid
       ORDER BY created_at DESC
       LIMIT 1
    `);
    const pointsReversed = Number(
      (ledger.rows?.[0] as { points?: number } | undefined)?.points ?? 0,
    );

    /*
     * Tell them, and tell whoever loses points because of them.
     *
     * The mandatory reason exists, in this route's own words, to make a
     * disqualification answerable later. It was answerable to admins and
     * to nobody else: the creator found out by filming a week's work,
     * publishing it, pasting the link and meeting a refusal that named a
     * support address but never the reason. Fail-soft after the commit,
     * like every other creator mail: the decision stands whatever the
     * provider does.
     */
    after(async () => {
      try {
        const who = await getDb().execute(sql`
          SELECT c.email, c.full_name
            FROM campaign_creators cc
            JOIN creators c ON c.id = cc.creator_id
           WHERE cc.id = ${parsed.data.enrolmentId}::uuid
        `);
        const person = (who.rows?.[0] ?? null) as {
          email?: string;
          full_name?: string;
        } | null;
        if (person?.email) {
          await sendEmailQuietly(
            disqualifiedEmail({
              to: person.email,
              fullName: person.full_name ?? "",
              reason: parsed.data.reason,
              pointsReversed,
              personalPage: personalPage(),
            }),
            "disqualification notice",
          );
        }

        /*
         * And the referrer, whose points were clawed back for somebody
         * else's misconduct. It is the only downward movement in the
         * system caused by another person, and it was the only one that
         * went unannounced: the clawback is a direct ledger insert, so no
         * award notice fires for it.
         */
        /*
         * Only the referrers who actually lost something, and only what
         * they actually lost.
         *
         * This used to mail every referrer of the voided creator a flat
         * "-10 points", which was wrong three ways: the referral is worth
         * whatever point_rules says and not ten, the reversal is clamped to
         * what the referrer still held, and a referral that was never paid
         * has nothing to take back. People who lost nothing were being told
         * they had, during the week a one and a half million naira
         * leaderboard settles, about points their own history page does not
         * show.
         *
         * Joining the reversal row itself means the figure in the mail is
         * the figure in the ledger, and a referrer with no reversal row
         * produces no mail.
         */
        if (pointsReversed <= 0) return;

        const referrers = await getDb().execute(sql`
          SELECT DISTINCT ON (r.id)
                 c.email, c.full_name, cc.points_total,
                 (-pl.points) AS reversed
            FROM referrals r
            JOIN campaign_creators cc ON cc.id = r.referrer_campaign_creator_id
            JOIN creators c           ON c.id = cc.creator_id
            JOIN point_ledger pl
              ON pl.campaign_creator_id = cc.id
             AND pl.source = 'referral'
             AND pl.points < 0
             AND (pl.idempotency_key = 'referral_reversal:' || r.id::text
                  OR pl.idempotency_key LIKE 'referral_reversal:' || r.id::text || ':%')
           WHERE r.referred_campaign_creator_id = ${parsed.data.enrolmentId}::uuid
           ORDER BY r.id, pl.created_at DESC
        `);
        for (const ref of referrers.rows ?? []) {
          const person = ref as {
            email?: string;
            full_name?: string;
            points_total?: number;
            reversed?: number;
          };
          if (!person.email) continue;
          await sendEmailQuietly(
            awardEmail({
              to: person.email,
              fullName: person.full_name ?? "",
              sourceLabel: "Referral reversed",
              points: -Number(person.reversed ?? 0),
              note: "A creator you referred was removed from the campaign, so the referral points they earned you have been reversed. Nothing else about your standing changes.",
              pointsTotal: Number(person.points_total ?? 0),
              personalPage: personalPage(),
            }),
            "referral clawback notice",
          );
        }
      } catch (error) {
        logError("admin/void notices", error);
      }
    });

    return NextResponse.json({
      ok: true,
      pointsReversed,
      handlesReleased,
    });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;
    if (known) {
      return NextResponse.json({ ok: false, message: known }, { status: 400 });
    }
    logError("admin/void", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
