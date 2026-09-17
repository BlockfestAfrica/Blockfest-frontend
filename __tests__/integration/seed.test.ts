/**
 * The seed migration, checked against the site it configures.
 *
 * These two describe the same campaign in two places: the registry in
 * lib/campaigns.ts is what a creator reads on the page, and the seeded rows are
 * what the endpoint and the points engine actually obey. Nothing stops them
 * drifting apart, and the drift would be silent: the page would promise one
 * opening date or one score while the database enforced another, and the first
 * person to notice would be a creator who had already been paid the wrong
 * amount.
 *
 * So the assertions here deliberately read the published values rather than
 * repeating them. A test that hardcoded 100 would keep passing after somebody
 * changed the ladder on the page and forgot the migration, which is the exact
 * failure worth catching.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigration, applyMigrations } from "../helpers/migrations";
import { campaignBySlug, MONICA_SLUG, monicaPointLadder } from "@/lib/campaigns";

let db: PGlite;

async function one<T = Record<string, unknown>>(sql: string): Promise<T> {
  const res = await db.query<T>(sql);
  return res.rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("seeded campaign", () => {
  it("exists under the slug the routes resolve", async () => {
    const row = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM campaigns WHERE slug = '${MONICA_SLUG}'`,
    );
    expect(row.n).toBe(1);
  });

  it("is active, so only the date decides whether entries are open", async () => {
    const row = await one<{ status: string }>(
      `SELECT status FROM campaigns WHERE slug = '${MONICA_SLUG}'`,
    );
    expect(row.status).toBe("active");
  });

  it("opens and closes exactly when the page says it does", async () => {
    const published = campaignBySlug(MONICA_SLUG);
    expect(published?.startsAt).toBeTruthy();
    expect(published?.endsAt).toBeTruthy();

    const row = await one<{ starts_at: Date; ends_at: Date }>(
      `SELECT starts_at, ends_at FROM campaigns WHERE slug = '${MONICA_SLUG}'`,
    );

    expect(new Date(row.starts_at).getTime()).toBe(
      new Date(published!.startsAt!).getTime(),
    );
    expect(new Date(row.ends_at).getTime()).toBe(
      new Date(published!.endsAt!).getTime(),
    );
  });

  it("keeps the campaign in Lagos time, which every displayed date assumes", async () => {
    const row = await one<{ timezone: string }>(
      `SELECT timezone FROM campaigns WHERE slug = '${MONICA_SLUG}'`,
    );
    expect(row.timezone).toBe("Africa/Lagos");
  });
});

describe("seeded point rules", () => {
  /** The three keys, resolved to the totals a creator would actually score. */
  async function ladderFromRules() {
    const rows = await db.query<{ key: string; default_points: number }>(
      `SELECT pr.key, pr.default_points
         FROM point_rules pr
         JOIN campaigns c ON c.id = pr.campaign_id
        WHERE c.slug = '${MONICA_SLUG}'`,
    );
    const by = Object.fromEntries(
      rows.rows.map((r) => [r.key, r.default_points]),
    );
    const base = by["entry_base"];
    return {
      by,
      one: base,
      two: base + by["multi_platform_bonus_2"],
      three: base + by["multi_platform_bonus_3"],
    };
  }

  it("defines every key the engine reads", async () => {
    // The three the scoring ladder needs. `referral` joined them in 0014, when
    // referrers started actually being paid, and is asserted separately below
    // because it is read at a different moment and by different code.
    const { by } = await ladderFromRules();
    for (const key of [
      "entry_base",
      "multi_platform_bonus_2",
      "multi_platform_bonus_3",
    ]) {
      expect(Object.keys(by), `missing point rule ${key}`).toContain(key);
    }
  });

  it("defines a referral value, since the rules promise referrers are paid", async () => {
    // Without a row here recompute_entry_award pays nothing and deliberately
    // leaves the referral unclaimed, so an absent rule is a silent no-op.
    const { by } = await ladderFromRules();
    expect(by["referral"]).toBeGreaterThan(0);
  });

  /**
   * The engine adds bonus_3 to the base rather than to the two-platform total,
   * so a rule set that looks like a running total scores 400 for three
   * platforms. This is the assertion that catches that.
   */
  it("scores the ladder the page publishes", async () => {
    const ladder = await ladderFromRules();
    expect(ladder.one).toBe(monicaPointLadder[0].points);
    expect(ladder.two).toBe(monicaPointLadder[1].points);
    expect(ladder.three).toBe(monicaPointLadder[2].points);
  });

  /*
   * This used to assert that NO rule had bounds, on the reasoning that nothing
   * was ever awarded by hand. That stopped being true in 0016, when admins got
   * a way to award the bonuses the campaign page promises, and every manual
   * source gained a ceiling.
   *
   * The reasoning still holds for the three ladder keys. Those are computed by
   * the engine from a snapshot and no person types a number for them, so a
   * bound on them would be a limit on arithmetic.
   */
  it("leaves the computed ladder keys unbounded, since nobody types those", async () => {
    const row = await one<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM point_rules pr
         JOIN campaigns c ON c.id = pr.campaign_id
        WHERE c.slug = '${MONICA_SLUG}'
          AND pr.key IN ('entry_base','multi_platform_bonus_2','multi_platform_bonus_3')
          AND (pr.min_points IS NOT NULL OR pr.max_points IS NOT NULL)`,
    );
    expect(row.n).toBe(0);
  });

  it("bounds every source a person can award by hand", async () => {
    // A source with no ceiling is not a decision anybody made, and award_points
    // refuses one, so an unbounded manual rule would be a silent dead end.
    const row = await one<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM point_rules pr
         JOIN campaigns c ON c.id = pr.campaign_id
        WHERE c.slug = '${MONICA_SLUG}'
          AND pr.key IN ('quality_bonus','engagement_milestone','featured_blockfest',
                         'featured_monica','collab','wildcard_win','manual_adjustment')
          AND pr.min_points IS NULL AND pr.max_points IS NULL`,
    );
    expect(row.n).toBe(0);
  });
});

/**
 * Netlify applies a migration once per database, so the schema files are never
 * replayed and create their tables unconditionally. The seed is different: it
 * can meet a database that already holds these rows, because a preview branch
 * is cut from one that does. Running it again has to be harmless.
 */
describe("re-running the seed", () => {
  it("does not duplicate the campaign or its rules", async () => {
    const rulesBefore = Number(
      (
        await one<{ n: number }>(
          `SELECT count(*)::int AS n
             FROM point_rules pr
             JOIN campaigns c ON c.id = pr.campaign_id
            WHERE c.slug = '${MONICA_SLUG}'`,
        )
      ).n,
    );

    await applyMigration(db, "0004_seed_monica.sql");

    const campaigns = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM campaigns WHERE slug = '${MONICA_SLUG}'`,
    );
    expect(campaigns.n).toBe(1);

    const rules = await one<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM point_rules pr
         JOIN campaigns c ON c.id = pr.campaign_id
        WHERE c.slug = '${MONICA_SLUG}'`,
    );
    // Whatever the current set is. The point of this test is that replaying
    // the seed adds nothing, not what the keys happen to be, so it compares
    // against the count taken before the replay rather than a number that has
    // to be edited every time a rule is added.
    expect(rules.n).toBe(rulesBefore);
  });
});
