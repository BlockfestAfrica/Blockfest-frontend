/**
 * The restore drill's checks, run against a real Postgres.
 *
 * These exist to be pointed at a restored database, and a check that has only
 * ever been reasoned about is the same kind of belief as a backup nobody has
 * restored. So the suite runs them twice: against a correctly migrated
 * database, where every one must pass, and against a database broken on purpose
 * in each of the ways that matter, where the matching one must fail.
 *
 * The second half is the point. A check that cannot fail is a check that will
 * pass on a half-restored database at two in the morning, and somebody will
 * believe it.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";
import { INTEGRITY_CHECKS, runIntegrityChecks } from "@/lib/db/integrity";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

/** The shape runIntegrityChecks expects: one SQL string, one integer back. */
const query = async (sql: string): Promise<number> => {
  const rows = (await db.query<Record<string, unknown>>(sql)).rows;
  return Number(Object.values(rows[0])[0]);
};

const run = () => runIntegrityChecks(query);

const failures = async () => (await run()).filter((r) => !r.passed);

async function makeCreator(points = 100) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code, points_total)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}', ${points}) RETURNING id`);
  await db.query(`
    INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, note, awarded_by_admin_id)
    VALUES ('${campaignId}', '${enrolment.id}', 'quality_bonus', ${points}, 'seed', '${adminId}')`);
  return enrolment.id;
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  campaignId = (
    await one<{ id: string }>(
      `SELECT id FROM campaigns WHERE slug = 'monica-money-story'`,
    )
  ).id;
  /*
   * Ordered by email, not by created_at.
   *
   * Both seeded owners are inserted by one statement, so they share a
   * created_at to the microsecond and "ORDER BY created_at LIMIT 1" picks
   * whichever row the planner reaches first. That is stable until it is not:
   * across runs it returned different admins, the binding below landed on the
   * second while the first still held it, and admin_identity_user_unique
   * refused. Every test after the first failed for a reason that had nothing to
   * do with what it was testing.
   */
  adminId = (
    await one<{ id: string }>(
      `SELECT id FROM admin_users WHERE role = 'owner'
        ORDER BY email_canonical LIMIT 1`,
    )
  ).id;
  await db.query(`SELECT purge_campaign_data($1, $1)`, ["monica-money-story"]);

  // A restored database has an admin who can sign in. The seed leaves the
  // binding null, because it is trust on first use. Cleared first so the unique
  // index cannot be met by a value a previous test left behind.
  await db.query(`UPDATE admin_users SET identity_user_id = NULL`);
  await db.query(
    `UPDATE admin_users SET identity_user_id = 'restored-owner' WHERE id = '${adminId}'`,
  );
});

describe("a correctly migrated database", () => {
  it("passes every check", async () => {
    await makeCreator();
    const bad = await failures();
    expect(
      bad.map((b) => `${b.name}: expected ${b.expect}, got ${b.actual}`),
      "a freshly migrated database is the baseline; anything failing here is a broken check, not a broken restore",
    ).toEqual([]);
  });

  it("runs every check rather than stopping at the first", async () => {
    // Somebody restoring at two in the morning needs the whole picture in one
    // pass, not one problem at a time.
    expect((await run()).length).toBe(INTEGRITY_CHECKS.length);
  });
});

/**
 * Each check, against a database broken on purpose in the way it is named
 * after.
 *
 * The destructive ones get their own database rather than repairing the shared
 * one afterwards. Re-running the migrations does not undo a dropped function:
 * it fails on the first CREATE TABLE that already exists. Repairing by hand
 * would mean a second, separate description of the schema in the test file,
 * which is the thing most likely to drift from the migrations it is standing in
 * for. A fresh instance costs about half a second and cannot be wrong.
 */
describe("each check actually catches the thing it is named after", () => {
  /** A migrated database of its own, with an owner who can sign in. */
  async function broken(): Promise<{
    db: PGlite;
    campaignId: string;
    adminId: string;
    query: (sql: string) => Promise<number>;
  }> {
    const fresh = new PGlite();
    await applyMigrations(fresh);
    const campaign = (
      await fresh.query<{ id: string }>(
        `SELECT id FROM campaigns WHERE slug = 'monica-money-story'`,
      )
    ).rows[0];
    const admin = (
      await fresh.query<{ id: string }>(
        `SELECT id FROM admin_users WHERE role = 'owner' ORDER BY email_canonical LIMIT 1`,
      )
    ).rows[0];
    await fresh.query(
      `UPDATE admin_users SET identity_user_id = 'restored-owner' WHERE id = '${admin.id}'`,
    );
    return {
      db: fresh,
      campaignId: campaign.id,
      adminId: admin.id,
      query: async (sql: string) => {
        const rows = (await fresh.query<Record<string, unknown>>(sql)).rows;
        return Number(Object.values(rows[0])[0]);
      },
    };
  }

  const expectFailure = (
    results: Awaited<ReturnType<typeof run>>,
    name: string,
  ) => {
    const failed = results.filter((r) => !r.passed).map((r) => r.name);
    expect(failed, `expected "${name}" to fail`).toContain(name);
  };

  it("catches a total that has drifted from the ledger", async () => {
    // The one that decides how 5,000,000 naira is split.
    const me = await makeCreator(100);
    await db.query(
      `UPDATE campaign_creators SET points_total = 999 WHERE id = '${me}'`,
    );
    expectFailure(await run(), "every creator's total matches their ledger");
  });

  it("catches an admin who can no longer sign in", async () => {
    await db.query(`UPDATE admin_users SET identity_user_id = NULL`);
    expectFailure(await run(), "at least one owner can still sign in");
  });

  it("catches an approved submission with no reviewer", async () => {
    const me = await makeCreator();
    const week1 = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    );
    const entry = await one<{ id: string }>(`
      INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
        base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
      VALUES ('${me}', '${week1.id}', 100, 100, 200) RETURNING id`);
    await db.query(`
      INSERT INTO submissions (entry_id, platform, url, status, reviewed_at)
      VALUES ('${entry.id}', 'x', 'https://x.com/a/1', 'approved', now())`);

    expectFailure(
      await run(),
      "every approved submission has a reviewer and a time",
    );
  });

  it("catches a missing function", async () => {
    const b = await broken();
    await b.db.query(`DROP FUNCTION IF EXISTS creator_rank(text, uuid)`);
    expectFailure(
      await runIntegrityChecks(b.query),
      "every function the campaign runs on is present",
    );
    await b.db.close();
  }, 60_000);

  it("catches a missing challenge", async () => {
    const b = await broken();
    await b.db.query(
      `DELETE FROM challenges WHERE campaign_id = '${b.campaignId}' AND week_no = 4`,
    );
    expectFailure(
      await runIntegrityChecks(b.query),
      "all five stages are seeded",
    );
    await b.db.close();
  }, 60_000);

  it("catches missing award bounds", async () => {
    const b = await broken();
    await b.db.query(
      `UPDATE point_rules SET max_points = NULL WHERE key = 'quality_bonus'`,
    );
    expectFailure(
      await runIntegrityChecks(b.query),
      "the award bounds are configured",
    );
    await b.db.close();
  }, 60_000);

  it("catches a half-paid referral", async () => {
    const b = await broken();
    const mk = async (tag: string) => {
      const creator = (
        await b.db.query<{ id: string }>(`
          INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
          VALUES ('C${tag}', '${tag}@e.com', '${tag}@e.com', '0${tag}', '+2340000000${tag}', 'finance')
          RETURNING id`)
      ).rows[0];
      return (
        await b.db.query<{ id: string }>(`
          INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
          VALUES ('${b.campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`)
      ).rows[0].id;
    };

    const referrer = await mk("1");
    const referred = await mk("2");
    await b.db.query(`
      INSERT INTO referrals (campaign_id, referrer_campaign_creator_id,
                             referred_campaign_creator_id, code_used)
      VALUES ('${b.campaignId}', '${referrer}', '${referred}', 'CODE1')`);

    // The CHECK refuses this pairing, so reach past it the way a restore that
    // brought back rows without constraints would.
    await b.db.query(
      `ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referral_award_consistent`,
    );
    await b.db.query(`UPDATE referrals SET awarded_at = now()`);

    expectFailure(await runIntegrityChecks(b.query), "no referral is half-paid");
    await b.db.close();
  }, 60_000);
});
