import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import type { AdminIdentity } from "@/lib/admin/session";

/**
 * Choosing and announcing weekly winners.
 *
 * Takes an AdminIdentity, which nothing outside requireAdmin can construct, so
 * calling any of this from an unguarded route is a type error rather than an
 * incident. Same discipline as reviewSubmission, and for the same reason: these
 * calls move prize money.
 */

export type WinnerCategory = "creator_of_week" | "community_favourite";

export interface Candidate {
  enrolmentId: string;
  name: string;
  points: number;
  approvedEntries: number;
  rank: number;
}

export interface WinnerRow {
  weekNo: number;
  category: WinnerCategory;
  enrolmentId: string;
  name: string;
  prizeNaira: number;
  note: string | null;
  publishedAt: Date | null;
}

/**
 * Who may still be offered for a category.
 *
 * The list is already filtered in SQL: a past Creator of the Week is not
 * returned for that category. The index refuses a repeat, this stops one being
 * offered, and the screen says why a name is missing. Three enforcements
 * because the brief asks for three, and because a note in a runbook for a tired
 * admin on a Sunday night is not one of them.
 */
export async function winnerCandidates(
  admin: AdminIdentity,
  category: WinnerCategory,
): Promise<Candidate[]> {
  void admin;
  const result = await getDb().execute(
    sql`SELECT * FROM weekly_winner_candidates(${MONICA_SLUG}, ${category}::winner_category)`,
  );

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      enrolmentId: String(r.campaign_creator_id),
      name: String(r.display_name ?? "").trim(),
      points: Number(r.points_total ?? 0),
      approvedEntries: Number(r.approved_entries ?? 0),
      rank: Number(r.rank ?? 0),
    };
  });
}

/** Every pick so far, drafts included, since this is the admin's own view. */
export async function winnersSoFar(admin: AdminIdentity): Promise<WinnerRow[]> {
  void admin;
  const result = await getDb().execute(sql`
    SELECT w.week_no, w.category::text AS category, w.campaign_creator_id,
           c.full_name, w.prize_amount_naira, w.note, w.published_at
      FROM weekly_winners w
      JOIN campaigns cm         ON cm.id = w.campaign_id
      JOIN campaign_creators cc ON cc.id = w.campaign_creator_id
      JOIN creators c           ON c.id = cc.creator_id
     WHERE cm.slug = ${MONICA_SLUG}
     ORDER BY w.week_no, w.category
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      weekNo: Number(r.week_no ?? 0),
      category:
        r.category === "community_favourite"
          ? ("community_favourite" as const)
          : ("creator_of_week" as const),
      enrolmentId: String(r.campaign_creator_id),
      name: String(r.full_name ?? "").trim(),
      prizeNaira: Number(r.prize_amount_naira ?? 0),
      note: r.note ? String(r.note) : null,
      publishedAt: r.published_at ? new Date(String(r.published_at)) : null,
    };
  });
}

/** What has been frozen, so the screen can say whether this week is recorded. */
export async function snapshotsTaken(
  admin: AdminIdentity,
): Promise<{ weekNo: number; version: number; rows: number; takenAt: Date }[]> {
  void admin;
  const result = await getDb().execute(sql`
    SELECT s.week_no, s.version, count(*)::int AS rows, max(s.taken_at) AS taken_at
      FROM leaderboard_snapshots s
      JOIN campaigns cm ON cm.id = s.campaign_id
     WHERE cm.slug = ${MONICA_SLUG}
     GROUP BY s.week_no, s.version
     ORDER BY s.week_no DESC, s.version DESC
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      weekNo: Number(r.week_no ?? 0),
      version: Number(r.version ?? 0),
      rows: Number(r.rows ?? 0),
      takenAt: new Date(String(r.taken_at)),
    };
  });
}

/**
 * One snapshot's frozen standings, for the admin viewer.
 *
 * Reads the denormalised rows as they were written: display_name survives a
 * creator later being removed, which is the whole reason the freeze copies
 * it instead of joining live tables.
 */
/**
 * The frozen points the engine will break a vote tie on, by enrolment.
 *
 * The console used to judge a tied Community Favourite on LIVE standings
 * while publish_weekly_winner judged on the recorded ones, so a Sunday
 * approval could make the page name one winner and the engine refuse
 * exactly that person, with no picker on screen to choose anybody else.
 * Reads the version the round pinned at close (0059), falling back to the
 * newest, which is what the engine's own COALESCE does.
 */
export async function tiebreakPoints(
  admin: AdminIdentity,
  weekNo: number,
): Promise<Record<string, number>> {
  void admin;
  const result = await getDb().execute(sql`
    SELECT s.campaign_creator_id, s.points_total
      FROM leaderboard_snapshots s
      JOIN campaigns cm ON cm.id = s.campaign_id
     WHERE cm.slug = ${MONICA_SLUG}
       AND s.week_no = ${weekNo}
       AND s.version = COALESCE(
             (SELECT r.tiebreak_snapshot_version FROM vote_rounds r
               WHERE r.campaign_id = s.campaign_id AND r.week_no = ${weekNo}),
             (SELECT max(version) FROM leaderboard_snapshots s2
               WHERE s2.campaign_id = s.campaign_id AND s2.week_no = ${weekNo})
           )
  `);

  const points: Record<string, number> = {};
  for (const row of result.rows ?? []) {
    const r = row as Record<string, unknown>;
    if (r.campaign_creator_id) {
      points[String(r.campaign_creator_id)] = Number(r.points_total ?? 0);
    }
  }
  return points;
}

export async function snapshotRows(
  admin: AdminIdentity,
  weekNo: number,
  version: number,
): Promise<
  { rank: number; name: string; points: number; approved: number; takenAt: Date }[]
> {
  void admin;
  const result = await getDb().execute(sql`
    SELECT s.rank, s.display_name, s.points_total, s.approved_entries, s.taken_at
      FROM leaderboard_snapshots s
      JOIN campaigns cm ON cm.id = s.campaign_id
     WHERE cm.slug = ${MONICA_SLUG}
       AND s.week_no = ${weekNo}
       AND s.version = ${version}
     ORDER BY s.rank ASC
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      rank: Number(r.rank ?? 0),
      name: String(r.display_name ?? ""),
      points: Number(r.points_total ?? 0),
      approved: Number(r.approved_entries ?? 0),
      takenAt: new Date(String(r.taken_at)),
    };
  });
}

export interface VoteNominee {
  enrolmentId: string;
  name: string;
  votes: number;
}

export type VoteVerdict =
  | { state: "pending"; winner: null; votes: number; nomineeEnrolmentIds: string[] }
  | { state: "zero"; winner: null; votes: number; nomineeEnrolmentIds: string[] }
  | { state: "tied"; winner: null; votes: number; nomineeEnrolmentIds: string[] }
  | {
      state: "decided";
      winner: { enrolmentId: string; name: string; votes: number };
      votes: number;
      nomineeEnrolmentIds: string[];
    };

/**
 * What the announce card may claim about a finished vote.
 *
 * Four states, because the engine enforces four different things and a
 * screen that collapses any two of them tells the announcer something
 * false at the moment it matters most.
 *
 * The one that was wrong: an exact tie shared the "zero" state with a round
 * nobody voted in, so the console said "No countable votes came in" above a
 * card reading 31, 31, 24, and offered a picker of every nominee. Those are
 * different rules. Nobody voting falls back to Blockfest choosing from the
 * whole shortlist (P0807); a tie does not, and publish_weekly_winner
 * accepts a tied leader and refuses everyone else with P0806.
 *
 * Ties break on the FROZEN points, which is what the engine breaks them on.
 * Judging on live standings let a Sunday approval make this page name one
 * winner while the engine accepted only the other.
 */
export function voteVerdict(
  nominees: VoteNominee[],
  frozenPoints: Record<string, number>,
  settled: boolean,
): VoteVerdict {
  const nomineeEnrolmentIds = nominees.map((n) => n.enrolmentId);
  if (!settled) {
    return { state: "pending", winner: null, votes: 0, nomineeEnrolmentIds };
  }

  const top = Math.max(0, ...nominees.map((n) => n.votes));
  if (top === 0) {
    return { state: "zero", winner: null, votes: 0, nomineeEnrolmentIds };
  }

  const pointsOf = (id: string) => frozenPoints[id] ?? 0;
  const tied = nominees.filter((n) => n.votes === top);
  const leader = tied.reduce((a, b) =>
    pointsOf(b.enrolmentId) > pointsOf(a.enrolmentId) ? b : a,
  );
  const tiedTop = tied.filter(
    (n) => pointsOf(n.enrolmentId) === pointsOf(leader.enrolmentId),
  );

  if (tiedTop.length > 1) {
    return {
      state: "tied",
      winner: null,
      votes: top,
      nomineeEnrolmentIds: tiedTop.map((n) => n.enrolmentId),
    };
  }

  return {
    state: "decided",
    winner: {
      enrolmentId: leader.enrolmentId,
      name: leader.name,
      votes: leader.votes,
    },
    votes: top,
    nomineeEnrolmentIds,
  };
}
