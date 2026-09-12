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
