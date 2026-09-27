import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import type { VoteBoard } from "@/lib/vote-board";

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
  /**
   * The ballot's coordinates, public on purpose. Casting a vote has to name
   * a round and a seat on it, and both ids identify those objects rather
   * than a person. entry_id stays unpublished: it is the creator-side key
   * and it is on the never-publish list below.
   */
  roundId: string;
  nomineeId: string;
  /**
   * When the round stops taking votes, as an ISO string. The page compares
   * it against now to decide whether to render the vote controls; the
   * engine re-checks it on every cast, so this copy is presentation only.
   */
  opensAt: string;
  closesAt: string;
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
        r.id AS round_id,
        n.id AS nominee_id,
        r.opens_at,
        r.closes_at,
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
        -- A withdrawn nominee is off the ballot: cast_vote refuses them and
        -- the count leaves them out, so a card for them would be a Vote
        -- button that can only fail, with no row in the count beside it.
        AND n.withdrawn_at IS NULL
        -- One round only: the most recently opened. A vote now runs past
        -- the start of the next stage, and if last week's round was still
        -- open when this week's opened, both ballots were merged into one
        -- list whose first row decided the page's state for all of them.
        AND r.id = (
              SELECT r2.id FROM vote_rounds r2
               WHERE r2.campaign_id = r.campaign_id AND r2.status = 'open'
               ORDER BY r2.opens_at DESC
               LIMIT 1)
      ORDER BY n.display_order, c.full_name
    `);

    return (result.rows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      // neon-http hands a timestamptz back as a string and PGlite as a
      // Date; both are pushed through Date so the page always compares one
      // shape, and an unparseable value becomes the empty string, which the
      // page reads as not open rather than open forever.
      const closes =
        r.closes_at instanceof Date
          ? r.closes_at
          : new Date(String(r.closes_at ?? ""));
      /* Same treatment for the open edge. A round is staged the day before
         it runs, so 'status = open' above means the round exists, not that
         it is taking votes: only opens_at says that. An unparseable value
         becomes the empty string, which the page reads as not yet open
         rather than open early. */
      const opens =
        r.opens_at instanceof Date
          ? r.opens_at
          : new Date(String(r.opens_at ?? ""));
      return {
        name: String(r.display_name ?? "").trim(),
        weekNo: Number(r.week_no ?? 0),
        links: toLinks(r.links),
        roundId: String(r.round_id ?? ""),
        nomineeId: String(r.nominee_id ?? ""),
        opensAt: Number.isNaN(opens.getTime()) ? "" : opens.toISOString(),
        closesAt: Number.isNaN(closes.getTime()) ? "" : closes.toISOString(),
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
 * The count for the latest round, for the public page.
 *
 * Read from vote_tally and nothing else. That view is the one closing,
 * review and publishing read (verified, not held, not removed, nominee not
 * withdrawn), so the public number is the number the result is decided on.
 * Counting the votes table here would be a second definition that an
 * unverified cast or a held vote slips through.
 *
 * The latest round that has opened, whether it is open, closed or
 * published, so the count stays up after the vote ends instead of vanishing
 * the moment an owner presses Close, and a round staged a day early does not
 * hide last week's final count before it has itself opened. Only when no
 * round has opened yet is a staged one returned, and the page shows nothing
 * for it until it opens. A draft never shows.
 *
 * Names and counts only. No entry, creator or vote ids and nothing about a
 * voter: the per-vote detail stays in the owner's console.
 *
 * Throws on failure; the route decides what a failure looks like.
 */
export async function voteBoard(): Promise<VoteBoard | null> {
  const result = await getDb().execute(sql`
    SELECT r.week_no, r.status::text AS status, r.opens_at, r.closes_at,
           t.nominee_id, t.votes, c.full_name AS display_name
      FROM vote_rounds r
      JOIN campaigns cm          ON cm.id = r.campaign_id
      JOIN vote_tally t          ON t.round_id = r.id
      JOIN vote_round_nominees n ON n.id = t.nominee_id
      JOIN challenge_entries ce  ON ce.id = t.entry_id
      JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
      JOIN creators c            ON c.id = cc.creator_id
     WHERE cm.slug = ${MONICA_SLUG}
       AND r.id = (
             SELECT r2.id FROM vote_rounds r2
              WHERE r2.campaign_id = r.campaign_id
                AND r2.status IN ('open', 'closed', 'published')
              ORDER BY (r2.opens_at <= now()) DESC, r2.opens_at DESC
              LIMIT 1)
     ORDER BY n.display_order, c.full_name
  `);

  const rows = (result.rows ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  const first = rows[0];
  const iso = (value: unknown) => {
    const at = value instanceof Date ? value : new Date(String(value ?? ""));
    return Number.isNaN(at.getTime()) ? "" : at.toISOString();
  };
  return {
    weekNo: Number(first.week_no ?? 0),
    opensAt: iso(first.opens_at),
    closesAt: iso(first.closes_at),
    closed: first.status !== "open",
    final: first.status === "published",
    asOf: new Date().toISOString(),
    nominees: rows.map((r) => ({
      nomineeId: String(r.nominee_id ?? ""),
      name: String(r.display_name ?? "").trim(),
      votes: Number(r.votes ?? 0),
    })),
  };
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

export type VoteWindowState = "none" | "before" | "open" | "closed";

/**
 * Where a shortlist's round sits in its own window.
 *
 * Three states, not two. Reading only closes_at rendered a round staged on
 * Saturday for a Sunday morning open as "Open now", with live ballots, for
 * fourteen hours: cast_vote refused every one of them while the nominees'
 * email correctly said the vote opened Sunday. Two public statements about
 * one vote, contradicting each other, on the night nominees push the link
 * hardest.
 *
 * An unreadable opens_at resolves to open, not to before. The engine
 * re-checks the window on every cast and refuses an early one on its own,
 * so the cost of guessing open is a button that answers honestly; the cost
 * of guessing not-yet is a live vote nobody can reach.
 */
export function voteWindowState(
  entry: Pick<ShortlistEntry, "opensAt" | "closesAt"> | undefined,
  now: number = Date.now(),
): VoteWindowState {
  if (!entry) return "none";
  const closes = new Date(entry.closesAt).getTime();
  if (entry.closesAt === "" || Number.isNaN(closes)) return "none";
  if (closes <= now) return "closed";
  const opens = new Date(entry.opensAt).getTime();
  if (entry.opensAt !== "" && !Number.isNaN(opens) && opens > now) return "before";
  return "open";
}
