import "server-only";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { cookies } from "next/headers";
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
import { CAMPAIGN_GATE_FORCED_OPEN, MONICA_SLUG } from "@/lib/campaigns";
import {
  CREATOR_SESSION_COOKIE,
  hashAccessToken,
  looksLikeAccessToken,
} from "@/lib/creator-access";

/**
 * Who is reading their own page.
 *
 * The token arrives only as an httpOnly cookie, so it is never in a URL a
 * creator could paste into a group chat by accident, and never readable by
 * script on the page.
 *
 * The lookup is by hash, in one indexed query. There is no read-then-compare
 * step, so there is nothing here that leaks whether a prefix was right.
 */
export interface CreatorSession {
  enrolmentId: string;
  name: string;
  referralCode: string;
  pointsTotal: number;
  approvedEntries: number;
  joinedAt: Date;
}

export async function currentCreator(): Promise<CreatorSession | null> {
  const jar = await cookies();
  const token = jar.get(CREATOR_SESSION_COOKIE)?.value?.trim();

  // Shape checked before the database is touched. A malformed cookie is a
  // malformed cookie, not a query.
  if (!looksLikeAccessToken(token)) return null;

  const db = getDb();

  const rows = await db
    .select({
      enrolmentId: campaignCreators.id,
      name: creators.fullName,
      referralCode: campaignCreators.referralCode,
      pointsTotal: campaignCreators.pointsTotal,
      approvedEntries: campaignCreators.approvedEntriesCount,
      joinedAt: campaignCreators.joinedAt,
    })
    .from(campaignCreators)
    .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
    .innerJoin(campaigns, eq(campaigns.id, campaignCreators.campaignId))
    .where(
      and(
        eq(campaignCreators.accessTokenHash, hashAccessToken(token)),
        eq(campaigns.slug, MONICA_SLUG),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/** The challenge a creator can submit to right now, if any. */
export interface OpenChallenge {
  id: string;
  title: string;
  description: string;
  weekNo: number;
  endsAt: Date;
}

export async function openChallenge(): Promise<OpenChallenge | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: challenges.id,
      title: challenges.title,
      description: challenges.description,
      weekNo: challenges.weekNo,
      endsAt: challenges.endsAt,
    })
    .from(challenges)
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .where(
      and(
        eq(campaigns.slug, MONICA_SLUG),
        eq(challenges.status, "active"),
        lte(challenges.startsAt, new Date()),
        gt(challenges.endsAt, new Date()),
      ),
    )
    .limit(1);

  if (rows[0]) return rows[0];

  // Before launch there is no open week, and the page still has to have
  // something to submit to so the flow can be walked end to end. When the
  // campaign gate is deliberately forced open, the next week is shown instead.
  //
  // The endpoint applies the same rule and refuses anything this offers that it
  // would not itself accept, so this cannot widen what is submittable. After 14
  // September a week is open continuously until 17 October, which makes this
  // branch unreachable.
  if (!CAMPAIGN_GATE_FORCED_OPEN) return null;

  const upcoming = await db
    .select({
      id: challenges.id,
      title: challenges.title,
      description: challenges.description,
      weekNo: challenges.weekNo,
      endsAt: challenges.endsAt,
    })
    .from(challenges)
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .where(
      and(
        eq(campaigns.slug, MONICA_SLUG),
        eq(challenges.status, "active"),
        gt(challenges.startsAt, new Date()),
      ),
    )
    .orderBy(asc(challenges.startsAt))
    .limit(1);

  return upcoming[0] ?? null;
}

/** The platforms this creator said they would publish from. */
export async function registeredPlatforms(
  enrolmentId: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ platform: creatorSocialHandles.platform })
    .from(creatorSocialHandles)
    .innerJoin(creators, eq(creators.id, creatorSocialHandles.creatorId))
    .innerJoin(
      campaignCreators,
      eq(campaignCreators.creatorId, creators.id),
    )
    .where(eq(campaignCreators.id, enrolmentId));

  return rows.map((r) => r.platform);
}

export interface CreatorSubmission {
  id: string;
  platform: string;
  url: string;
  status: string;
  submittedAt: Date;
  reviewNote: string | null;
  challengeTitle: string;
  weekNo: number;
}

/**
 * Everything this creator has submitted, newest first.
 *
 * Includes the review note, because a rejection a creator cannot see the reason
 * for is a rejection they will argue with rather than learn from.
 */
/**
 * Load a creator's page data without letting one failure take the page down.
 *
 * Everything on this page came from a single Promise.all, which rejects if any
 * one of its promises does, and three of the five had no error handling at all.
 * A blip on any of them returned a 500 to the creator, for the whole page,
 * including the parts that had loaded.
 *
 * That is not hypothetical. This page spent an afternoon serving 500 to every
 * signed-in creator, and if the same thing happens on launch morning it happens
 * to all of them at once, on the one screen the campaign runs through.
 *
 * Each concern fails on its own now and says so, rather than silently reading
 * as empty. An empty entry list where entries exist is worse than an error: the
 * creator concludes their work was lost and submits it again.
 */
export interface CreatorPageData {
  challenge: OpenChallenge | null;
  platforms: string[];
  submissions: CreatorSubmission[];
  /** Which parts could not be read. Rendered as an honest gap, not as zero. */
  failed: { challenge: boolean; platforms: boolean; submissions: boolean };
}

export async function creatorPageData(
  enrolmentId: string,
): Promise<CreatorPageData> {
  const soft = async <T>(
    load: () => Promise<T>,
    fallback: T,
    what: string,
  ): Promise<{ value: T; failed: boolean }> => {
    try {
      return { value: await load(), failed: false };
    } catch (error) {
      console.warn(
        `[creator-page] ${what} unavailable:`,
        error instanceof Error ? error.message : String(error),
      );
      return { value: fallback, failed: true };
    }
  };

  const [challenge, platforms, submissions] = await Promise.all([
    soft(() => openChallenge(), null as OpenChallenge | null, "this week"),
    soft(() => registeredPlatforms(enrolmentId), [] as string[], "platforms"),
    soft(
      () => creatorSubmissions(enrolmentId),
      [] as CreatorSubmission[],
      "entries",
    ),
  ]);

  return {
    challenge: challenge.value,
    platforms: platforms.value,
    submissions: submissions.value,
    failed: {
      challenge: challenge.failed,
      platforms: platforms.failed,
      submissions: submissions.failed,
    },
  };
}

/**
 * Which platforms are genuinely used up for the open week.
 *
 * A rejected entry does NOT use one up, and that is not a nicety. Migration
 * 0011 replaced the unique index with a partial one on status <> 'rejected'
 * specifically so a creator told to change something could change it and send
 * it again. The page was filtering on week alone, so a rejection removed that
 * platform from the dropdown for the rest of the week and a creator with one
 * registered account was told they had submitted everywhere and lost the week.
 * The database allowed the fix and the form refused to offer it.
 *
 * Pure and exported so the rule is tested rather than inlined in a server
 * component where nothing can reach it.
 */
export function platformsUsedThisWeek(
  submitted: Pick<CreatorSubmission, "weekNo" | "platform" | "status">[],
  weekNo: number,
): string[] {
  return submitted
    .filter((s) => s.weekNo === weekNo && s.status !== "rejected")
    .map((s) => s.platform);
}

export async function creatorSubmissions(
  enrolmentId: string,
): Promise<CreatorSubmission[]> {
  const db = getDb();
  return db
    .select({
      id: submissions.id,
      platform: submissions.platform,
      url: submissions.url,
      status: submissions.status,
      submittedAt: submissions.submittedAt,
      reviewNote: submissions.reviewNote,
      challengeTitle: challenges.title,
      weekNo: challenges.weekNo,
    })
    .from(submissions)
    .innerJoin(challengeEntries, eq(challengeEntries.id, submissions.entryId))
    .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
    .where(eq(challengeEntries.campaignCreatorId, enrolmentId))
    .orderBy(desc(submissions.submittedAt));
}
