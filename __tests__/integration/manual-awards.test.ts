/**
 * Awarding a bonus by hand, against a real Postgres.
 *
 * The campaign page promises bonuses for work that is genuinely good or gets
 * featured. Nothing could award one: seven ledger sources existed and six of
 * them had no way to be written.
 *
 * The bounds are the part worth testing hardest. point_rules has carried
 * min_points and max_points since the first migration with nothing reading
 * them, and on a 5,000,000 naira pool a typo of 5000 instead of 500 is one
 * keystroke. These assertions are mostly about what is refused.
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

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

/*
 * Parameterised, not interpolated.
 *
 * The first version built this string by hand and a note reading "Featured on
 * Monica's account" closed the quote and produced a syntax error. That is the
 * same mistake as string-concatenated SQL in production code, in a test suite
 * for a system that is careful about exactly that. Parameters remove the class
 * rather than escaping one case of it.
 */
const award = (
  enrolment: string,
  source: string,
  points: number,
  note: string | null,
  admin: string | null = adminId,
) =>
  db.query(
    `SELECT * FROM award_points($1::uuid, $2::ledger_source, $3::integer, $4::text, $5::uuid)`,
    [enrolment, source, points, note, admin],
  );

async function makeCreator() {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  // A verified handle on x, because one test here approves a submission and
  // review() refuses to approve through an unverified one.
  await db.query(`
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized, verified_at)
    VALUES ('${creator.id}', 'x', 'ma${tag}', 'ma${tag}', now())`);

  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return enrolment.id;
}

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

describe("awarding", () => {
  it("adds the points", async () => {
    const me = await makeCreator();
    await award(me, "quality_bonus", 50, "Outstanding storytelling");
    expect(await pointsOf(me)).toBe(50);
  });

  it("records who and why on the ledger row", async () => {
    const me = await makeCreator();
    await award(me, "featured_monica", 100, "Featured on Monica's account");
    expect(
      await count(`
        SELECT count(*)::int AS n FROM point_ledger
         WHERE campaign_creator_id = '${me}'
           AND source = 'featured_monica'
           AND awarded_by_admin_id = '${adminId}'
           AND note = 'Featured on Monica''s account'`),
    ).toBe(1);
  });

  it("writes an audit row", async () => {
    const me = await makeCreator();
    await award(me, "quality_bonus", 50, "Good work");
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log
          WHERE action = 'points.awarded' AND actor_admin_id = '${adminId}'`,
      ),
    ).toBe(1);
  });

  /**
   * The ledger is append-only, so taking a bonus back is a signed negative row
   * rather than an edit. The history of the decision survives it changing.
   */
  it("takes points back as a negative row, not an edit", async () => {
    const me = await makeCreator();
    await award(me, "quality_bonus", 50, "Awarded in error");
    await award(me, "quality_bonus", -50, "Reversing the previous award");

    expect(await pointsOf(me)).toBe(0);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM point_ledger WHERE campaign_creator_id = '${me}'`,
      ),
      "both rows survive",
    ).toBe(2);
  });

  it("accumulates across sources", async () => {
    const me = await makeCreator();
    await award(me, "quality_bonus", 50, "a");
    // 50 flat since 0050, the published Featured-by-Blockfest value.
    await award(me, "featured_blockfest", 50, "b");
    expect(await pointsOf(me)).toBe(100);
  });
});

describe("the bounds", () => {
  it("refuses an award above the ceiling", async () => {
    // The slipped digit: 5000 where 500 was meant.
    const me = await makeCreator();
    await expect(
      award(me, "quality_bonus", 5000, "Typo"),
    ).rejects.toThrow(/above_maximum/);
    expect(await pointsOf(me)).toBe(0);
  });

  it("refuses an award below the floor", async () => {
    const me = await makeCreator();
    await expect(
      award(me, "quality_bonus", -5000, "Typo"),
    ).rejects.toThrow(/below_minimum/);
  });

  it("allows exactly the ceiling", async () => {
    const me = await makeCreator();
    const max = Number(
      (
        await one<{ max_points: number }>(
          `SELECT max_points FROM point_rules
            WHERE campaign_id = '${campaignId}' AND key = 'quality_bonus'`,
        )
      ).max_points,
    );
    await expect(
      award(me, "quality_bonus", max, "At the limit"),
    ).resolves.toBeTruthy();
  });

  /**
   * A source with no rule row has no ceiling, which is not a decision anybody
   * made. The failure of an absent rule should be nothing happening, not
   * anything being possible.
   */
  it("refuses a source with no bounds configured", async () => {
    await db.query(
      `DELETE FROM point_rules WHERE campaign_id = '${campaignId}' AND key = 'collab'`,
    );
    const me = await makeCreator();
    await expect(award(me, "collab", 10, "x")).rejects.toThrow(
      /no_bounds_configured/,
    );
  });

  it("has bounds on every manual source it ships with", async () => {
    const unbounded = await count(`
      SELECT count(*)::int AS n FROM point_rules
       WHERE campaign_id = '${campaignId}'
         AND key IN ('quality_bonus','engagement_milestone','featured_blockfest',
                     'featured_monica','collab','wildcard_win','manual_adjustment')
         AND min_points IS NULL AND max_points IS NULL`);
    expect(unbounded).toBe(0);
  });
});

describe("what it refuses outright", () => {
  it("refuses a source the engine owns", async () => {
    // challenge_entry and referral are computed. A hand award masquerading as
    // one would be fought by recompute_entry_award on the next review.
    const me = await makeCreator();
    await expect(
      award(me, "challenge_entry", 50, "x"),
    ).rejects.toThrow(/source_not_manual/);
    await expect(award(me, "referral", 50, "x")).rejects.toThrow(
      /source_not_manual/,
    );
  });

  it("refuses an award with no note", async () => {
    // The note is what a dispute is answered with.
    const me = await makeCreator();
    await expect(award(me, "quality_bonus", 50, null)).rejects.toThrow(
      /note_required/,
    );
  });

  it("refuses a blank note", async () => {
    const me = await makeCreator();
    await expect(award(me, "quality_bonus", 50, "   ")).rejects.toThrow(
      /note_required/,
    );
  });

  it("refuses an award with no admin", async () => {
    const me = await makeCreator();
    await expect(award(me, "quality_bonus", 50, "x", null)).rejects.toThrow(
      /admin_required/,
    );
  });

  it("refuses zero points", async () => {
    // A zero row is also refused by ledger_points_non_zero, but failing here
    // says why rather than surfacing a constraint name.
    const me = await makeCreator();
    await expect(award(me, "quality_bonus", 0, "x")).rejects.toThrow(
      /points_required/,
    );
  });

  it("refuses an unknown creator", async () => {
    await expect(
      award("00000000-0000-0000-0000-000000000000", "quality_bonus", 50, "x"),
    ).rejects.toThrow(/unknown_creator/);
  });
});

describe("what a manual award does not disturb", () => {
  it("survives the scoring engine recomputing an entry", async () => {
    // The engine reconciles challenge_entry rows only. A bonus must not be
    // treated as an over-award and clawed back.
    const me = await makeCreator();
    const week1 = (
      await one<{ id: string }>(
        `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
      )
    ).id;
    const entry = await one<{ id: string }>(`
      INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
        base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
      VALUES ('${me}', '${week1}', 100, 100, 200) RETURNING id`);
    const sub = await one<{ id: string }>(`
      INSERT INTO submissions (entry_id, platform, url)
      VALUES ('${entry.id}', 'x', 'https://x.com/a/1') RETURNING id`);

    await db.query(`SELECT review('${sub.id}', 'approved', '${adminId}', NULL)`);
    await award(me, "quality_bonus", 50, "Standout");

    await db.query(`SELECT recompute_entry_award('${entry.id}')`);

    // 100 for the approved platform, plus the 50 bonus, still there.
    expect(await pointsOf(me)).toBe(150);
  });
});

/**
 * A correction that would take a creator below zero.
 *
 * campaign_creators has carried CHECK (points_total >= 0) since the first
 * migration. award_points checked its per-source bounds and then recomputed the
 * total, so taking 100 from somebody holding 50 passed every bound and violated
 * the check, which the route did not map: the admin saw "Something went wrong
 * at our end" for an entirely reasonable thing to attempt.
 */
describe("taking points back below zero", () => {
  it("refuses, and says what they hold", async () => {
    // The floor (0028) fires before the negativity guard here, and names the
    // binding constraint: what manual sources hold, since manual sources are
    // what a manual deduction may draw on. would_go_negative survives as the
    // belt behind it, mathematically unreachable for manual awards now that
    // every manual deduction must fit inside the manual sum.
    const me = await makeCreator();
    await award(me, "quality_bonus", 50, "Featured");

    await expect(
      award(me, "quality_bonus", -100, "Reversing, wrong creator"),
    ).rejects.toThrow(/manual_floor_exceeded: holds 50 manual/);

    expect(await pointsOf(me), "unchanged").toBe(50);
  });

  it("allows a reversal down to exactly zero", async () => {
    // The common correction: undo the thing you just did.
    const me = await makeCreator();
    await award(me, "quality_bonus", 50, "Awarded in error");
    await award(me, "quality_bonus", -50, "Reversing it");
    expect(await pointsOf(me)).toBe(0);
  });

  it("still refuses a deduction from somebody holding nothing", async () => {
    const me = await makeCreator();
    await expect(
      award(me, "quality_bonus", -10, "Nothing to take"),
    ).rejects.toThrow(/manual_floor_exceeded: holds 0 manual/);
  });

  /**
   * The drain the floor exists to stop: a compromised reviewer session
   * lowering a rival instead of raising an ally. Engine points are not
   * touchable by manual deduction at all; taking them away is what
   * void_enrolment is for.
   */
  it("refuses to drain points the engine awarded", async () => {
    const me = await makeCreator();
    await db.query(
      `INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, note)
       SELECT campaign_id, id, 'referral'::ledger_source, 500, 'engine'
         FROM campaign_creators WHERE id = '${me}'`,
    );
    await expect(
      award(me, "manual_adjustment", -300, "Draining a rival"),
    ).rejects.toThrow(/manual_floor_exceeded: holds 0 manual/);
    expect(await pointsOf(me), "untouched").toBe(0);
    // pointsOf reads the cache, which the refused award never recomputed;
    // the ledger row above was inserted directly so the truth is 500.
  });
});
