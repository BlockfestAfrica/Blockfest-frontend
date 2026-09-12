import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";

/**
 * Weekly winners and the Community Favourite shortlist, for the public page.
 *
 * Same rule as the leaderboard: this output is published to anybody who
 * visits, so the row types are hand-written whitelists rather than anything
 * derived from a database row. The creators table holds an email, a phone
 * number, a location, an IP and a user agent, and a winners page is exactly the
 * shape of thing somebody later extends with one more field.
 *
 * A name and the links they published are public because these creators are
 * competing in public under their own names and the rules say winners are
 * announced. Nothing else about them is.
 *
 * Nothing unpublished is ever returned. A draft chosen on the Saturday and
 * announced on the Sunday must not be visible in between, and the filter is
 * here rather than in a caller so there is one place to get it right.
 */

export interface PublishedWinner {
  weekNo: number;
  category: "creator_of_week" | "community_favourite";
  /** As they registered it. Public by design. */
  name: string;
  prizeNaira: number;
  /** The reason, when one was recorded. */
  note: string | null;
  /** Where the winning entry was published, if it is tied to one. */
  links: { platform: string; url: string }[];
}

export interface ShortlistEntry {
  name: string;
  weekNo: number;
  links: { platform: string; url: string }[];
}

/**
 * Fails soft, like the leaderboard.
 *
 * A winners page that 500s is worse than one that says nothing is announced
 * yet, and this page is linked from the landing page during a live campaign.
 */
export async function publishedWinners(): Promise<PublishedWinner[]> {
  try {
    const result = await getDb().execute(sql`
      SELECT
        w.week_no,
        w.category::text            AS category,
        c.full_name                 AS display_name,
        w.prize_amount_naira,
        w.note,
        COALESCE(
          (
            SELECT json_agg(json_build_object('platform', s.platform, 'url', s.url)
                            ORDER BY s.platform)
              FROM submissions s
             WHERE s.entry_id = w.entry_id
               AND s.status = 'approved'
          ),
          '[]'::json
        ) AS links
      FROM weekly_winners w
      JOIN campaigns cm         ON cm.id = w.campaign_id
      JOIN campaign_creators cc ON cc.id = w.campaign_creator_id
      JOIN creators c           ON c.id = cc.creator_id
      WHERE cm.slug = ${MONICA_SLUG}
        AND w.published_at IS NOT NULL
      ORDER BY w.week_no DESC, w.category
    `);

    return (result.rows ?? []).map((row) => toPublicWinner(row as Record<string, unknown>));
  } catch (error) {
    console.warn(
      "[winners] unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/**
 * Named by hand, not spread.
 *
 * Adding a column upstream cannot reach this output by accident. It has to be
 * added here, on purpose, by somebody who has read this.
 */
function toPublicWinner(row: Record<string, unknown>): PublishedWinner {
  return {
    weekNo: Number(row.week_no ?? 0),
    category:
      row.category === "community_favourite"
        ? "community_favourite"
        : "creator_of_week",
    name: String(row.display_name ?? "").trim(),
    prizeNaira: Number(row.prize_amount_naira ?? 0),
    note: row.note ? String(row.note) : null,
    links: toLinks(row.links),
  };
}

function toLinks(value: unknown): { platform: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is { platform: string; url: string } =>
      Boolean(v && typeof v === "object" && "url" in v),
    )
    .map((v) => ({ platform: String(v.platform), url: String(v.url) }));
}

/**
 * The Community Favourite shortlist for the open voting round.
 *
 * One card per ENTRY, not per submission. A creator who published the same
 * piece on X, Instagram and TikTok has one entry and three submissions, and
 * putting them on the ballot three times would split their own vote against
 * themselves. That is the same grouping rule the leaderboard uses.
 */
export async function currentShortlist(): Promise<ShortlistEntry[]> {
  try {
    const result = await getDb().execute(sql`
      SELECT
        c.full_name AS display_name,
        ch.week_no,
        COALESCE(
          (
            SELECT json_agg(json_build_object('platform', s.platform, 'url', s.url)
                            ORDER BY s.platform)
              FROM submissions s
             WHERE s.entry_id = n.entry_id
               AND s.status = 'approved'
          ),
          '[]'::json
        ) AS links
      FROM vote_round_nominees n
      JOIN vote_rounds r         ON r.id = n.round_id
      JOIN campaigns cm          ON cm.id = r.campaign_id
      JOIN challenge_entries ce  ON ce.id = n.entry_id
      JOIN challenges ch         ON ch.id = ce.challenge_id
      JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
      JOIN creators c            ON c.id = cc.creator_id
      WHERE cm.slug = ${MONICA_SLUG}
        AND r.status = 'open'
      ORDER BY n.display_order, c.full_name
    `);

    return (result.rows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        name: String(r.display_name ?? "").trim(),
        weekNo: Number(r.week_no ?? 0),
        links: toLinks(r.links),
      };
    });
  } catch (error) {
    console.warn(
      "[winners] shortlist unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/**
 * Fields that must never appear on the winners page.
 *
 * Exported so a test asserts against the real output rather than a copy of this
 * list that drifts from it.
 */
export const WINNER_NEVER_PUBLISH = [
  "email",
  "email_canonical",
  "phone",
  "phone_e164",
  "location",
  "registration_ip",
  "registration_user_agent",
  "access_token_hash",
  "referral_code",
  "campaign_creator_id",
  "creator_id",
  "entry_id",
] as const;
