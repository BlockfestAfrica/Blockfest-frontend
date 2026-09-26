import { CAMPAIGN_PLATFORMS, type CampaignPlatform } from "@/lib/campaigns";
import { isWinnerCategory, type WinnerCategory } from "@/lib/winner-categories";

/**
 * One row of the public leaderboard, and the only way a database row becomes
 * one.
 *
 * This is the one shape in the campaign published to anybody who visits, and
 * the table that renders it runs in the browser, so every field here reaches
 * every visitor whether or not anything draws it. The creators table holds an
 * email address, a phone number, a location, an IP address and a user agent,
 * and a leaderboard is exactly the shape of thing somebody later extends with
 * "just one more field".
 *
 * So the row is a whitelist, written by hand, field by field. It is not derived
 * from the database row and it is not a spread: both of those widen silently
 * when a column is added upstream, which is how this kind of leak happens.
 *
 * What is published, and why each is already public:
 * - name: creators compete in public under their own names, and the rules say
 *   winners are announced.
 * - rank and points: the standings themselves.
 * - stages: how many stages they have an approved entry in.
 * - previousRank: their rank in the last recorded standings, so the table can
 *   show movement. A number, never the snapshot row it came from.
 * - badges: the weekly prizes they have been announced as winning, which the
 *   winners page already publishes. Announced ones only.
 * - platforms: which platforms they have had a post approved on. Their posts
 *   are public on those platforms already; this never comes from the handles
 *   they registered, which are not published.
 *
 * Nothing that identifies an enrolment, an entry or a person beyond the name is
 * here. Every join that needs an id happens in SQL, before this.
 *
 * Kept free of server-only imports so the browser table can import the type
 * and a unit test can feed the serialiser hostile input directly.
 */

export interface LeaderboardBadge {
  weekNo: number;
  category: WinnerCategory;
}

export interface LeaderboardRow {
  rank: number;
  /** The creator's name, as they registered it. Public by design. */
  name: string;
  points: number;
  /** Stages with at least one approved post, 0 to the number of stages. */
  stages: number;
  /** Rank in the last recorded standings, or null if they were not on it. */
  previousRank: number | null;
  badges: LeaderboardBadge[];
  platforms: CampaignPlatform[];
}

/**
 * Fields that must never appear in a published leaderboard row, at any depth.
 *
 * Exported so a test can walk the real output for them rather than trusting a
 * copy of this list.
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
  // Within reach now that winners and snapshots are joined in.
  "entryId",
  "entry_id",
  "takenByAdminId",
  "taken_by_admin_id",
  "prizeAmountNaira",
  "prize_amount_naira",
] as const;

/** A json column arrives parsed from one driver and as text from another. */
function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function wholeNumber(value: unknown): number | null {
  const n = Number(value);
  return value !== null && value !== undefined && Number.isInteger(n) ? n : null;
}

/**
 * Deliberately not a spread of the query result.
 *
 * Naming each field means a column added upstream cannot reach this output by
 * accident, and a nested value is rebuilt from the two keys it is allowed to
 * have rather than passed through with whatever else the SQL put in it.
 */
export function toPublicRow(
  row: Record<string, unknown>,
  stageCount: number,
): LeaderboardRow {
  const badges: LeaderboardBadge[] = [];
  for (const item of jsonArray(row.badges)) {
    if (typeof item !== "object" || item === null) continue;
    const { weekNo, category } = item as Record<string, unknown>;
    const week = wholeNumber(weekNo);
    if (week === null || week < 1 || week > stageCount) continue;
    if (!isWinnerCategory(category)) continue;
    badges.push({ weekNo: week, category });
  }

  const approvedOn = new Set(jsonArray(row.platforms));
  const platforms = CAMPAIGN_PLATFORMS.filter((p) => approvedOn.has(p));

  const stages = wholeNumber(row.stages) ?? 0;
  const previous = wholeNumber(row.previous_rank);

  return {
    rank: Number(row.rank ?? 0),
    name: String(row.display_name ?? "").trim(),
    points: Number(row.points_total ?? 0),
    stages: Math.min(Math.max(stages, 0), stageCount),
    previousRank: previous !== null && previous > 0 ? previous : null,
    badges,
    platforms,
  };
}
