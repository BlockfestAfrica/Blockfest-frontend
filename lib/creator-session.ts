import "server-only";
import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  campaignCreators,
  campaigns,
  challengeEntries,
  challenges,
  creatorSocialHandles,
  creators,
  getDb,
  pointLedger,
  submissions,
} from "@/lib/db/client";
import { CAMPAIGN_GATE_FORCED_OPEN, MONICA_SLUG } from "@/lib/campaigns";
import {
  CREATOR_PENDING_MAX_AGE,
  CREATOR_PENDING_PATH,
  CREATOR_RECOVERY_PENDING_MAX_AGE,
  CREATOR_RECOVERY_PENDING_PATH,
  CREATOR_SESSION_COOKIE,
  CREATOR_SESSION_MAX_AGE,
  hashAccessToken,
  looksLikeAccessToken,
} from "@/lib/creator-access";
import { logWarning } from "@/lib/log";

/**
 * Cookie options, in one place.
 *
 * The route handler sets the pending cookie and the server action sets the
 * session cookie, so without this the two halves of one flow would each carry
 * their own copy of secure, sameSite and path, and drift the first time one of
 * them was edited.
 */
const cookieBase = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
});

export const sessionCookieOptions = () => ({
  ...cookieBase(),
  path: "/",
  maxAge: CREATOR_SESSION_MAX_AGE,
});

export const pendingCookieOptions = () => ({
  ...cookieBase(),
  path: CREATOR_PENDING_PATH,
  maxAge: CREATOR_PENDING_MAX_AGE,
});

export const recoveryPendingCookieOptions = () => ({
  ...cookieBase(),
  path: CREATOR_RECOVERY_PENDING_PATH,
  maxAge: CREATOR_RECOVERY_PENDING_MAX_AGE,
});

/** Who a token belongs to, for naming an account before anybody enters it. */
export interface TokenHolder {
  enrolmentId: string;
  name: string;
}

/**
 * Resolve a token to the creator who holds it, or to nothing.
 *
 * The route used to refuse to do this, on the grounds that answering "is this
 * token real" turns the endpoint into an oracle. That reasoning does not
 * survive the arithmetic: a token is 32 bytes from randomBytes, so there is no
 * search to speed up and nothing for an oracle to accelerate. Meanwhile the
 * cost of not asking was that any 43 well formed characters set a ninety day
 * session cookie, which is the actual hole.
 */
export async function creatorByToken(token: string): Promise<TokenHolder | null> {
  if (!looksLikeAccessToken(token)) return null;

  const rows = await getDb()
    .select({ enrolmentId: campaignCreators.id, name: creators.fullName })
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

/**
 * The registered handles for an enrolment, for the confirm page.
 *
 * The adversarial review broke the confirm page with one observation: the page
 * vouches for an account using nothing but a self-asserted display name, and
 * registration enforces no name uniqueness, so an attacker registers under the
 * victim's exact name and the page itself tells the victim the link is theirs.
 *
 * Handles resist that. They are unique per platform, they are what a creator
 * actually recognises as theirs, and showing them to the holder of the account's
 * own link discloses nothing the link does not already grant.
 */
export async function handlesForEnrolment(
  enrolmentId: string,
): Promise<Array<{ platform: string; handle: string }>> {
  return getDb()
    .select({
      platform: creatorSocialHandles.platform,
      handle: creatorSocialHandles.handle,
    })
    .from(creatorSocialHandles)
    .innerJoin(
      campaignCreators,
      eq(campaignCreators.creatorId, creatorSocialHandles.creatorId),
    )
    .where(eq(campaignCreators.id, enrolmentId));
}

/** The creator's own view of a correction request, one per platform. */
export interface HandleRequestState {
  platform: string;
  requestedHandle: string;
  status: "pending" | "approved" | "rejected";
  /** Written by the admin, for the creator, on a rejection. */
  decisionNote: string | null;
}

/**
 * The latest request per platform, so /me can say "requested, waiting" or
 * show the rejection note instead of leaving the creator wondering whether
 * the form did anything.
 */
export async function handleRequestsForEnrolment(
  enrolmentId: string,
): Promise<HandleRequestState[]> {
  const result = await getDb().execute(sql`
    SELECT DISTINCT ON (platform)
           platform, requested_handle, status, decision_note
      FROM handle_change_requests
     WHERE campaign_creator_id = ${enrolmentId}
     ORDER BY platform, created_at DESC
  `);
  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      platform: String(r.platform),
      requestedHandle: String(r.requested_handle),
      status: r.status as HandleRequestState["status"],
      decisionNote: r.decision_note ? String(r.decision_note) : null,
    };
  });
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
/**
 * The accounts a creator registered, and whether anybody has confirmed them.
 *
 * Verification fields are gone from this shape on purpose. The campaign team
 * removed the confirm-your-accounts step in 0034, so verified and code would
 * be data the page must not show, and the safest field is one that does not
 * reach the client at all.
 */
export interface RegisteredHandle {
  platform: string;
  handle: string;
}

export async function registeredHandles(
  enrolmentId: string,
): Promise<RegisteredHandle[]> {
  const db = getDb();
  const rows = await db
    .select({
      platform: creatorSocialHandles.platform,
      handle: creatorSocialHandles.handle,
    })
    .from(creatorSocialHandles)
    .innerJoin(creators, eq(creators.id, creatorSocialHandles.creatorId))
    .innerJoin(campaignCreators, eq(campaignCreators.creatorId, creators.id))
    .where(eq(campaignCreators.id, enrolmentId))
    .orderBy(creatorSocialHandles.platform);

  return rows.map((row) => ({
    platform: String(row.platform),
    handle: row.handle,
  }));
}

export async function registeredPlatforms(
  enrolmentId: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ platform: creatorSocialHandles.platform })
    .from(creatorSocialHandles)
    .innerJoin(creators, eq(creators.id, creatorSocialHandles.creatorId))
    .innerJoin(campaignCreators, eq(campaignCreators.creatorId, creators.id))
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
 * Every movement of a creator's points, for their own page.
 *
 * The rules make two promises that nothing rendered: that every bonus is
 * "recorded against your account with the reason, and you can see it on your
 * own page", and that a correction is recorded the same way. The ledger has
 * carried both since manual awards shipped, and no creator-facing query read
 * it, so a creator whose total moved saw it move and never why.
 *
 * The whole ledger, not just the bonuses. A creator checking an unexpected
 * total wants the arithmetic to add up, and a list that omits the entries it is
 * mostly made of does not.
 *
 * The admin who awarded it is deliberately not returned. The note carries the
 * reason, which is what a creator needs; a name invites an argument with a
 * person instead of a reply to partnership@, and the audit log already records
 * who for the cases where that matters.
 */
export interface PointMovement {
  id: string;
  source: string;
  points: number;
  note: string | null;
  /** The week, when the movement came from an entry rather than a bonus. */
  weekNo: number | null;
  at: Date;
}

export async function pointHistory(
  enrolmentId: string,
): Promise<PointMovement[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: pointLedger.id,
      source: pointLedger.source,
      points: pointLedger.points,
      note: pointLedger.note,
      weekNo: challenges.weekNo,
      at: pointLedger.createdAt,
    })
    .from(pointLedger)
    // Left-joined all the way: a bonus has no entry, and a row that vanished
    // because it was not tied to a challenge would make the arithmetic on the
    // page stop adding up, which is the one thing this list has to do.
    .leftJoin(challengeEntries, eq(challengeEntries.id, pointLedger.entryId))
    .leftJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
    .where(eq(pointLedger.campaignCreatorId, enrolmentId))
    .orderBy(desc(pointLedger.createdAt))
    .limit(200);

  return rows.map((row) => ({
    id: row.id,
    source: String(row.source),
    points: Number(row.points ?? 0),
    note: row.note,
    weekNo: row.weekNo ?? null,
    at: row.at,
  }));
}

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
  /** 'active' normally. A disqualified creator's page must say so rather
      than keep offering the form: they used to find out by filming a
      week's work and meeting a refusal. */
  status: string;
  challenge: OpenChallenge | null;
  platforms: string[];
  submissions: CreatorSubmission[];
  history: PointMovement[];
  handles: RegisteredHandle[];
  /** Which parts could not be read. Rendered as an honest gap, not as zero. */
  failed: {
    challenge: boolean;
    platforms: boolean;
    submissions: boolean;
    history: boolean;
    handles: boolean;
  };
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
      logWarning(
        "creator-page",
        `${what} unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { value: fallback, failed: true };
    }
  };

  const [status, challenge, platforms, submissions, history, handles] =
    await Promise.all([
      soft(
        async () => {
          const rows = await getDb()
            .select({ status: campaignCreators.status })
            .from(campaignCreators)
            .where(eq(campaignCreators.id, enrolmentId))
            .limit(1);
          return String(rows[0]?.status ?? "active");
        },
        "active",
        "standing",
      ),
      soft(() => openChallenge(), null as OpenChallenge | null, "this week"),
      soft(() => registeredPlatforms(enrolmentId), [] as string[], "platforms"),
      soft(
        () => creatorSubmissions(enrolmentId),
        [] as CreatorSubmission[],
        "entries",
      ),
      soft(() => pointHistory(enrolmentId), [] as PointMovement[], "points"),
      soft(
        () => registeredHandles(enrolmentId),
        [] as RegisteredHandle[],
        "accounts",
      ),
    ]);

  return {
    /* Defaults to active on a read failure, deliberately: a blip must not
       tell somebody in good standing that they have been removed. */
    status: status.value,
    challenge: challenge.value,
    platforms: platforms.value,
    submissions: submissions.value,
    history: history.value,
    handles: handles.value,
    failed: {
      challenge: challenge.failed,
      platforms: platforms.failed,
      submissions: submissions.failed,
      history: history.failed,
      handles: handles.failed,
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
