import "server-only";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import {
  adminUsers,
  campaignCreators,
  campaigns,
  challengeEntries,
  challenges,
  creatorSocialHandles,
  creators,
  getDb,
  submissions,
} from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import { likeContaining } from "@/lib/db/like";
import { logError } from "@/lib/log";
import { PG, isPgError } from "@/lib/db/errors";
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

/**
 * Everything needed to tell the creator what happened.
 *
 * Gathered by the query that already authorises the review, rather than by a
 * second lookup afterwards. The row is joined out to the creator regardless, and
 * reading it twice invites the two reads to disagree.
 */
export interface ReviewedEntry {
  /** The enrolment, so the caller can find a referral this approval paid. */
  enrolmentId: string;
  email: string;
  fullName: string;
  weekNo: number;
  platform: string;
  /** True while the week is open, so a rejection can be fixed and resent. */
  weekStillOpen: boolean;
  /** Movement caused by this decision. Zero on a rejection. */
  pointsAwarded: number;
  pointsTotal: number;
}

export type ReviewOutcome =
  | { ok: true; entryId: string; creator: ReviewedEntry }
  | {
      ok: false;
      reason:
        | "not_found"
        | "wrong_campaign"
        | "failed"
        | "superseded"
        | "disqualified"
        | "already_credited";
    };

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
      platform: submissions.platform,
      weekNo: challenges.weekNo,
      weekEndsAt: challenges.endsAt,
      enrolmentId: campaignCreators.id,
      // The address as typed, not the canonical form. Canonicalisation
      // strips dots and plus tags for matching, and sending to the stripped
      // version delivers somewhere the creator may not read.
      email: creators.email,
      fullName: creators.fullName,
      pointsBefore: campaignCreators.pointsTotal,
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
    /*
     * Read the total back rather than working out what the approval was worth.
     *
     * recompute_entry_award reconciles the whole entry, so an approval on a
     * second platform is worth the difference between two rungs of the ladder
     * rather than a fixed figure, and a re-approval is worth nothing at all.
     * Subtracting the total taken a moment ago is the only version that is
     * right in all three cases, and it matches what the creator sees on their
     * own page.
     */
    const after = await db
      .select({ pointsTotal: campaignCreators.pointsTotal })
      .from(campaignCreators)
      .where(eq(campaignCreators.id, row.enrolmentId))
      .limit(1);

    const pointsTotal = after[0]?.pointsTotal ?? row.pointsBefore ?? 0;

    return {
      ok: true,
      entryId: row.entryId,
      creator: {
        enrolmentId: row.enrolmentId,
        email: row.email,
        fullName: row.fullName,
        weekNo: row.weekNo,
        platform: row.platform,
        weekStillOpen: row.weekEndsAt ? row.weekEndsAt > new Date() : false,
        pointsAwarded: pointsTotal - (row.pointsBefore ?? 0),
        pointsTotal,
      },
    };
  } catch (error) {
    /*
     * The creator replaced this submission while it sat in the queue.
     *
     * A rejected submission frees its platform so the creator can send
     * another, which the rejection note tells them to do. Bringing the old
     * one back then collides with the new one. This is the reviewer
     * correcting their own mistake, and it has to say so.
     */
    if (isPgError(error, "P0210", "superseded_by_newer_submission")) {
      return { ok: false, reason: "superseded" };
    }

    /*
     * The creator was voided while this sat in the queue.
     *
     * Rejection is still allowed, and the reviewer needs to know that rather
     * than seeing the approval fail with nothing to do next.
     */
    if (isPgError(error, PG.ENROLMENT_NOT_ACTIVE, "enrolment_not_active")) {
      return { ok: false, reason: "disqualified" };
    }

    /*
     * Two creators claimed one post and the other one was approved first.
     *
     * 0025 lets both claims exist, because refusing the second claim is what
     * let anybody burn a rival's post by filing it first. Only one can ever be
     * paid, and this is the reviewer meeting that rule.
     */
    if (isPgError(error, PG.POST_ALREADY_CREDITED, "post_already_credited")) {
      return { ok: false, reason: "already_credited" };
    }

    logError("admin/review", error);
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
      /*
       * Whether another live submission claims this same post.
       *
       * 0025 made claims non-exclusive so a pending claim cannot burn a
       * rival's post, and moved exclusivity to approval. That put the tie
       * break on the reviewer, and the queue gave them no sign a tie existed:
       * worked oldest first, the thief who filed first was reviewed first,
       * and the refusal only fired on the SECOND approval. This is the sign.
       */
      contested: sql<boolean>`EXISTS (
        SELECT 1 FROM submissions other
         WHERE other.post_identity = submissions.post_identity
           AND other.id <> submissions.id
           AND other.status <> 'rejected'
      )`.as("contested"),
      /*
       * Whether that other claim has already been paid.
       *
       * Then approving this one is refused (post_already_credited) rather
       * than deciding the tie, and the question before Approve has to say so
       * instead of promising to credit this creator.
       */
      creditedElsewhere: sql<boolean>`EXISTS (
        SELECT 1 FROM submissions other
         WHERE other.post_identity = submissions.post_identity
           AND other.id <> submissions.id
           AND other.status = 'approved'
      )`.as("credited_elsewhere"),
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

/**
 * How many submissions are waiting, all of them.
 *
 * The queue header printed `queue.length`, which is the page size, so once 51
 * submissions were waiting the page said "50 waiting" and kept saying it. This
 * exists so the number is the real one.
 *
 * It used to fetch every pending link so the page could sort the queue into
 * lanes by the handle each link carried. The lanes are gone, because that
 * handle is typed by whoever submits and proves nothing about who published
 * the post, and a count is all that is left to ask for.
 */
export async function pendingCount(admin: AdminIdentity): Promise<number> {
  void admin; // Admin-only; the type is the proof.
  const db = getDb();

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissions)
    .innerJoin(challengeEntries, eq(challengeEntries.id, submissions.entryId))
    .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .where(
      and(eq(submissions.status, "pending"), eq(campaigns.slug, MONICA_SLUG)),
    );
  return row?.n ?? 0;
}

export type DecidedStatus = "all" | "approved" | "rejected";

export interface DecidedQuery {
  status?: DecidedStatus;
  /** One stage's week, or every week when absent. */
  weekNo?: number;
  /** A creator's name, a registered handle, or any part of the link. */
  search?: string;
  limit?: number;
}

/**
 * What has already been decided, with the link that was decided on.
 *
 * Approving is irreversible in the sense that matters: review() has no pending
 * guard, so the opposite decision can be sent, but there is no way back to
 * waiting and the creator has already been emailed. This list is the only
 * durable record of a mis-tap, and it costs a query because the schema already
 * carries who decided, when, and what they wrote.
 *
 * It is also where an approved post is found again later, to check it is still
 * up or still says what it said. That is why it filters in SQL before the
 * limit: the newest fifty alone meant an approval from week one fell off the
 * page by week two, which is exactly when somebody asks about it.
 */
export async function decidedSubmissions(
  admin: AdminIdentity,
  query: DecidedQuery = {},
) {
  void admin;
  const db = getDb();
  // Handles are stored without the @ people type in front of them, so a
  // search for "@adawrites" would otherwise find nothing.
  const search = query.search?.trim().replace(/^@+/, "");
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

  const filters = [
    query.status && query.status !== "all"
      ? eq(submissions.status, query.status)
      : ne(submissions.status, "pending"),
    eq(campaigns.slug, MONICA_SLUG),
  ];
  if (query.weekNo) filters.push(eq(challenges.weekNo, query.weekNo));
  if (search) {
    const like = likeContaining(search);
    const match = or(
      ilike(creators.fullName, like),
      ilike(submissions.url, like),
      sql`EXISTS (
        SELECT 1 FROM ${creatorSocialHandles} h
         WHERE h.creator_id = ${creators.id}
           AND h.handle ILIKE ${like}
      )`,
    );
    if (match) filters.push(match);
  }

  return db
    .select({
      id: submissions.id,
      platform: submissions.platform,
      url: submissions.url,
      status: submissions.status,
      reviewedAt: submissions.reviewedAt,
      reviewNote: submissions.reviewNote,
      weekNo: challenges.weekNo,
      challengeTitle: challenges.title,
      creatorName: creators.fullName,
      reviewerEmail: adminUsers.email,
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
    // Left-joined: admin rows are never deleted, but reviewedByAdminId is
    // ON DELETE SET NULL, so the column is nullable and an inner join would
    // silently drop a decision rather than show it unattributed.
    .leftJoin(adminUsers, eq(adminUsers.id, submissions.reviewedByAdminId))
    .where(and(...filters))
    .orderBy(desc(submissions.reviewedAt))
    .limit(limit);
}

/**
 * How many decisions exist, counted in the database with no limit.
 *
 * The header used to print the length of the page, which is capped, and a page
 * size read as a population is the mistake the People screen already made and
 * fixed once. These are the real totals, so a filtered page can say how much
 * of the whole it is showing.
 */
export async function decidedCounts(
  admin: AdminIdentity,
): Promise<{ approved: number; rejected: number }> {
  void admin;
  const db = getDb();

  const result = await db
    .select({
      approved: sql<number>`count(*) FILTER (WHERE ${submissions.status} = 'approved')::int`,
      rejected: sql<number>`count(*) FILTER (WHERE ${submissions.status} = 'rejected')::int`,
    })
    .from(submissions)
    .innerJoin(challengeEntries, eq(challengeEntries.id, submissions.entryId))
    .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .where(eq(campaigns.slug, MONICA_SLUG));

  return {
    approved: Number(result[0]?.approved ?? 0),
    rejected: Number(result[0]?.rejected ?? 0),
  };
}
