/**
 * Rules that were written down and never read.
 *
 * void_enrolment set campaign_creators.status to 'disqualified' and nothing
 * consulted it, so being disqualified meant nothing except losing your verified
 * handles, which an admin re-verifying for an unrelated reason silently undid.
 * award_points bounded each award and not the total, so the same admin could
 * award the maximum two hundred times. And the referral payout recomputed the
 * referrer's cached total while holding no lock on the referrer.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

async function enrol() {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  await db.query(
    `INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized, verified_at)
     VALUES ($1, 'x', $2, $2, now())`,
    [creator.id, `h${tag}`],
  );
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return { enrolmentId: enrolment.id, handle: `h${tag}` };
}

const award = (enrolment: string, points: number, note = "Bonus") =>
  db.query(
    `SELECT * FROM award_points($1::uuid, 'quality_bonus'::ledger_source, $2::integer, $3::text, $4::uuid)`,
    [enrolment, points, note, adminId],
  );

const pointsOf = async (enrolment: string) =>
  Number(
    (
      await one<{ points_total: number }>(
        `SELECT points_total FROM campaign_creators WHERE id = '${enrolment}'`,
      )
    ).points_total,
  );

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
  adminId = (
    await one<{ id: string }>(
      `SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`,
    )
  ).id;
});

describe("disqualification", () => {
  async function submit(enrolment: string, handle: string, url: string) {
    const challenge = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    );
    return db.query(
      `SELECT * FROM submit_entry($1::uuid, $2::uuid, 'x'::platform, $3::text, true, $4::text)`,
      [enrolment, challenge.id, url, handle],
    );
  }

  it("stops a voided creator submitting anything further", async () => {
    const me = await enrol();
    await db.query(`SELECT void_enrolment($1::uuid, $2::uuid, 'Bought engagement')`, [
      me.enrolmentId,
      adminId,
    ]);

    await expect(
      submit(me.enrolmentId, me.handle, "https://x.com/h1/status/1"),
      "a disqualified creator who can still submit is working for nothing",
    ).rejects.toThrow(/enrolment_not_active/);
  });

  it("stops an approval going through for a voided creator", async () => {
    // The bypass: an admin re-verifies a handle for an unrelated reason and the
    // disqualification quietly stops meaning anything.
    const me = await enrol();
    const posted = await submit(me.enrolmentId, me.handle, "https://x.com/h1/status/2");
    const submissionId = (posted.rows[0] as { submission_id: string }).submission_id;

    await db.query(`SELECT void_enrolment($1::uuid, $2::uuid, 'Bought engagement')`, [
      me.enrolmentId,
      adminId,
    ]);
    await db.query(`UPDATE creator_social_handles SET verified_at = now()`);

    await expect(
      db.query(`SELECT review($1::uuid, 'approved'::submission_status, $2::uuid, NULL)`, [
        submissionId,
        adminId,
      ]),
    ).rejects.toThrow(/enrolment_not_active/);
  });

  it("still lets a reviewer reject, so the queue can be cleared", async () => {
    const me = await enrol();
    const posted = await submit(me.enrolmentId, me.handle, "https://x.com/h1/status/3");
    const submissionId = (posted.rows[0] as { submission_id: string }).submission_id;

    await db.query(`SELECT void_enrolment($1::uuid, $2::uuid, 'Bought engagement')`, [
      me.enrolmentId,
      adminId,
    ]);

    await expect(
      db.query(`SELECT review($1::uuid, 'rejected'::submission_status, $2::uuid, 'Disqualified')`, [
        submissionId,
        adminId,
      ]),
    ).resolves.toBeTruthy();
  });

  it("leaves an active creator alone", async () => {
    const me = await enrol();
    await expect(
      submit(me.enrolmentId, me.handle, "https://x.com/h1/status/4"),
    ).resolves.toBeTruthy();
  });
});

describe("the aggregate ceiling on manual awards", () => {
  const CAP = 2000;

  it("allows awards up to the cap", async () => {
    const me = await enrol();
    for (let i = 0; i < CAP / 200; i += 1) await award(me.enrolmentId, 200);
    expect(await pointsOf(me.enrolmentId)).toBe(CAP);
  });

  it("refuses the award that would cross it, and says what they hold", async () => {
    // The attack it closes: each call passed every per-call bound, so the same
    // admin could award the maximum two hundred times over.
    const me = await enrol();
    for (let i = 0; i < CAP / 200; i += 1) await award(me.enrolmentId, 200);

    await expect(award(me.enrolmentId, 1)).rejects.toThrow(
      /manual_cap_exceeded: cap 2000 holds 2000/,
    );
    expect(await pointsOf(me.enrolmentId), "unchanged").toBe(CAP);
  });

  it("refuses an award that would cross it in one go", async () => {
    const me = await enrol();
    for (let i = 0; i < 9; i += 1) await award(me.enrolmentId, 200);
    // 1800 held; a collab (ceiling 300 since 0050) would cross 2000.
    await expect(
      db.query(
        `SELECT * FROM award_points($1::uuid, 'collab'::ledger_source, 300, 'x', $2::uuid)`,
        [me.enrolmentId, adminId],
      ),
    ).rejects.toThrow(/manual_cap_exceeded/);
  });

  /**
   * A reversal has to stay possible whatever the total, or an admin who reaches
   * the ceiling by mistake is stuck with it.
   */
  it("always allows taking points back", async () => {
    const me = await enrol();
    for (let i = 0; i < CAP / 200; i += 1) await award(me.enrolmentId, 200);
    await expect(award(me.enrolmentId, -200, "Reversing")).resolves.toBeTruthy();
    expect(await pointsOf(me.enrolmentId)).toBe(CAP - 200);
  });

  it("frees headroom once points are taken back", async () => {
    const me = await enrol();
    for (let i = 0; i < CAP / 200; i += 1) await award(me.enrolmentId, 200);
    await award(me.enrolmentId, -200, "Reversing");
    await expect(award(me.enrolmentId, 200)).resolves.toBeTruthy();
  });

  it("does not count points the engine awarded against the manual cap", async () => {
    // challenge_entry and referral are computed. Counting them would have the
    // cap punish a creator for doing well.
    const me = await enrol();
    // referral rather than challenge_entry: ledger_entry_id_iff_entry_source
    // requires an entry_id for the latter, and the point here is the source,
    // not the shape of the row.
    await db.query(
      `INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, note)
       VALUES ($1::uuid, $2::uuid, 'referral'::ledger_source, 5000, 'engine')`,
      [campaignId, me.enrolmentId],
    );
    await expect(award(me.enrolmentId, 200)).resolves.toBeTruthy();
  });

  it("is configurable without a migration", async () => {
    const me = await enrol();
    await db.query(
      `UPDATE point_rules SET max_points = 300 WHERE campaign_id = '${campaignId}' AND key = 'manual_total_cap'`,
    );
    // 200 is quality's own ceiling since 0050; the second award crosses
    // the lowered aggregate, not the per-source bound.
    await award(me.enrolmentId, 200);
    await expect(award(me.enrolmentId, 200)).rejects.toThrow(/manual_cap_exceeded/);
  });
});

describe("recomputing a total", () => {
  it("takes the row lock before reading the ledger", async () => {
    // Asserted on the source: a lost update needs two concurrent writers, which
    // PGlite is single-process and cannot produce. What is checkable is that
    // the lock is taken, and by the function every caller now goes through.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(process.cwd(), "netlify/database/migrations/0024_enforcement.sql"),
      "utf8",
    );
    const body = sql.slice(sql.indexOf("FUNCTION recompute_points_total"));
    const lockAt = body.indexOf("FOR UPDATE");
    const readAt = body.indexOf("SELECT COALESCE(sum(points)");

    expect(lockAt, "the lock must be taken").toBeGreaterThan(-1);
    expect(lockAt, "and taken before the ledger is read").toBeLessThan(readAt);
  });

  it("is what the referral payout uses", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(process.cwd(), "netlify/database/migrations/0024_enforcement.sql"),
      "utf8",
    );
    const fn = sql.slice(sql.indexOf("FUNCTION recompute_entry_award"));
    expect(
      fn.includes("recompute_points_total"),
      "the referrer's total must not be written without their row lock",
    ).toBe(true);
  });

  it("still produces the right total", async () => {
    const me = await enrol();
    await award(me.enrolmentId, 150);
    const total = await one<{ recompute_points_total: number }>(
      `SELECT recompute_points_total('${me.enrolmentId}'::uuid)`,
    );
    expect(Number(total.recompute_points_total)).toBe(150);
  });
});

/**
 * The two rules 0028 added, exercised against the real functions.
 */
describe("the manual floor (0028)", () => {
  it("refuses to drain engine points below the manual sum", async () => {
    const me = await enrol();
    await db.query(
      `INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, note)
       VALUES ($1::uuid, $2::uuid, 'referral'::ledger_source, 500, 'engine')`,
      [campaignId, me.enrolmentId],
    );
    await db.query(`SELECT recompute_points_total($1::uuid)`, [me.enrolmentId]);

    await expect(
      award(me.enrolmentId, -300, "Draining a rival"),
    ).rejects.toThrow(/manual_floor_exceeded: holds 0 manual/);
    expect(await pointsOf(me.enrolmentId), "untouched").toBe(500);
  });

  it("still allows reversing exactly what manual sources gave", async () => {
    const me = await enrol();
    await award(me.enrolmentId, 200);
    await expect(award(me.enrolmentId, -200, "Reversing")).resolves.toBeTruthy();
    expect(await pointsOf(me.enrolmentId)).toBe(0);
  });
});

describe("the void and approve race (0028)", () => {
  it("takes the enrolment's row lock before reading its status", async () => {
    // A lost race needs two concurrent writers, which single-process PGlite
    // cannot produce, so the lock's presence and position are asserted on the
    // latest definition of review() instead.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(process.cwd(), "netlify/database/migrations/0028_adversary_fixes.sql"),
      "utf8",
    );
    /*
     * Comments stripped first. The lock is explained in a comment directly
     * above the SELECT, and the first version of this assertion found the
     * words "FOR UPDATE OF cc" in that prose rather than in the code,
     * measured a negative distance, and failed on correct SQL. A guard that
     * cannot tell code from prose about code punishes writing the reason
     * down, which this codebase refuses to do.
     */
    const fn = sql
      .slice(sql.indexOf("CREATE OR REPLACE FUNCTION review("))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*--.*$/gm, "");
    const statusRead = fn.indexOf("COALESCE(cc.status, 'active')");
    const lock = fn.indexOf("FOR UPDATE OF cc");

    expect(statusRead, "the status read exists").toBeGreaterThan(-1);
    expect(lock, "and is made under the enrolment's lock").toBeGreaterThan(statusRead);
    expect(lock - statusRead, "in the same statement").toBeLessThan(600);
  });
});
