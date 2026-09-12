import "server-only";
import { and, eq, sql } from "drizzle-orm";
import {
  campaignCreators,
  campaigns,
  challengeEntries,
  challenges,
  creators,
  creatorSocialHandles,
  getDb,
  submissions,
} from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import type { AdminIdentity } from "@/lib/admin/session";

/**
 * The only place review() is called.
 *
 * Approving a submission mints points, and points decide how 5,000,000 naira is
 * split, so this is the single most sensitive call in the codebase. It takes an
 * AdminIdentity, which nothing outside requireAdmin can construct, so calling it
 * from an unguarded route or a Server Action is a type error rather than a
 * security incident.
 *
 * A test asserts that no other file in the repository contains a review( call
 * inside a sql template, because the type only protects callers that go through
 * this module.
 */

export type ReviewDecision = "approved" | "rejected";

export type ReviewOutcome =
  | { ok: true; entryId: string }
  | { ok: false; reason: "not_found" | "wrong_campaign" | "failed" };

/**
 * Decide a submission.
 *
 * The submission is checked to belong to this campaign before anything is
 * written. Without that, a valid admin of this campaign could review a
 * submission from another one by id, which will matter the moment a second
 * campaign exists and is not worth remembering to add then.
 */
export async function reviewSubmission(
  admin: AdminIdentity,
  submissionId: string,
  decision: ReviewDecision,
  note: string | null,
): Promise<ReviewOutcome> {
  const db = getDb();

  const found = await db
    .select({
      id: submissions.id,
      entryId: submissions.entryId,
      slug: campaigns.slug,
    })
    .from(submissions)
    .innerJoin(challengeEntries, eq(challengeEntries.id, submissions.entryId))
    .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  const row = found[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.slug !== MONICA_SLUG) return { ok: false, reason: "wrong_campaign" };

  try {
    // review() requires a real admin id and raises reviewer_required on NULL,
    // so the actor is never optional. It then reconciles the entry's award,
    // which is idempotent: deciding the same way twice writes no second award.
    await db.execute(
      sql`SELECT review(${submissionId}::uuid, ${decision}::submission_status, ${admin.adminId}::uuid, ${note})`,
    );
    return { ok: true, entryId: row.entryId };
  } catch (error) {
    console.error(
      "[admin/review]",
      error instanceof Error ? error.message : String(error),
    );
    return { ok: false, reason: "failed" };
  }
}

/**
 * The queue: everything waiting, oldest first.
 *
 * Oldest first because a review queue worked newest-first leaves the earliest
 * entrants waiting longest, and they are the ones who entered on day one.
 */
export async function pendingSubmissions(admin: AdminIdentity, limit = 50) {
  void admin; // Reading the queue is admin-only; the type is the proof.
  const db = getDb();

  return db
    .select({
      id: submissions.id,
      platform: submissions.platform,
      url: submissions.url,
      submittedAt: submissions.submittedAt,
      challengeTitle: challenges.title,
      weekNo: challenges.weekNo,
      entryId: submissions.entryId,
      /*
       * Who submitted it, and which account they said they publish from.
       *
       * Without these the queue was a list of bare links, and the one person
       * who could notice that a link does not belong to the person claiming it
       * had nothing to notice it with. That is the half of the attribution
       * problem the database cannot solve: on Instagram the author is not in
       * the URL at all, so a human comparing the handle to the post is the only
       * check there is.
       */
      creatorName: creators.fullName,
      registeredHandle: creatorSocialHandles.handle,
    })
    .from(submissions)
    .innerJoin(challengeEntries, eq(challengeEntries.id, submissions.entryId))
    .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .innerJoin(
      campaignCreators,
      eq(campaignCreators.id, challengeEntries.campaignCreatorId),
    )
    .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
    // Left-joined on purpose: a handle row could be missing, and a queue that
    // silently drops a submission is worse than one that shows it unlabelled.
    .leftJoin(
      creatorSocialHandles,
      and(
        eq(creatorSocialHandles.creatorId, creators.id),
        eq(creatorSocialHandles.platform, submissions.platform),
      ),
    )
    .where(
      and(eq(submissions.status, "pending"), eq(campaigns.slug, MONICA_SLUG)),
    )
    .orderBy(submissions.submittedAt)
    .limit(Math.min(Math.max(limit, 1), 200));
}
