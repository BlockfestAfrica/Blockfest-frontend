/**
 * Paying a referrer, against a real Postgres.
 *
 * The rules say points are credited when the creator you referred has their
 * first approved entry, not when they register. That wording is careful: it
 * pays for participation rather than for signups, and it is the difference
 * between a referral programme and a bounty on email addresses.
 *
 * Nothing had ever credited anybody. These assertions are as much about paying
 * once as about paying at all.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;
let week1: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

const pointsOf = async (enrolment: string) =>
  Number(
    (
      await one<{ points_total: number }>(
        `SELECT points_total FROM campaign_creators WHERE id = '${enrolment}'`,
      )
    ).points_total,
  );

/** An enrolled creator with one handle. */
async function makeCreator() {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  await db.query(`
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized, verified_at)
    VALUES ('${creator.id}', 'x', 'h${tag}', 'h${tag}', now())`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return enrolment.id;
}

/** Record that `referrer` brought in `referred`. */
async function link(referrer: string, referred: string) {
  await db.query(`
    INSERT INTO referrals (campaign_id, referrer_campaign_creator_id,
                           referred_campaign_creator_id, code_used)
    VALUES ('${campaignId}', '${referrer}', '${referred}', 'CODE')`);
}

/** Submit and approve an entry for a creator, which is what triggers payout. */
async function approveAnEntry(enrolment: string, url: string) {
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolment}', '${week1}', 100, 100, 200)
    ON CONFLICT (campaign_creator_id, challenge_id) DO UPDATE SET updated_at = now()
    RETURNING id`);
  const sub = await one<{ id: string }>(`
    INSERT INTO submissions (entry_id, platform, url)
    VALUES ('${entry.id}', 'x', '${url}') RETURNING id`);
  await db.query(`SELECT review('${sub.id}', 'approved', '${adminId}', NULL)`);
  return entry.id;
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  /*
   * referrals before point_ledger, and the order is not cosmetic.
   *
   * referrals.awarded_ledger_id references point_ledger ON DELETE SET NULL, so
   * clearing the ledger first nulls that column while awarded_at stays set, and
   * the referral_award_consistent CHECK refuses the row. The first test passed
   * and every test after it failed, which is what a fixture that corrupts state
   * looks like from the outside.
   *
   * Production never deletes ledger rows: it is append-only and a correction is
   * a signed negative row. So this is a property of the fixture, not a defect,
   * and the CHECK doing this is the CHECK working.
   */
  await db.exec(`
    DELETE FROM referrals; DELETE FROM point_ledger; DELETE FROM submissions;
    DELETE FROM challenge_entries; DELETE FROM creator_social_handles;
    DELETE FROM campaign_creators; DELETE FROM creators;
  `);
  campaignId = (
    await one<{ id: string }>(
      `SELECT id FROM campaigns WHERE slug = 'monica-money-story'`,
    )
  ).id;
  week1 = (
    await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    )
  ).id;
  adminId = (
    await one<{ id: string }>(
      `SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`,
    )
  ).id;
});

describe("when the referred creator is first approved", () => {
  it("credits the referrer", async () => {
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);

    expect(await pointsOf(referrer)).toBe(0);
    await approveAnEntry(referred, "https://x.com/a/1");

    expect(await pointsOf(referrer)).toBeGreaterThan(0);
  });

  it("writes it to the ledger as a referral, not as an entry", async () => {
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);
    await approveAnEntry(referred, "https://x.com/a/2");

    expect(
      await count(
        `SELECT count(*)::int AS n FROM point_ledger
          WHERE campaign_creator_id = '${referrer}' AND source = 'referral'`,
      ),
    ).toBe(1);
  });

  it("records the award on the referral row", async () => {
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);
    await approveAnEntry(referred, "https://x.com/a/3");

    expect(
      await count(
        `SELECT count(*)::int AS n FROM referrals
          WHERE referrer_campaign_creator_id = '${referrer}'
            AND awarded_at IS NOT NULL AND awarded_ledger_id IS NOT NULL`,
      ),
    ).toBe(1);
  });

  it("pays the value configured in point_rules", async () => {
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);
    await approveAnEntry(referred, "https://x.com/a/4");

    const configured = Number(
      (
        await one<{ default_points: number }>(
          `SELECT default_points FROM point_rules
            WHERE campaign_id = '${campaignId}' AND key = 'referral'`,
        )
      ).default_points,
    );
    expect(await pointsOf(referrer)).toBe(configured);
  });
});

describe("paying once", () => {
  it("does not pay again when a second entry is approved", async () => {
    // The rule is the FIRST approved entry. A creator who keeps entering must
    // not keep paying whoever referred them.
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);

    await approveAnEntry(referred, "https://x.com/a/5");
    const afterFirst = await pointsOf(referrer);

    // A second challenge, a second approved entry.
    const week2 = (
      await one<{ id: string }>(
        `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 2`,
      )
    ).id;
    const entry = await one<{ id: string }>(`
      INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
        base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
      VALUES ('${referred}', '${week2}', 100, 100, 200) RETURNING id`);
    const sub = await one<{ id: string }>(`
      INSERT INTO submissions (entry_id, platform, url)
      VALUES ('${entry.id}', 'x', 'https://x.com/a/6') RETURNING id`);
    await db.query(`SELECT review('${sub.id}', 'approved', '${adminId}', NULL)`);

    expect(await pointsOf(referrer)).toBe(afterFirst);
  });

  it("does not pay again when the same entry is re-reviewed", async () => {
    // review() is idempotent by design, so calling it twice must not produce a
    // second referral award either.
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);

    const entry = await approveAnEntry(referred, "https://x.com/a/7");
    const afterFirst = await pointsOf(referrer);

    await db.query(`SELECT recompute_entry_award('${entry}')`);
    await db.query(`SELECT recompute_entry_award('${entry}')`);

    expect(await pointsOf(referrer)).toBe(afterFirst);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM point_ledger WHERE source = 'referral'`,
      ),
    ).toBe(1);
  });

  it("reverses on rejection and pays exactly once again on re-approval", async () => {
    // 0050 replaced the first-approval latch with reconciliation from the
    // ledger's net: the referral follows the truth of the approvals in
    // both directions, and the suffixed idempotency keys make each swing
    // land exactly once.
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);

    const entry = await approveAnEntry(referred, "https://x.com/a/8");
    const afterFirst = await pointsOf(referrer);
    expect(afterFirst).toBeGreaterThan(0);

    const sub = await one<{ id: string }>(
      `SELECT id FROM submissions WHERE entry_id = '${entry}'`,
    );
    // Rejection takes the approvals to zero, so the payment reverses: the
    // referrer holds nothing paid for work that no longer exists.
    await db.query(`SELECT review('${sub.id}', 'rejected', '${adminId}', 'no')`);
    expect(await pointsOf(referrer)).toBe(0);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM point_ledger
          WHERE source = 'referral' AND points < 0`,
      ),
    ).toBe(1);

    // Re-approval reinstates, once, to exactly the original figure.
    await db.query(`SELECT review('${sub.id}', 'approved', '${adminId}', NULL)`);
    expect(await pointsOf(referrer)).toBe(afterFirst);
    await db.query(`SELECT review('${sub.id}', 'rejected', '${adminId}', 'no2')`);
    await db.query(`SELECT review('${sub.id}', 'approved', '${adminId}', NULL)`);
    expect(await pointsOf(referrer)).toBe(afterFirst);
  });
});

describe("when nothing should be paid", () => {
  it("pays nothing while the referred creator has no approved entry", async () => {
    // Registering is not enough. That is the whole point of the wording.
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);

    const entry = await one<{ id: string }>(`
      INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
        base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
      VALUES ('${referred}', '${week1}', 100, 100, 200) RETURNING id`);
    await db.query(`
      INSERT INTO submissions (entry_id, platform, url)
      VALUES ('${entry.id}', 'x', 'https://x.com/a/9')`);

    expect(await pointsOf(referrer)).toBe(0);
  });

  it("pays nothing when an entry is rejected", async () => {
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);

    const entry = await one<{ id: string }>(`
      INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
        base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
      VALUES ('${referred}', '${week1}', 100, 100, 200) RETURNING id`);
    const sub = await one<{ id: string }>(`
      INSERT INTO submissions (entry_id, platform, url)
      VALUES ('${entry.id}', 'x', 'https://x.com/a/10') RETURNING id`);
    await db.query(`SELECT review('${sub.id}', 'rejected', '${adminId}', 'no')`);

    expect(await pointsOf(referrer)).toBe(0);
  });

  it("pays nothing to a creator nobody referred", async () => {
    const alone = await makeCreator();
    await approveAnEntry(alone, "https://x.com/a/11");

    expect(
      await count(
        `SELECT count(*)::int AS n FROM point_ledger WHERE source = 'referral'`,
      ),
    ).toBe(0);
  });

  it("releases the claim rather than consuming it when no value is configured", async () => {
    // Otherwise a misconfiguration silently burns the referral: marked paid,
    // nothing paid, and no way to tell afterwards.
    await db.query(
      `DELETE FROM point_rules WHERE campaign_id = '${campaignId}' AND key = 'referral'`,
    );
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);
    await approveAnEntry(referred, "https://x.com/a/12");

    expect(await pointsOf(referrer)).toBe(0);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM referrals WHERE awarded_at IS NULL`,
      ),
      "the referral must still be payable once a value is set",
    ).toBe(1);
  });
});

describe("the referred creator's own points", () => {
  it("are unaffected by the referral award", async () => {
    const referrer = await makeCreator();
    const referred = await makeCreator();
    await link(referrer, referred);
    await approveAnEntry(referred, "https://x.com/a/13");

    // One approved platform on a 100 point base.
    expect(await pointsOf(referred)).toBe(100);
  });
});
