/**
 * What has to be true of this database for the campaign to be settleable.
 *
 * These exist to be run against a RESTORED database, because a backup nobody
 * has restored is a belief rather than a backup. The point of writing them as
 * data rather than as a script is that the same list can be run against a real
 * connection by scripts/verify-database.ts and against a migrated PGlite by the
 * test suite, so the checks themselves are tested rather than trusted.
 *
 * Each one is a query returning a single integer and the number it must equal.
 * Deliberately not "greater than zero" where the real answer is exact: a check
 * that passes on a half-restored database is worse than no check, because
 * somebody will believe it.
 */

export interface IntegrityCheck {
  name: string;
  /** Why this matters, shown when it fails, at whatever hour that is. */
  because: string;
  sql: string;
  /** The value the query must return. */
  expect: number;
}

/**
 * The campaign slug is interpolated rather than parameterised on purpose: this
 * runs against a connection the operator chose, from a constant in this file,
 * and the runner must work with drivers whose parameter syntax differs.
 */
const SLUG = "monica-money-story";

export const INTEGRITY_CHECKS: IntegrityCheck[] = [
  {
    name: "every table is present",
    because:
      "A restore that brought back most of the schema will fail later, on the one table nobody checked.",
    sql: `SELECT count(*)::int FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name IN (
               'admin_users','audit_log','campaign_creators','campaigns',
               'challenge_entries','challenges','creator_social_handles',
               'creators','point_ledger','point_rules','referrals','resources',
               'submissions','vote_round_nominees','vote_rounds','votes',
               'weekly_winners','registration_attempts','leaderboard_snapshots'
             )`,
    expect: 19,
  },
  {
    name: "every function the campaign runs on is present",
    because:
      "Tables restore more reliably than functions. Registration, scoring and the leaderboard are all plpgsql, and a missing one is a 500 on the path that earns points.",
    sql: `SELECT count(DISTINCT proname)::int FROM pg_proc
           WHERE proname IN (
             'register_creator','submit_entry','review','recompute_entry_award',
             'award_points','campaign_ranked','campaign_leaderboard',
             'creator_rank','resolve_admin','set_campaign_pause',
             'purge_campaign_data','take_leaderboard_snapshot',
             'publish_weekly_winner','weekly_winner_candidates'
           )`,
    expect: 14,
  },
  {
    name: "the campaign itself is seeded",
    because:
      "The site looks the campaign up by slug on every campaign page. Without the row, registration returns 404 and nothing else matters.",
    sql: `SELECT count(*)::int FROM campaigns WHERE slug = '${SLUG}'`,
    expect: 1,
  },
  {
    name: "all five stages are seeded",
    because:
      "A missing week is a week nobody can submit to, discovered on the Monday it opens.",
    sql: `SELECT count(*)::int FROM challenges c
            JOIN campaigns cm ON cm.id = c.campaign_id
           WHERE cm.slug = '${SLUG}'`,
    expect: 5,
  },
  {
    name: "at least one owner can still sign in",
    because:
      "admin_users carries the Netlify Identity binding. Restore the schema without it and nobody can reach the review queue, which is the failure that is invisible until submissions arrive.",
    sql: `SELECT count(*)::int FROM admin_users
           WHERE is_active AND role = 'owner' AND identity_user_id IS NOT NULL`,
    expect: 1,
  },
  {
    name: "every creator's total matches their ledger",
    because:
      "This is the one that decides how 5,000,000 naira is split. points_total is a cache and the ledger is the record; where they disagree, somebody is being paid the wrong amount and no social media post can reconstruct which.",
    sql: `SELECT count(*)::int FROM campaign_creators cc
           WHERE cc.points_total <> (
             SELECT COALESCE(sum(pl.points), 0) FROM point_ledger pl
              WHERE pl.campaign_creator_id = cc.id
           )`,
    expect: 0,
  },
  {
    name: "no ledger row points at a creator that is gone",
    because:
      "An orphaned award is points owed to nobody, and it moves the totals of everybody ranked below the creator it belonged to.",
    sql: `SELECT count(*)::int FROM point_ledger pl
           WHERE NOT EXISTS (
             SELECT 1 FROM campaign_creators cc WHERE cc.id = pl.campaign_creator_id
           )`,
    expect: 0,
  },
  {
    name: "no submission points at an entry that is gone",
    because:
      "A submission with no entry cannot be reviewed and cannot score, so the creator's work is in the database and invisible to everyone.",
    sql: `SELECT count(*)::int FROM submissions s
           WHERE NOT EXISTS (
             SELECT 1 FROM challenge_entries ce WHERE ce.id = s.entry_id
           )`,
    expect: 0,
  },
  {
    name: "every approved submission has a reviewer and a time",
    because:
      "submission_reviewed_consistently should make this impossible, so a failure here means the constraint did not come back with the data, and the next bad write will not be caught either.",
    sql: `SELECT count(*)::int FROM submissions
           WHERE status <> 'pending'
             AND (reviewed_at IS NULL OR reviewed_by_admin_id IS NULL)`,
    expect: 0,
  },
  {
    name: "the award bounds are configured",
    because:
      "award_points refuses a source with no bounds, so a missing rule is not a silent risk. It is every manual bonus failing on the day somebody tries to give one.",
    sql: `SELECT count(*)::int FROM point_rules pr
            JOIN campaigns cm ON cm.id = pr.campaign_id
           WHERE cm.slug = '${SLUG}'
             AND pr.key IN ('quality_bonus','engagement_milestone','featured_blockfest',
                            'featured_monica','collab','wildcard_win','manual_adjustment')
             AND pr.max_points IS NOT NULL`,
    expect: 7,
  },
  {
    name: "no referral is half-paid",
    because:
      "referral_award_consistent requires the ledger row and the timestamp together. One without the other means a referrer was either paid with no record or recorded with no payment.",
    sql: `SELECT count(*)::int FROM referrals
           WHERE (awarded_at IS NULL) <> (awarded_ledger_id IS NULL)`,
    expect: 0,
  },
];

export interface CheckResult extends IntegrityCheck {
  actual: number;
  passed: boolean;
}

/**
 * Run them all, and never stop at the first failure.
 *
 * Somebody restoring at two in the morning needs the whole picture in one pass,
 * not one problem at a time.
 */
export async function runIntegrityChecks(
  query: (sql: string) => Promise<number>,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of INTEGRITY_CHECKS) {
    try {
      const actual = await query(check.sql);
      results.push({ ...check, actual, passed: actual === check.expect });
    } catch (error) {
      results.push({
        ...check,
        actual: Number.NaN,
        passed: false,
        because: `${check.because}\n      (the check itself failed: ${
          error instanceof Error ? error.message : String(error)
        })`,
      });
    }
  }
  return results;
}
