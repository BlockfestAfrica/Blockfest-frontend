import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  campaignCreators,
  campaigns,
  challengeEntries,
  creators,
  creatorSocialHandles,
  getDb,
  submissions,
} from "@/lib/db/client";
import { likeContaining } from "@/lib/db/like";
import type { AdminIdentity } from "@/lib/admin/session";

/**
 * Everyone enrolled in a campaign, whether or not they have ever submitted.
 *
 * The review queue only shows work that has arrived, so a creator who
 * registered and then went quiet was invisible: there was no way to ask how
 * many people had joined, who had gone silent, or who to chase before a brief
 * closed.
 *
 * This carries contact details, which the queue deliberately does not. The
 * queue is read while deciding somebody's points and needs nothing but the post
 * and the handle; this is read while deciding whether to email somebody. So it
 * takes an AdminIdentity, for the same reason reviewSubmission does: an
 * unguarded caller does not compile.
 *
 * It must never become the public leaderboard's data source. That one has its
 * own hand-written whitelist in lib/leaderboard.ts, and the two are separate on
 * purpose.
 */

export type ParticipantFilter = "all" | "submitted" | "silent" | "approved";

/**
 * One manual ledger row: a bonus given, or a bonus taken back.
 *
 * Only the sources a person writes. challenge_entry and referral belong to the
 * engine and are not what somebody means by "did I already give them extra".
 */
export interface ManualAward {
  source: string;
  points: number;
  note: string | null;
  at: Date;
  /** The admin who gave it. Null if that admin row has since gone. */
  by: string | null;
  /** Set for engagement bonuses, which attach to one entry. */
  entryId: string | null;
  weekNo: number | null;
}

export interface Participant {
  enrolmentId: string;
  /** Approved entries, for the engagement bonus picker. */
  entries: { id: string; weekNo: number }[];
  /** Every manual award and take-back, newest first. */
  awards: ManualAward[];
  name: string;
  email: string;
  joinedAt: Date;
  handles: string[];
  submitted: number;
  approved: number;
  points: number;
  active: boolean;
}

export interface ParticipantQuery {
  /** Campaign slug. More than one campaign is coming. */
  slug: string;
  filter?: ParticipantFilter;
  /** Matches a name or an email, because that is how somebody is looked up. */
  search?: string;
  limit?: number;
}

export async function participants(
  admin: AdminIdentity,
  query: ParticipantQuery,
): Promise<Participant[]> {
  void admin; // The type is the proof the guard ran.

  const db = getDb();
  const search = query.search?.trim();
  const limit = Math.min(Math.max(query.limit ?? 200, 1), 500);

  /*
   * Counted with correlated subqueries rather than joins.
   *
   * Joining submissions and handles and then grouping multiplies rows: a
   * creator with three handles and two submissions produces six, and every
   * count comes out wrong in a way that looks plausible. Subqueries keep one
   * row per creator and each number counts what it says it counts.
   */
  const submittedCount = sql<number>`(
    SELECT count(*)::int FROM ${submissions} s
      JOIN ${challengeEntries} ce ON ce.id = s.entry_id
     WHERE ce.campaign_creator_id = ${campaignCreators.id}
  )`;

  const approvedCount = sql<number>`(
    SELECT count(*)::int FROM ${submissions} s
      JOIN ${challengeEntries} ce ON ce.id = s.entry_id
     WHERE ce.campaign_creator_id = ${campaignCreators.id}
       AND s.status = 'approved'
  )`;

  /*
   * Approved entries, id and week, for the award panel's engagement
   * picker: since 0050 an engagement bonus attaches to the entry that
   * earned the views, so the person awarding needs the list to pick from.
   */
  const entryList = sql<{ id: string; weekNo: number }[]>`(
    SELECT COALESCE(json_agg(json_build_object('id', ce.id, 'weekNo', ch.week_no)
                    ORDER BY ch.week_no), '[]'::json)
      FROM ${challengeEntries} ce
      JOIN challenges ch ON ch.id = ce.challenge_id
     WHERE ce.campaign_creator_id = ${campaignCreators.id}
       AND ce.approved_platform_count >= 1
  )`;

  /*
   * Every bonus a person has given this creator, and every take-back.
   *
   * The award form showed nothing about what had already been given, so the
   * only way to know whether somebody already had their quality bonus was to
   * remember. Their points total moved, but a total does not say what it is
   * made of, and giving the same bonus twice for the same work looks exactly
   * like giving two bonuses for two pieces of work.
   *
   * Loaded with the row, as entries are, rather than fetched when the panel
   * opens: it is a handful of rows per creator, and a second endpoint would be
   * one more admin route to guard for a list the page can already carry.
   */
  const awardList = sql<
    {
      source: string;
      points: number;
      note: string | null;
      at: string;
      by: string | null;
      entryId: string | null;
      weekNo: number | null;
    }[]
  >`(
    SELECT COALESCE(json_agg(json_build_object(
             'source', pl.source::text,
             'points', pl.points,
             'note', pl.note,
             'at', pl.created_at,
             'by', a.email,
             'entryId', pl.entry_id,
             'weekNo', ch.week_no
           ) ORDER BY pl.created_at DESC, pl.id DESC), '[]'::json)
      FROM point_ledger pl
      LEFT JOIN admin_users a        ON a.id = pl.awarded_by_admin_id
      LEFT JOIN challenge_entries ce ON ce.id = pl.entry_id
      LEFT JOIN challenges ch        ON ch.id = ce.challenge_id
     WHERE pl.campaign_creator_id = ${campaignCreators.id}
       AND pl.source NOT IN ('challenge_entry', 'referral')
  )`;

  const handleList = sql<string[]>`(
    SELECT COALESCE(array_agg(h.platform || ':' || h.handle ORDER BY h.platform), '{}')
      FROM ${creatorSocialHandles} h
     WHERE h.creator_id = ${creators.id}
  )`;

  const filters = [eq(campaigns.slug, query.slug)];

  if (search) {
    const like = likeContaining(search);
    /*
     * Handles are matched here, not in the browser.
     *
     * The screen used to carry two search boxes: this one, which matched name
     * and email across the whole campaign, and a second one in the table that
     * matched name, email and handle but only across the rows already loaded.
     * Two boxes that look the same and answer differently is worse than either
     * alone, and on a phone it was two of the four stacked rows before any data.
     *
     * Moving the handle match into SQL means one box, and it now finds somebody
     * by handle even when they are outside the page window, which the browser
     * version never could.
     */
    const match = or(
      ilike(creators.fullName, like),
      ilike(creators.email, like),
      sql`EXISTS (
        SELECT 1 FROM ${creatorSocialHandles} h
         WHERE h.creator_id = ${creators.id}
           AND h.handle ILIKE ${like}
      )`,
    );
    if (match) filters.push(match);
  }

  const rows = await db
    .select({
      enrolmentId: campaignCreators.id,
      name: creators.fullName,
      email: creators.email,
      joinedAt: campaignCreators.joinedAt,
      handles: handleList,
      entries: entryList,
      awards: awardList,
      submitted: submittedCount,
      approved: approvedCount,
      points: campaignCreators.pointsTotal,
      status: campaignCreators.status,
    })
    .from(campaignCreators)
    .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
    .innerJoin(campaigns, eq(campaigns.id, campaignCreators.campaignId))
    .where(and(...filters))
    .orderBy(desc(campaignCreators.joinedAt))
    .limit(limit);

  const mapped: Participant[] = rows.map((row) => ({
    enrolmentId: row.enrolmentId,
    name: row.name,
    email: row.email,
    joinedAt: row.joinedAt,
    handles: Array.isArray(row.handles) ? row.handles : [],
    entries: Array.isArray(row.entries) ? row.entries : [],
    awards: Array.isArray(row.awards)
      ? row.awards.map((a) => ({
          source: String(a.source),
          points: Number(a.points ?? 0),
          note: a.note ?? null,
          at: new Date(a.at),
          by: a.by ?? null,
          entryId: a.entryId ?? null,
          weekNo:
            a.weekNo === null || a.weekNo === undefined
              ? null
              : Number(a.weekNo),
        }))
      : [],
    submitted: Number(row.submitted ?? 0),
    approved: Number(row.approved ?? 0),
    points: Number(row.points ?? 0),
    active: row.status === "active",
  }));

  // Filtered here rather than in SQL, because the counts are already computed
  // and the set is a few hundred rows at most. Pushing it down would mean
  // repeating the subqueries in a HAVING clause for no measurable gain.
  switch (query.filter) {
    case "submitted":
      return mapped.filter((p) => p.submitted > 0);
    case "silent":
      // The group worth acting on: joined, never sent anything.
      return mapped.filter((p) => p.submitted === 0);
    case "approved":
      return mapped.filter((p) => p.approved > 0);
    default:
      return mapped;
  }
}

/** Headline counts, so the page can say what it is showing. */
export function participantTotals(all: Participant[]) {
  return {
    total: all.length,
    submitted: all.filter((p) => p.submitted > 0).length,
    silent: all.filter((p) => p.submitted === 0).length,
    approved: all.filter((p) => p.approved > 0).length,
  };
}

/**
 * Population counts, from one row of SQL with no limit.
 *
 * participantTotals counts the array it is handed, and that array is capped at
 * 500 by the query above. The header therefore printed a page size as though it
 * were a population, and the copy underneath turned it into an outreach
 * decision: "N have not submitted anything yet. That is the group worth a
 * message." With 500 returned and 700 enrolled, that sentence is wrong about
 * which people exist.
 *
 * These are counted in the database over the whole campaign, so they are the
 * real numbers. The filter chips in the table still narrow what is shown, and
 * the page says so rather than implying the chips are population counts.
 */
export async function participantCounts(
  admin: AdminIdentity,
  slug: string,
): Promise<{
  joined: number;
  submitted: number;
  silent: number;
  points: number;
}> {
  void admin;
  const db = getDb();

  const submittedCount = sql<number>`(
    SELECT count(*)::int FROM ${submissions} s
      JOIN ${challengeEntries} ce ON ce.id = s.entry_id
     WHERE ce.campaign_creator_id = ${campaignCreators.id}
  )`;

  const result = await db
    .select({
      joined: sql<number>`count(*)::int`,
      submitted: sql<number>`count(*) FILTER (WHERE ${submittedCount} > 0)::int`,
      points: sql<number>`COALESCE(sum(${campaignCreators.pointsTotal}), 0)::int`,
    })
    .from(campaignCreators)
    .innerJoin(campaigns, eq(campaigns.id, campaignCreators.campaignId))
    .where(eq(campaigns.slug, slug));

  const row = result[0];
  const joined = Number(row?.joined ?? 0);
  const submitted = Number(row?.submitted ?? 0);

  return {
    joined,
    submitted,
    silent: joined - submitted,
    points: Number(row?.points ?? 0),
  };
}
