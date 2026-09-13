import { sendEmailQuietly } from "@/lib/email/client";
import {
  approvalEmail,
  personalPage,
  rejectionEmail,
} from "@/lib/email/templates";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/session";
import { reviewSubmission } from "@/lib/admin/review";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";

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
    return NextResponse.json(
      { ok: false, message: "That submission is not reviewable." },
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

  return NextResponse.json({ ok: true, decision, entryId: outcome.entryId });
}
