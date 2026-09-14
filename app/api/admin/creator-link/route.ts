import { sendEmail } from "@/lib/email/client";
import { personalLink, reissueEmail } from "@/lib/email/templates";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  auditLog,
  campaignCreators,
  campaigns,
  creators,
  getDb,
} from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { hashAccessToken, newAccessToken } from "@/lib/creator-access";
import { canonicalEmail } from "@/lib/campaign-registration";
import { MONICA_SLUG } from "@/lib/campaigns";
import { logWarning } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issue a creator a new personal link.
 *
 * The link is shown once at registration and only its hash is stored, which is
 * the right trade and leaves a real gap: somebody who loses it has no way back
 * in. The registration screen tells them to write to us, and until now there
 * was nothing on this side to answer with.
 *
 * An admin looks the creator up by the address they registered, and gets a
 * fresh link once, to pass on. That is deliberately a person-to-person step
 * rather than an automatic email, because there is no email provider yet and
 * because sending a new session to an address on request is worth a human
 * looking at while the list is this small.
 *
 * Issuing a new link invalidates the old one. That is the useful half: if the
 * old link went somewhere it should not have, this is also how you take it
 * back.
 */

const lookupSchema = z.object({
  email: z.string().trim().min(3).max(254),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  // Owner-only since the day-one audit. This mints a working session for
  // any creator from nothing but their email and rotates their real link
  // away, which with handle verification removed is the highest-leverage
  // capability a console session holds. The same reasoning that makes
  // correct-handle owner-only applies with more force here.
  if (!admin.ok || !isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  const parsed = lookupSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Enter the email address they registered with." },
      { status: 400 },
    );
  }

  // Matched the same way registration canonicalises it, so a creator who
  // registered with dots or a plus tag is still found by what they type.
  const emailCanonical = canonicalEmail(parsed.data.email);
  const db = getDb();

  const found = await db
    .select({
      enrolmentId: campaignCreators.id,
      name: creators.fullName,
      // As typed. canonicalEmail strips dots and plus tags to match, and
      // sending to the stripped form delivers somewhere they may not read.
      email: creators.email,
      campaignId: campaigns.id,
    })
    .from(campaignCreators)
    .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
    .innerJoin(campaigns, eq(campaigns.id, campaignCreators.campaignId))
    .where(
      and(
        eq(creators.emailCanonical, emailCanonical),
        eq(campaigns.slug, MONICA_SLUG),
      ),
    )
    .limit(1);

  const creator = found[0];
  if (!creator) {
    return NextResponse.json(
      { ok: false, message: "No creator registered with that address." },
      { status: 404 },
    );
  }

  const token = newAccessToken();

  await db
    .update(campaignCreators)
    .set({
      accessTokenHash: hashAccessToken(token),
      accessTokenIssuedAt: new Date(),
    })
    .where(eq(campaignCreators.id, creator.enrolmentId));

  /*
   * Recorded in audit_log, not only in stdout.
   *
   * This mints a working session for a named creator from nothing but their
   * email address, and it is open to reviewers as well as owners. A stdout line
   * is not a record: it is not queryable, it is not retained with the campaign,
   * and it is not what a dispute about who entered what gets answered from.
   * Every other action that moves a creator's standing writes an audit row, and
   * handing somebody the ability to submit as that creator is at least as
   * consequential as awarding them fifty points.
   *
   * The token itself is never written anywhere, here or in the log.
   */
  await db.insert(auditLog).values({
    campaignId: creator.campaignId,
    actorAdminId: admin.admin.adminId,
    action: "creator.link_reissued",
    entityType: "campaign_creator",
    entityId: creator.enrolmentId,
    note: `Reissued by ${admin.admin.email}. The previous link stopped working.`,
  });

  // Kept alongside, because a log line is what somebody greps during an
  // incident before they think to query the table.
  console.warn(
    "[admin/creator-link] reissued by",
    admin.admin.email,
    "for enrolment",
    creator.enrolmentId,
  );

  const link = personalLink(token);

  /*
   * Emailed AND still returned to the admin, deliberately.
   *
   * The obvious next step is to stop showing the admin the link now that it can
   * be emailed. That would be a trap: the rotation above has already destroyed
   * the old token, so if the send then fails the creator is locked out by the
   * very tool meant to let them back in, and nothing anywhere can recover the
   * new one. Worse, the commonest reason somebody needs a reissue is that they
   * mistyped their address at registration, which is exactly the case where the
   * mail cannot arrive.
   *
   * So the email is an addition. The admin keeps the copy they can read out.
   */
  const result = await sendEmail(
    reissueEmail({ to: creator.email, fullName: creator.name, personalLink: link }),
  );

  if (!result.sent) {
    logWarning("admin/creator-link email not sent", result.reason ?? "");
  }

  return NextResponse.json({
    ok: true,
    name: creator.name,
    // Whether the admin still has to pass this on by hand.
    emailed: result.sent,
    // Returned once, to this admin, to pass on. Only the hash is stored.
    link,
  });
}
