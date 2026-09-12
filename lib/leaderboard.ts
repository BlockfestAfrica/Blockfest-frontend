import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";

/**
 * The public leaderboard.
 *
 * This is the one query in the campaign whose output is published to anybody
 * who visits, so it is the one place where a stray column is a data breach
 * rather than a bug. The creators table holds an email address, a phone number,
 * a location, an IP address and a user agent, and a leaderboard is exactly the
 * shape of thing somebody later extends with "just one more field".
 *
 * So the row type is a whitelist, built by hand from the four things a
 * leaderboard needs. It is not derived from the database row and it is not a
 * spread: both of those widen silently when a column is added upstream, which
 * is how this kind of leak actually happens.
 *
 * A name is published because these creators are competing in public under
 * their own names and the rules say winners are announced. Nothing else about
 * them is.
 */

export interface LeaderboardRow {
  rank: number;
  /** The creator's name, as they registered it. Public by design. */
  name: string;
  points: number;
  approvedEntries: number;
}

/**
 * Deliberately not `Omit<Creator, ...>` or a spread of the query result.
 *
 * Naming the four fields means adding a column upstream cannot reach this
 * output by accident. It has to be added here, on purpose, by somebody who has
 * read this comment.
 */
function toPublicRow(row: Record<string, unknown>): LeaderboardRow {
  return {
    rank: Number(row.rank ?? 0),
    name: String(row.display_name ?? "").trim(),
    points: Number(row.points_total ?? 0),
    approvedEntries: Number(row.approved_entries ?? 0),
  };
}

/**
 * Fields that must never appear in a published leaderboard row.
 *
 * Exported so a test can assert it against the real output rather than against
 * a copy of this list that drifts from it.
 */
export const NEVER_PUBLISH = [
  "email",
  "emailCanonical",
  "email_canonical",
  "phone",
  "phoneE164",
  "phone_e164",
  "location",
  "registrationIp",
  "registration_ip",
  "registrationUserAgent",
  "registration_user_agent",
  "accessTokenHash",
  "access_token_hash",
  "referralCode",
  "referral_code",
  "marketingOptIn",
  "marketing_opt_in",
  "campaignCreatorId",
  "campaign_creator_id",
  "creatorId",
  "creator_id",
] as const;

export async function leaderboard(limit = 100): Promise<LeaderboardRow[]> {
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

    const result = await db.execute(
      sql`SELECT * FROM campaign_leaderboard(${MONICA_SLUG}, ${limit})`,
    );

    return (result.rows ?? []).map((row) =>
      toPublicRow(row as Record<string, unknown>),
    );
  } catch (error) {
    console.warn(
      "[leaderboard] could not be read, showing an empty board:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}
