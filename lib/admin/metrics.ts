import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import type { AdminIdentity } from "@/lib/admin/session";

/**
 * What the campaign has actually done, counted rather than remembered.
 *
 * Every figure here is derived from the rows at the moment it is asked for. No
 * stored counter, deliberately: a counter is a second copy of the truth, it
 * drifts the first time something is deleted or corrected, and the drift is
 * invisible because a counter always looks like an answer. The campaign already
 * keeps one cache, campaign_creators.points_total, and it exists only because
 * the leaderboard sorts on it, with an integrity check that reconciles it
 * against the ledger.
 *
 * These numbers go into the report to Monica, so being able to say where each
 * one came from matters more than computing it quickly.
 */

export interface CampaignMetrics {
  /** Enrolled, whether or not they have submitted. Target 50. */
  creators: number;
  /** Every submission, in any state. Target 50. */
  submissions: number;
  /**
   * Approved platform URLs, which is the closest this database gets to a count
   * of UGC pieces. Target 100.
   *
   * Per platform rather than per entry on purpose: the same piece published to
   * X, Instagram and TikTok is one entry and three published artefacts, and the
   * KPI is about artefacts.
   */
  approvedUrls: number;
  /** Waiting on a reviewer. Must equal what the queue shows. */
  pending: number;
  rejected: number;
  /** Creators who registered and have never submitted anything. */
  silent: number;
  /** Referrals that have actually paid, not merely been recorded. */
  referralsPaid: number;
  referralsPending: number;
  /** Everything the ledger has minted. */
  pointsAwarded: number;
}

export async function campaignMetrics(
  admin: AdminIdentity,
): Promise<CampaignMetrics> {
  void admin;

  const result = await getDb().execute(sql`
    WITH c AS (
      SELECT cc.id, cc.creator_id
        FROM campaign_creators cc
        JOIN campaigns cm ON cm.id = cc.campaign_id
       WHERE cm.slug = ${MONICA_SLUG}
    ),
    s AS (
      SELECT sub.id, sub.status, ce.campaign_creator_id
        FROM submissions sub
        JOIN challenge_entries ce ON ce.id = sub.entry_id
        JOIN c ON c.id = ce.campaign_creator_id
    )
    SELECT
      (SELECT count(*)::int FROM c)                                    AS creators,
      (SELECT count(*)::int FROM s)                                    AS submissions,
      (SELECT count(*)::int FROM s WHERE s.status = 'approved')        AS approved_urls,
      (SELECT count(*)::int FROM s WHERE s.status = 'pending')         AS pending,
      (SELECT count(*)::int FROM s WHERE s.status = 'rejected')        AS rejected,
      (SELECT count(*)::int FROM c
        WHERE NOT EXISTS (SELECT 1 FROM s WHERE s.campaign_creator_id = c.id))
                                                                       AS silent,
      (SELECT count(*)::int FROM referrals r
        JOIN campaigns cm ON cm.id = r.campaign_id
       WHERE cm.slug = ${MONICA_SLUG} AND r.awarded_at IS NOT NULL)     AS referrals_paid,
      (SELECT count(*)::int FROM referrals r
        JOIN campaigns cm ON cm.id = r.campaign_id
       WHERE cm.slug = ${MONICA_SLUG} AND r.awarded_at IS NULL)         AS referrals_pending,
      (SELECT COALESCE(sum(pl.points), 0)::int FROM point_ledger pl
        JOIN campaigns cm ON cm.id = pl.campaign_id
       WHERE cm.slug = ${MONICA_SLUG})                                  AS points_awarded
  `);

  const row = (result.rows?.[0] ?? {}) as Record<string, unknown>;
  const n = (key: string) => Number(row[key] ?? 0);

  return {
    creators: n("creators"),
    submissions: n("submissions"),
    approvedUrls: n("approved_urls"),
    pending: n("pending"),
    rejected: n("rejected"),
    silent: n("silent"),
    referralsPaid: n("referrals_paid"),
    referralsPending: n("referrals_pending"),
    pointsAwarded: n("points_awarded"),
  };
}

export interface WeekActivity {
  weekNo: number;
  title: string;
  entries: number;
  submissions: number;
  approved: number;
  pending: number;
}

/** Per week, so a quiet stage is visible while it is still fixable. */
export async function weeklyActivity(
  admin: AdminIdentity,
): Promise<WeekActivity[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT ch.week_no, ch.title,
           count(DISTINCT ce.id)::int                                       AS entries,
           count(s.id)::int                                                 AS submissions,
           count(s.id) FILTER (WHERE s.status = 'approved')::int            AS approved,
           count(s.id) FILTER (WHERE s.status = 'pending')::int             AS pending
      FROM challenges ch
      JOIN campaigns cm            ON cm.id = ch.campaign_id
      LEFT JOIN challenge_entries ce ON ce.challenge_id = ch.id
      LEFT JOIN submissions s        ON s.entry_id = ce.id
     WHERE cm.slug = ${MONICA_SLUG}
     GROUP BY ch.week_no, ch.title
     ORDER BY ch.week_no
  `);

  return (result.rows ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      weekNo: Number(row.week_no ?? 0),
      title: String(row.title ?? ""),
      entries: Number(row.entries ?? 0),
      submissions: Number(row.submissions ?? 0),
      approved: Number(row.approved ?? 0),
      pending: Number(row.pending ?? 0),
    };
  });
}

export interface AddressCluster {
  ip: string;
  creators: number;
  names: string[];
}

/**
 * Registrations sharing one address, for a person to look at.
 *
 * Flagged, never acted on. Nigerian mobile carriers put very large numbers of
 * subscribers behind each egress address, so a shared address is weak evidence
 * of anything: a cluster here is far more likely to be two creators on the same
 * network than one person with two accounts. Automatic action on this signal
 * would remove real creators at a rate nobody would notice until the appeals
 * arrived.
 *
 * It is worth surfacing anyway, because it is the only signal in the database
 * that points at the fraud the rules forbid, and a human comparing the names
 * and the content can tell the two apart where a threshold cannot.
 */
export async function addressClusters(
  admin: AdminIdentity,
  atLeast = 3,
): Promise<AddressCluster[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT cr.registration_ip AS ip,
           count(*)::int      AS creators,
           array_agg(cr.full_name ORDER BY cr.created_at) AS names
      FROM creators cr
      JOIN campaign_creators cc ON cc.creator_id = cr.id
      JOIN campaigns cm         ON cm.id = cc.campaign_id
     WHERE cm.slug = ${MONICA_SLUG}
       AND cr.registration_ip IS NOT NULL
     GROUP BY cr.registration_ip
    HAVING count(*) >= ${atLeast}
     ORDER BY count(*) DESC
     LIMIT 50
  `);

  return (result.rows ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      ip: String(row.ip),
      creators: Number(row.creators ?? 0),
      names: Array.isArray(row.names) ? row.names.map(String) : [],
    };
  });
}
