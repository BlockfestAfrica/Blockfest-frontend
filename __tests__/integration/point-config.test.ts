/**
 * Configuring point values, against a real Postgres (#68).
 *
 * The two acceptance criteria that carry the trust: a change never alters an
 * existing creator's total, and repricing one entry is an explicit, audited
 * act that can never happen as a side effect of editing a value.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;
let week2: string;

const one = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T> =>
  (await db.query<T>(sql, p)).rows[0];

const ruleId = async (key: string) =>
  (
    await one<{ id: string }>(
      `SELECT id FROM point_rules WHERE campaign_id = '${campaignId}' AND key = '${key}'`,
    )
  ).id;

const setRule = (rule: string, def: number | null, min: number | null = null, max: number | null = null, admin: string | null = adminId) =>
  db.query(`SELECT * FROM update_point_rule($1::uuid, $2::uuid, $3::integer, $4::integer, $5::integer)`, [rule, admin, def, min, max]);

async function creatorWithApprovedEntry() {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}')
    RETURNING id`);
  await db.query(
    `INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
     VALUES ($1, 'x', $2, $2)`,
    [creator.id, `h${tag}`],
  );
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);

  const posted = await db.query(
    `SELECT * FROM submit_entry($1::uuid, $2::uuid, 'x'::platform, $3::text, true, $4::text)`,
    [enrolment.id, week2, `https://x.com/h${tag}/status/${tag}77`, `h${tag}`],
  );
  const row = posted.rows[0] as { submission_id: string; entry_id: string };
  await db.query(`SELECT review($1::uuid, 'approved'::submission_status, $2::uuid, NULL)`, [row.submission_id, adminId]);

  return { enrolmentId: enrolment.id, entryId: row.entry_id };
}

const totalOf = async (enrolment: string) =>
  Number((await one<{ points_total: number }>(`SELECT points_total FROM campaign_creators WHERE id = '${enrolment}'`)).points_total);

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM audit_log; DELETE FROM point_ledger; DELETE FROM submissions;
    DELETE FROM challenge_entries; DELETE FROM creator_social_handles;
    DELETE FROM campaign_creators; DELETE FROM creators;
  `);
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)).id;
  adminId = (await one<{ id: string }>(`SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`)).id;
  week2 = (await one<{ id: string }>(`SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 2`)).id;
  await db.query(
    `UPDATE challenges SET status = 'active', base_points = 100,
            starts_at = now() - interval '1 day', ends_at = now() + interval '5 days'
      WHERE id = $1`, [week2]);
  await db.query(`UPDATE point_rules SET default_points = 50 WHERE campaign_id = $1 AND key = 'multi_platform_bonus_2'`, [campaignId]);
});

describe("forward-only, the criterion the trust rests on", () => {
  it("a change alters no existing total and reaches the next entry", async () => {
    const before = await creatorWithApprovedEntry();
    const beforeTotal = await totalOf(before.enrolmentId);

    await setRule(await ruleId("multi_platform_bonus_2"), 90);

    expect(await totalOf(before.enrolmentId), "history untouched").toBe(beforeTotal);

    const after = await creatorWithApprovedEntry();
    const snap = await one<{ bonus_2_snapshot: number }>(
      `SELECT bonus_2_snapshot FROM challenge_entries WHERE id = '${after.entryId}'`,
    );
    expect(Number(snap.bonus_2_snapshot), "the next entry uses the new rate").toBe(90);
  });

  it("writes the audit row with before and after", async () => {
    await setRule(await ruleId("multi_platform_bonus_2"), 90);
    const row = await one<{ after: { key: string; default_points: { from: number; to: number } } }>(
      `SELECT after FROM audit_log WHERE action = 'point_rule.updated'`,
    );
    expect(row.after.key).toBe("multi_platform_bonus_2");
    expect(row.after.default_points).toEqual({ from: 50, to: 90 });
  });

  it("refuses inverted bounds and a missing admin", async () => {
    const rule = await ruleId("quality_bonus");
    await expect(setRule(rule, null, 100, 50)).rejects.toThrow(/bounds_inverted/);
    await expect(setRule(rule, 60, null, null, null)).rejects.toThrow(/admin_required/);
  });
});

describe("repricing one entry, on purpose", () => {
  it("brings the entry to current rates and recomputes through the engine", async () => {
    const { enrolmentId, entryId } = await creatorWithApprovedEntry();
    expect(await totalOf(enrolmentId)).toBe(100);

    await db.query(`UPDATE challenges SET base_points = 150 WHERE id = $1`, [week2]);
    await db.query(`SELECT reprice_entry($1::uuid, $2::uuid, 'Rate corrected after the team decision')`, [entryId, adminId]);

    expect(await totalOf(enrolmentId), "this one entry, brought forward").toBe(150);
  });

  it("is audited with the totals it moved between", async () => {
    const { entryId } = await creatorWithApprovedEntry();
    await db.query(`UPDATE challenges SET base_points = 150 WHERE id = $1`, [week2]);
    await db.query(`SELECT reprice_entry($1::uuid, $2::uuid, 'why')`, [entryId, adminId]);

    const row = await one<{ after: { points_total: { from: number; to: number } }; note: string }>(
      `SELECT after, note FROM audit_log WHERE action = 'entry.repriced'`,
    );
    expect(row.after.points_total).toEqual({ from: 100, to: 150 });
    expect(row.note).toBe("why");
  });

  it("demands a reason and a real entry", async () => {
    const { entryId } = await creatorWithApprovedEntry();
    await expect(
      db.query(`SELECT reprice_entry($1::uuid, $2::uuid, '  ')`, [entryId, adminId]),
    ).rejects.toThrow(/reason_required/);
    await expect(
      db.query(`SELECT reprice_entry('00000000-0000-0000-0000-000000000000'::uuid, $1::uuid, 'x')`, [adminId]),
    ).rejects.toThrow(/entry_not_found/);
  });

  /**
   * The trapdoor that must not exist: editing a rule must never touch a
   * snapshot. Asserted separately from the forward-only test so that if
   * somebody wires recompute into update_point_rule for convenience, this
   * fails with the trapdoor's own name on it.
   */
  it("never happens as a side effect of editing a rule", async () => {
    const { entryId } = await creatorWithApprovedEntry();
    await setRule(await ruleId("multi_platform_bonus_2"), 95);
    const snap = await one<{ bonus_2_snapshot: number }>(
      `SELECT bonus_2_snapshot FROM challenge_entries WHERE id = '${entryId}'`,
    );
    expect(Number(snap.bonus_2_snapshot)).toBe(50);
  });
});

describe("repricing a finished week (0050)", () => {
  it("refuses: the record its winners were decided on stays as it ran", async () => {
    const { entryId } = await creatorWithApprovedEntry();
    await db.query(
      `UPDATE challenges SET starts_at = now() - interval '20 days',
                             ends_at = now() - interval '13 days'
        WHERE id = (SELECT challenge_id FROM challenge_entries WHERE id = '${entryId}')`,
    );
    await expect(
      db.query(`SELECT * FROM reprice_entry('${entryId}', '${adminId}', 'late fix')`),
    ).rejects.toThrow(/challenge_readonly/);
  });
});
