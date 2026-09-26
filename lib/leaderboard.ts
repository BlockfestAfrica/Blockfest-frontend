import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { currentWeekNo, MONICA_SLUG, monicaStages } from "@/lib/campaigns";
import {
  NEVER_PUBLISH,
  toPublicRow,
  type LeaderboardRow,
} from "@/lib/leaderboard-row";

export { NEVER_PUBLISH, type LeaderboardRow };

/**
 * The public leaderboard.
 *
 * What a row may contain, and why each field is already public, is written
 * down once in lib/leaderboard-row.ts, next to the serialiser that enforces
 * it. This file only fetches.
 */

export interface LeaderboardView {
  rows: LeaderboardRow[];
  /**
   * The stage whose recorded standings the movement is measured from, or null
   * when there is nothing to compare with yet: during stage 1, or when that
   * stage's standings were never recorded.
   */
  movementSince: number | null;
  /** How many stages the campaign has, for "2 of 4". */
  stageCount: number;
}

/**
 * The board, with what the table shows beside each name.
 *
 * One statement. Every join that needs an enrolment id happens inside it, and
 * the outer SELECT names each column it returns, so no id leaves the database
 * even before toPublicRow drops anything.
 *
 * - previous: the rank each creator held in the last recorded standings of
 *   the stage before the current one. A stage's standings can be recorded
 *   more than once; the latest recording is the one read, as every other
 *   reader of snapshots does, and once the next stage starts the snapshot
 *   route refuses to record that week again, so the baseline stays put.
 *   Stage 1 has no stage before it, and week 0 matches nothing, so the board
 *   shows no movement until stage 2.
 * - badges: announced winners only. A winner chosen on Saturday stays a
 *   draft until the Sunday announcement, and must not show here first.
 * - approved: platforms and stages from approved posts only. A rejection
 *   takes a platform away, as it takes the points.
 */
export async function leaderboardView(
  limit = 100,
  now: Date = new Date(),
): Promise<LeaderboardView> {
  const stageCount = monicaStages.length;
  const baselineWeek = currentWeekNo(now) - 1;

  /*
   * Returns an empty board rather than throwing.
   *
   * This page is statically rendered and revalidated, so Next builds it once at
   * deploy time. The build has no database: Netlify injects the connection into
   * the function environment, not into the build, which is documented in
   * lib/db/client.ts and has caught this project out before. Throwing here
   * fails the whole deploy over a page whose only job is to show a list.
   *
   * So a board that cannot be read is an empty board, which renders as "nothing
   * to show yet" and is filled in by the first revalidation against a runtime
   * that does have a database. The alternative, a deploy that cannot ship
   * because one read-only page could not reach Postgres at build time, is worse
   * in every case.
   *
   * Logged rather than swallowed, because an empty leaderboard during a live
   * campaign should be findable in the logs and not a mystery.
   */
  try {
    const db = getDb();

    const result = await db.execute(sql`
      WITH board AS (
        SELECT * FROM campaign_leaderboard(${MONICA_SLUG}, ${limit})
      ),
      previous AS (
        SELECT s.campaign_creator_id, s.rank AS previous_rank
          FROM leaderboard_snapshots s
          JOIN campaigns cm ON cm.id = s.campaign_id
         WHERE cm.slug = ${MONICA_SLUG}
           AND s.week_no = ${baselineWeek}::smallint
           AND s.version = (
                 SELECT max(s2.version) FROM leaderboard_snapshots s2
                  WHERE s2.campaign_id = s.campaign_id
                    AND s2.week_no = s.week_no)
      ),
      badges AS (
        SELECT w.campaign_creator_id,
               json_agg(json_build_object('weekNo', w.week_no, 'category', w.category)
                        ORDER BY w.week_no, w.category) AS badges
          FROM weekly_winners w
          JOIN campaigns cm ON cm.id = w.campaign_id
         WHERE cm.slug = ${MONICA_SLUG}
           AND w.published_at IS NOT NULL
         GROUP BY w.campaign_creator_id
      ),
      approved AS (
        SELECT ce.campaign_creator_id,
               to_json(array_agg(DISTINCT s.platform ORDER BY s.platform)) AS platforms,
               count(DISTINCT ch.week_no)
                 FILTER (WHERE ch.type = 'regular'
                           AND ch.week_no BETWEEN 1 AND ${stageCount}) AS stages
          FROM challenge_entries ce
          JOIN challenges ch ON ch.id = ce.challenge_id
          JOIN submissions s ON s.entry_id = ce.id AND s.status = 'approved'
         WHERE ce.campaign_creator_id IN (SELECT campaign_creator_id FROM board)
         GROUP BY ce.campaign_creator_id
      )
      SELECT b.rank,
             b.display_name,
             b.points_total,
             COALESCE(a.stages, 0) AS stages,
             p.previous_rank,
             COALESCE(bd.badges, '[]'::json) AS badges,
             COALESCE(a.platforms, '[]'::json) AS platforms,
             EXISTS (SELECT 1 FROM previous) AS has_baseline
        FROM board b
        LEFT JOIN previous p ON p.campaign_creator_id = b.campaign_creator_id
        LEFT JOIN badges bd ON bd.campaign_creator_id = b.campaign_creator_id
        LEFT JOIN approved a ON a.campaign_creator_id = b.campaign_creator_id
       ORDER BY b.rank
    `);

    const raw = (result.rows ?? []) as Record<string, unknown>[];
    const hasBaseline = raw.some((row) => row.has_baseline === true);

    return {
      rows: raw.map((row) => toPublicRow(row, stageCount)),
      movementSince: hasBaseline ? baselineWeek : null,
      stageCount,
    };
  } catch (error) {
    console.warn(
      "[leaderboard] could not be read, showing an empty board:",
      error instanceof Error ? error.message : String(error),
    );
    return { rows: [], movementSince: null, stageCount };
  }
}

/** The rows alone, for callers that only need the standings. */
export async function leaderboard(limit = 100): Promise<LeaderboardRow[]> {
  return (await leaderboardView(limit)).rows;
}

/**
 * Where one creator stands, for their own page.
 *
 * Its own SQL function rather than a lookup inside the published board, and the
 * first version of this got that half right and half wrong.
 *
 * Right: the published row type is a hand-written whitelist that drops
 * campaign_creator_id on purpose, with that column named in NEVER_PUBLISH, so
 * matching on it through the public shape would mean widening the whitelist to
 * serve a private page.
 *
 * Wrong: it called campaign_leaderboard with a limit of 100000 and a comment
 * claiming there was no cap to fall outside of. The function clamps to 500, so
 * the 501st creator got nothing back, and the page renders a missing rank as
 * "Not ranked yet" exactly as it does for somebody with no approved entries.
 * creator_rank is built on campaign_ranked, which has no limit at all.
 *
 * Fails soft, like leaderboard(): a creator's own page must still render when
 * the database is unreachable, with their rank simply absent.
 */
export async function creatorRank(
  enrolmentId: string,
): Promise<number | null> {
  try {
    const result = await getDb().execute(
      sql`SELECT creator_rank(${MONICA_SLUG}, ${enrolmentId}::uuid) AS rank`,
    );

    const rank = (result.rows?.[0] as { rank?: number | null } | undefined)
      ?.rank;
    return rank === undefined || rank === null ? null : Number(rank);
  } catch (error) {
    console.warn(
      "[leaderboard] rank unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
