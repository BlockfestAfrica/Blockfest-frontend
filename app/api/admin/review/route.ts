import { sendEmail, sendEmailQuietly } from "@/lib/email/client";
import {
  approvalEmail,
  personalPage,
  referralCreditEmail,
  rejectionEmail,
} from "@/lib/email/templates";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";
import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/session";
import { reviewSubmission } from "@/lib/admin/review";
import { readJsonBody, sameOrigin, throttleKey } from "@/lib/admin/request";
import { allowKeyStrict } from "@/lib/throttle";
import { getDb } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deciding a submission.
 *
 * The checks run cheapest first, and each one is a hard stop:
 *
 *  1. Same origin, before the body is read. The session is a cookie, so without
 *     this any other site can make a signed-in admin approve an entry silently.
 *  2. Size, before parsing. A decision is a few hundred bytes.
 *  3. Admin, against the database rather than the token, so a revoked admin is
 *     refused on the next click rather than in an hour.
 *  4. Shape, parsed rather than trusted.
 *  5. The submission belongs to this campaign, checked inside reviewSubmission.
 *
 * Every failure answers the same way to a caller who is not an admin: 403 with
 * no detail. Telling an anonymous caller that a submission id exists, or that
 * their address is known but revoked, is telling them something worth knowing.
 */

const decisionSchema = z.object({
  submissionId: z.string().uuid("That is not a submission."),
  decision: z.enum(["approved", "rejected"]),
  /**
   * Shown to the creator on their own page, so it is bounded and trimmed. A
   * rejection with no reason is one a creator argues with rather than learns
   * from, so it is required for a rejection and optional for an approval.
   */
  note: z.string().trim().max(500).optional(),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;

  /*
   * A throttle on a route that mails. Reviewing is idempotent in the engine
   * but not in the inbox: re-submitting the same decision sends the creator
   * another approval or rejection every time, and nothing bounded how often
   * that could happen. Strict, because what is being rationed is outbound
   * mail, which is the exact case allowKeyStrict was written for.
   */
  if (!(await allowKeyStrict(throttleKey(request), "admin-review", 240, 3600))) {
    return NextResponse.json(
      { ok: false, message: "That is a lot of decisions at once. Wait a moment and try again." },
      { status: 429 },
    );
  }

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  const parsed = decisionSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Check the decision.",
      },
      { status: 400 },
    );
  }

  const { submissionId, decision, note } = parsed.data;

  if (decision === "rejected" && !note) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "A rejection needs a reason. The creator sees it, and it is the only thing that tells them what to change.",
      },
      { status: 400 },
    );
  }

  const outcome = await reviewSubmission(
    admin.admin,
    submissionId,
    decision,
    note ?? null,
  );

  if (!outcome.ok) {
    // not_found and wrong_campaign answer identically, so this cannot be used
    // to discover which ids exist.

    if (outcome.reason === "already_credited") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Another creator has already been approved for this exact post, so this one cannot also be paid for it. Open both links and reject whichever is not the author's own.",
        },
        { status: 409 },
      );
    }

    if (outcome.reason === "disqualified") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This creator has been disqualified, so their work cannot be approved. You can still reject it to clear the queue.",
        },
        { status: 409 },
      );
    }

    if (outcome.reason === "superseded") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This creator has already sent a replacement for that platform, so this one cannot be changed. Decide the newer submission instead.",
        },
        { status: 409 },
      );
    }

    if (outcome.reason === "failed") {
      return NextResponse.json(
        { ok: false, message: "Something went wrong at our end." },
        { status: 500 },
      );
    }
    /* Reached when the row is gone, which now has an ordinary cause: the
       creator took the entry back before anybody ruled on it, so a queue
       left open on a screen can name a submission that no longer exists.
       Still merged with wrong_campaign, so the reason cannot be used to
       ask which ids are real. */
    return NextResponse.json(
      {
        ok: false,
        message:
          "That submission is not reviewable any more. The creator may have taken it back before review. Reload the queue to see what is left.",
      },
      { status: 404 },
    );
  }

  /*
   * Tell the creator. This is the gap the owner named after testing: "there is
   * no any other email being sent when approval has been done."
   *
   * A creator who published something and heard nothing cannot tell being
   * accepted from being ignored, and on a rejection the note is the entire
   * point of requiring one. It is written to be read on their own page, and
   * until now nothing brought them back to look.
   *
   * Awaited, because a serverless function may be frozen as soon as it
   * responds, and failures are swallowed: the decision is already recorded and
   * a mail provider having a bad minute must not turn an approval into an
   * error the reviewer has to think about.
   */
  const { creator } = outcome;
  await sendEmailQuietly(
    decision === "approved"
      ? approvalEmail({
          to: creator.email,
          fullName: creator.fullName,
          weekNo: creator.weekNo,
          platformLabel:
            platformLabels[creator.platform as CampaignPlatform] ??
            creator.platform,
          pointsAwarded: creator.pointsAwarded,
          pointsTotal: creator.pointsTotal,
          personalPage: personalPage(),
        })
      : rejectionEmail({
          to: creator.email,
          fullName: creator.fullName,
          weekNo: creator.weekNo,
          platformLabel:
            platformLabels[creator.platform as CampaignPlatform] ??
            creator.platform,
          // Required by the schema above for a rejection, so this is never the
          // fallback in practice. Present because a template that can render an
          // empty reason is a template that one day does.
          note: note ?? "No reason was recorded.",
          personalPage: personalPage(),
          canResubmit: creator.weekStillOpen,
        }),
    `${decision} for submission ${submissionId}`,
  );

  /*
   * And tell whoever brought them in.
   *
   * The referral bonus has paid automatically since migration 0014, on the
   * first approval of the creator who was referred, and it has never said a
   * word to the person who earned it. That is the one mechanic that grows
   * the campaign, paying out in silence.
   *
   * Only on an approval, and only the first: the query asks for a referral
   * that is already awarded and has no 'referral.credited' row against it,
   * so a re-approval or a second entry finds nothing. The audit row is the
   * ledger, the same shape the stage announcement uses, which means the
   * record of who was told is the same record that stops them being told
   * twice.
   *
   * After the response, because the reviewer is waiting and none of this
   * changes their decision.
   */
  if (decision === "approved") {
    after(async () => {
      try {
        const db = getDb();
        const found = await db.execute(sql`
          SELECT r.id, r.campaign_id, r.code_used,
                 ref.email        AS referrer_email,
                 ref.full_name    AS referrer_name,
                 brought.full_name AS referred_name,
                 rcc.points_total AS referrer_total,
                 pl.points        AS points
            FROM referrals r
            JOIN campaign_creators rcc ON rcc.id = r.referrer_campaign_creator_id
            JOIN creators ref         ON ref.id = rcc.creator_id
            JOIN campaign_creators bcc ON bcc.id = r.referred_campaign_creator_id
            JOIN creators brought     ON brought.id = bcc.creator_id
            LEFT JOIN point_ledger pl ON pl.id = r.awarded_ledger_id
           WHERE r.referred_campaign_creator_id = ${outcome.creator.enrolmentId}::uuid
             AND r.awarded_at IS NOT NULL
             AND COALESCE(rcc.status, 'active') = 'active'
             AND NOT EXISTS (
               SELECT 1 FROM audit_log al
                WHERE al.action = 'referral.credited'
                  AND al.entity_id = r.id
             )
           LIMIT 1
        `);
        const paid = (found.rows?.[0] ?? null) as {
          id?: string;
          campaign_id?: string;
          code_used?: string;
          referrer_email?: string;
          referrer_name?: string;
          referred_name?: string;
          referrer_total?: number;
          points?: number;
        } | null;

        if (!paid?.id || !paid.referrer_email) return;

        /* sendEmail, not sendEmailQuietly: the quiet one returns void, so
           the audit row below would have recorded notified:false on every
           successful send. An audit trail that lies is worse than none. */
        const result = await sendEmail(
          referralCreditEmail({
            to: paid.referrer_email,
            fullName: paid.referrer_name ?? "",
            referredName: paid.referred_name ?? "someone",
            points: Number(paid.points ?? 0),
            pointsTotal: Number(paid.referrer_total ?? 0),
            referralCode: String(paid.code_used ?? ""),
            personalPage: personalPage(),
          }),
        );
        if (!result.sent) {
          logError(
            "admin/review referral notice",
            new Error(`referral credit ${paid.id} not sent`),
          );
        }

        /*
         * Written whether or not the mail left, carrying which it was. A
         * failed send that is not recorded would be retried on every later
         * approval of the same creator, and there is no later approval to
         * hang it on anyway: this is a once-per-referral event.
         */
        await db.execute(sql`
          INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
          VALUES (
            ${paid.campaign_id}::uuid, NULL,
            'referral.credited', 'referral', ${paid.id}::uuid,
            ${JSON.stringify({ points: Number(paid.points ?? 0), notified: result.sent })}::jsonb
          )
        `);
      } catch (error) {
        logError("admin/review referral notice", error);
      }
    });
  }

  return NextResponse.json({ ok: true, decision, entryId: outcome.entryId });
}
