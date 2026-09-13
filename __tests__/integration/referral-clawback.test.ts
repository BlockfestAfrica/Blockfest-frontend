/**
 * Disqualifying a creator takes back the referral they were worth.
 *
 * The programme pays the referrer when the creator they brought in has their
 * first approved entry. Nothing reversed that payment on disqualification,
 * which left referral farming profitable even when caught: register throwaway
 * accounts, get one entry approved on each, and the referral points survive
 * the bans.
 *
 * Paid through the real path (review approving a first entry), never by
 * writing ledger rows, so what is asserted is what production does.
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

async function link(referrer: string, referred: string) {
  await db.query(`
    INSERT INTO referrals (campaign_id, referrer_campaign_creator_id,
                           referred_campaign_creator_id, code_used)
    VALUES ('${campaignId}', '${referrer}', '${referred}', 'CODE')`);
}

/** First approval pays the referral, through review() like production. */
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
}

const voidIt = (enrolment: string) =>
  db.query(`SELECT void_enrolment('${enrolment}', '${adminId}', 'Bought engagement')`);

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM audit_log; DELETE FROM referrals; DELETE FROM point_ledger;
    DELETE FROM submissions; DELETE FROM challenge_entries;
    DELETE FROM creator_social_handles; DELETE FROM campaign_creators;
    DELETE FROM creators;
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

describe("voiding a creator whose referral was paid", () => {
  it("takes the points back from the referrer", async () => {
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, "https://x.com/h2/status/1");

    const paid = await pointsOf(referrer);
    expect(paid, "the referral was actually paid first").toBeGreaterThan(0);

    await voidIt(farmed);
    expect(await pointsOf(referrer), "and taken back on the void").toBe(0);
  });

  it("reverses as a negative row, never an edit", async () => {
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, "https://x.com/h2/status/2");
    await voidIt(farmed);

    expect(
      await count(`
        SELECT count(*)::int AS n FROM point_ledger
         WHERE campaign_creator_id = '${referrer}' AND source = 'referral'`),
      "both the payment and the reversal survive",
    ).toBe(2);
    // The referral row keeps its history too.
    expect(
      await count(`
        SELECT count(*)::int AS n FROM referrals
         WHERE referred_campaign_creator_id = '${farmed}' AND awarded_at IS NOT NULL`),
    ).toBe(1);
  });

  it("does not reverse twice when the void runs twice", async () => {
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, "https://x.com/h2/status/3");

    await voidIt(farmed);
    await voidIt(farmed);

    expect(await pointsOf(referrer), "one reversal, not two").toBe(0);
  });

  it("records what it reversed in the audit row", async () => {
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, "https://x.com/h2/status/4");
    await voidIt(farmed);

    const row = await one<{ after: { referral_points_reversed: number } }>(`
      SELECT after FROM audit_log
       WHERE action = 'enrolment.voided' ORDER BY created_at DESC LIMIT 1`);
    expect(row.after.referral_points_reversed).toBeGreaterThan(0);
  });
});

describe("the cases where there is nothing to take", () => {
  it("voids cleanly when no referral was ever paid", async () => {
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    await link(referrer, farmed);
    // No approval, so no payment. review() refuses approvals after the void,
    // so this referral can never become payable either.
    await expect(voidIt(farmed)).resolves.toBeTruthy();
    expect(await pointsOf(referrer)).toBe(0);
  });

  it("voids cleanly for a creator nobody referred", async () => {
    const loner = await makeCreator();
    await expect(voidIt(loner)).resolves.toBeTruthy();
  });
});

describe("the clamp", () => {
  /**
   * points_total carries CHECK >= 0. A referrer who has since had deductions
   * could otherwise make the whole void fail, which would mean a cheat cannot
   * be disqualified because their referrer's balance happens to be low.
   */
  it("still voids when the referrer no longer holds the full amount", async () => {
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, "https://x.com/h2/status/5");

    const paid = await pointsOf(referrer);
    /*
     * Leave the referrer holding less than was paid. Written straight into
     * the ledger rather than through award_points, because the floor added in
     * 0028 rightly refuses a manual deduction of engine-awarded points; the
     * clamp exists for ANY low-total state however it arose, and this is the
     * honest way to make one.
     */
    await db.query(`
      INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, note, awarded_by_admin_id)
      SELECT campaign_id, id, 'manual_adjustment'::ledger_source, ${-(paid - 10)}, 'Fixture', '${adminId}'
        FROM campaign_creators WHERE id = '${referrer}'`);
    await db.query(`SELECT recompute_points_total('${referrer}'::uuid)`);
    expect(await pointsOf(referrer)).toBe(10);

    await expect(voidIt(farmed), "the void must not fail on the CHECK").resolves.toBeTruthy();
    expect(await pointsOf(referrer), "clamped to what they held").toBe(0);
    expect(
      await count(`
        SELECT count(*)::int AS n FROM point_ledger
         WHERE campaign_creator_id = '${referrer}' AND note LIKE '%Clamped%'`),
      "and the clamp is written down",
    ).toBe(1);
  });
});
