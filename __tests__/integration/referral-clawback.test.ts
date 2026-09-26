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
     * Leave the referrer holding less than was paid, derived from the paid
     * amount rather than assuming it, so a change to the referral rate does
     * not turn this fixture into a zero-point row. Written straight into
     * the ledger rather than through award_points, because the floor added in
     * 0028 rightly refuses a manual deduction of engine-awarded points; the
     * clamp exists for ANY low-total state however it arose, and this is the
     * honest way to make one.
     */
    const hold = Math.max(1, Math.floor(paid / 2));
    await db.query(`
      INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, note, awarded_by_admin_id)
      SELECT campaign_id, id, 'manual_adjustment'::ledger_source, ${-(paid - hold)}, 'Fixture', '${adminId}'
        FROM campaign_creators WHERE id = '${referrer}'`);
    await db.query(`SELECT recompute_points_total('${referrer}'::uuid)`);
    expect(await pointsOf(referrer)).toBe(hold);

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

describe("a clawed-back referral stays clawed back", () => {
  /*
   * The hole this closes, found by auditing the results-night path.
   *
   * recompute_entry_award decided whether to pay by netting the referral's
   * own ledger rows. The clawback made that net zero, which reads exactly
   * like "never paid". So the next recompute on the voided creator's entry
   * paid the referrer a second time, and rejecting their leftover pending
   * work is enough to trigger one: 0024 explicitly permits a reviewer to
   * dispose of a disqualified creator's queue.
   *
   * There was no way back either. void_enrolment wrote its reversal under
   * an unsuffixed key, so a second void collided on ledger_idempotency_key
   * and reported success having done nothing, and award_points refuses
   * source = 'referral' outright. The points stayed on a leaderboard that
   * settles real prize money.
   */

  /** An approved entry plus a second submission still sitting pending. */
  async function farmedWithLeftoverWork(referrer: string, tag: string) {
    const farmed = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, `https://x.com/h2/status/${tag}`);
    const entry = await one<{ id: string }>(
      `SELECT id FROM challenge_entries WHERE campaign_creator_id = '${farmed}'`,
    );
    const pending = await one<{ id: string }>(`
      INSERT INTO submissions (entry_id, platform, url)
      VALUES ('${entry.id}', 'instagram', 'https://www.instagram.com/p/L${tag}/')
      RETURNING id`);
    return { farmed, pending: pending.id };
  }

  it("is not re-paid when the voided creator's leftover work is rejected", async () => {
    const referrer = await makeCreator();
    const { farmed, pending } = await farmedWithLeftoverWork(referrer, "900");

    expect(await pointsOf(referrer), "paid on the first approval").toBeGreaterThan(0);
    await voidIt(farmed);
    expect(await pointsOf(referrer), "taken back on the void").toBe(0);

    // The reviewer clears the queue, which 0024 allows for a voided creator.
    await db.query(
      `SELECT review('${pending}', 'rejected', '${adminId}', 'Not their own post')`,
    );

    expect(
      await pointsOf(referrer),
      "still zero: the creator is still disqualified",
    ).toBe(0);
  });

  it("does not deduct twice when the same creator is voided again", async () => {
    const referrer = await makeCreator();
    const { farmed } = await farmedWithLeftoverWork(referrer, "901");

    await voidIt(farmed);
    await voidIt(farmed);

    expect(await pointsOf(referrer)).toBe(0);
    expect(
      await count(
        `SELECT count(*) n FROM point_ledger WHERE source = 'referral' AND points < 0`,
      ),
      "one reversal, not two: nothing outstanding means nothing to take",
    ).toBe(1);
  });

  it("can still take it back if a second payment ever lands", async () => {
    const referrer = await makeCreator();
    const { farmed, pending } = await farmedWithLeftoverWork(referrer, "902");
    await voidIt(farmed);
    expect(await pointsOf(referrer)).toBe(0);

    /*
     * Re-activating is not a console action. It is here because it is the
     * only way left to make the pay branch fire twice, and the point of the
     * assertion is the reversal side: under the old unsuffixed key a second
     * void hit the unique constraint and was swallowed as "already
     * reversed", so a re-paid referral could never be taken back at all.
     */
    await db.query(
      `UPDATE campaign_creators SET status = 'active' WHERE id = '${farmed}'`,
    );
    await db.query(
      `SELECT review('${pending}', 'rejected', '${adminId}', 'Cleared')`,
    );
    expect(await pointsOf(referrer), "paid again once active").toBeGreaterThan(0);

    await voidIt(farmed);
    expect(await pointsOf(referrer), "and the second void reverses it").toBe(0);
  });
});

describe("a referral re-paid after a rejection took it back", () => {
  /*
   * The same clawback, missed a different way, found by the security audit.
   *
   * recompute_entry_award and void_enrolment both write
   * 'referral_reversal:<id>:n' keys into the one ledger_idempotency_key, and
   * they counted n differently: recompute by every payment and reversal row
   * the referral has, the void by its reversals alone. Approve, reject the
   * only approved work, approve again, and recompute has already written
   * ':1' by the time the void counts one reversal and builds ':1' itself.
   * The index refused the row, the handler took the refusal for a
   * concurrent void having won, and the referrer kept the points while the
   * audit row recorded nothing reversed. 0067 numbers the void the way
   * recompute does.
   *
   * The flip is not hypothetical: the queue has no pending guard, two
   * reviewers on one stale view produce it, and the decided page documents
   * sending the opposite decision as the way to change one.
   */

  /** The creator's one submission, which approveAnEntry does not return. */
  const onlySubmission = async (enrolment: string) =>
    (
      await one<{ id: string }>(`
        SELECT s.id FROM submissions s
          JOIN challenge_entries ce ON ce.id = s.entry_id
         WHERE ce.campaign_creator_id = '${enrolment}'`)
    ).id;

  const reversedOnTheVoid = async () =>
    Number(
      (
        await one<{ after: { referral_points_reversed: number } }>(`
          SELECT after FROM audit_log
           WHERE action = 'enrolment.voided' ORDER BY created_at DESC LIMIT 1`)
      ).after.referral_points_reversed,
    );

  it("is taken back when the same submission is approved again", async () => {
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, "https://x.com/h2/status/903");
    const sub = await onlySubmission(farmed);

    await db.query(
      `SELECT review('${sub}', 'rejected', '${adminId}', 'Not their own post')`,
    );
    expect(await pointsOf(referrer), "reversed with the rejection").toBe(0);
    await db.query(`SELECT review('${sub}', 'approved', '${adminId}', NULL)`);
    const repaid = await pointsOf(referrer);
    expect(repaid, "paid again on the re-approval").toBeGreaterThan(0);

    await voidIt(farmed);

    expect(await pointsOf(referrer), "and taken back on the void").toBe(0);
    expect(
      await reversedOnTheVoid(),
      "the audit row, which the owner and the referrer's notice both read",
    ).toBe(repaid);
  });

  it("is taken back when other work pays it again", async () => {
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, "https://x.com/h2/status/904");
    const sub = await onlySubmission(farmed);
    await db.query(
      `SELECT review('${sub}', 'rejected', '${adminId}', 'Not their own post')`,
    );

    // A second platform on the same entry, approved from the queue as normal.
    const other = await one<{ id: string }>(`
      INSERT INTO submissions (entry_id, platform, url)
      SELECT entry_id, 'instagram', 'https://www.instagram.com/p/L904/'
        FROM submissions WHERE id = '${sub}'
      RETURNING id`);
    await db.query(`SELECT review('${other.id}', 'approved', '${adminId}', NULL)`);
    const repaid = await pointsOf(referrer);
    expect(repaid, "paid again on the other approval").toBeGreaterThan(0);

    await voidIt(farmed);

    expect(await pointsOf(referrer)).toBe(0);
    expect(await reversedOnTheVoid()).toBe(repaid);
  });

  it("fails the void rather than report a clawback it did not make", async () => {
    /*
     * A taken key with points still outstanding is a numbering fault, not a
     * race: a second void of one enrolment queues on its row lock and then
     * finds nothing outstanding. Stand in for the fault by occupying the keys
     * this void would build, on a stranger's ledger where the referral's own
     * count cannot see them.
     */
    const referrer = await makeCreator();
    const farmed = await makeCreator();
    const stranger = await makeCreator();
    await link(referrer, farmed);
    await approveAnEntry(farmed, "https://x.com/h2/status/905");
    const paid = await pointsOf(referrer);
    const referral = (
      await one<{ id: string }>(
        `SELECT id FROM referrals WHERE referred_campaign_creator_id = '${farmed}'`,
      )
    ).id;
    // The unsuffixed key as well, so 0063 collides too and fails this on its
    // swallow rather than by building some other key.
    for (const key of [
      `referral_reversal:${referral}`,
      `referral_reversal:${referral}:1`,
    ]) {
      await db.query(`
        INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points,
                                  idempotency_key, note)
        VALUES ('${campaignId}', '${stranger}', 'referral', 1, '${key}', 'Fixture')`);
    }

    await expect(voidIt(farmed), "loud, so somebody looks").rejects.toThrow();
    expect(await pointsOf(referrer), "and nothing half-done").toBe(paid);
  });
});
