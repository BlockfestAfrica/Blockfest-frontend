/**
 * The points engine, tested against a real Postgres.
 *
 * ₦3,400,000 of the prize pool is settled by final leaderboard position, so
 * the arithmetic that produces those positions is the code least able to
 * afford being wrong. Mocking it would test the mock.
 *
 * PGlite runs actual Postgres in-process, so the schema, the constraints and
 * the plpgsql function all execute exactly as they will in Neon, with no
 * database to provision and nothing to clean up in CI. What is asserted here is
 * not "the function returns a number" but the properties that have to hold
 * however the campaign team clicks through a review queue: that approving three
 * platforms in any order lands on the same total, that the same entry never
 * counts as three, that re-running a recompute changes nothing, that a
 * rejection re-prices downwards through a new ledger row rather than by editing
 * history, and that raising a point value mid-campaign leaves finished work
 * alone.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { monicaPointLadder } from "@/lib/campaigns";

const BASE = monicaPointLadder[0].points;
const TWO = monicaPointLadder[1].points;
const THREE = monicaPointLadder[2].points;

/** The engine stores base plus a bonus per tier; the ladder is stated as totals. */
const BONUS_2 = TWO - BASE;
const BONUS_3 = THREE - BASE;

let db: PGlite;
/** review() refuses to mint points without a named actor, so tests need one. */
let adminId: string;

/** Ids are generated per fixture so tests cannot collide through shared rows. */
let seq = 0;
const uniq = () => `${Date.now()}-${++seq}`;

async function one<T = Record<string, unknown>>(sql: string): Promise<T> {
  const res = await db.query<T>(sql);
  return res.rows[0];
}

/** A creator enrolled in the campaign, with an entry on a fresh challenge. */
async function makeEntry(): Promise<{ entryId: string; enrolmentId: string }> {
  const tag = uniq();
  const { id: campaignId } = await one<{ id: string }>(`
    INSERT INTO campaigns (slug, name, status)
    VALUES ('c-${tag}', 'Campaign ${tag}', 'active') RETURNING id`);
  const { id: challengeId } = await one<{ id: string }>(`
    INSERT INTO challenges (campaign_id, title, description, week_no, starts_at, ends_at, base_points)
    VALUES ('${campaignId}', 'Challenge', 'brief', 1, now(), now() + interval '7 days', ${BASE})
    RETURNING id`);
  const { id: creatorId } = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('Creator', 'c${tag}@example.com', 'c${tag}@example.com', '0${tag}', '+234${seq}', 'finance')
    RETURNING id`);
  const { id: enrolmentId } = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creatorId}', 'R${tag}') RETURNING id`);
  const { id: entryId } = await one<{ id: string }>(`
    INSERT INTO challenge_entries
      (campaign_creator_id, challenge_id, base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolmentId}', '${challengeId}', ${BASE}, ${BONUS_2}, ${BONUS_3}) RETURNING id`);
  return { entryId, enrolmentId };
}

async function submit(entryId: string, platforms: readonly string[]) {
  for (const platform of platforms) {
    await db.query(`INSERT INTO submissions (entry_id, platform, url)
      VALUES ('${entryId}', '${platform}', 'https://${platform}.com/${uniq()}')`);
  }
}

async function reviewPlatform(
  entryId: string,
  platform: string,
  status: "approved" | "rejected",
) {
  await db.query(`SELECT review(id, '${status}', '${adminId}') FROM submissions
    WHERE entry_id = '${entryId}' AND platform = '${platform}'`);
}

const awardedPoints = async (entryId: string) =>
  Number(
    (
      await one<{ awarded_points: number }>(
        `SELECT awarded_points FROM challenge_entries WHERE id = '${entryId}'`,
      )
    ).awarded_points,
  );

const approvedEntries = async (enrolmentId: string) =>
  Number(
    (
      await one<{ approved_entries_count: number }>(
        `SELECT approved_entries_count FROM campaign_creators WHERE id = '${enrolmentId}'`,
      )
    ).approved_entries_count,
  );

beforeAll(async () => {
  db = new PGlite();
  const dir = join(process.cwd(), "drizzle");
  await db.exec(readFileSync(join(dir, "0000_init.sql"), "utf8"));
  await db.exec(readFileSync(join(dir, "0001_points_engine.sql"), "utf8"));
  await db.exec(
    readFileSync(join(dir, "0002_atomic_registration.sql"), "utf8"),
  );
  await db.exec(readFileSync(join(dir, "0003_points_integrity.sql"), "utf8"));

  const admin = await one<{ id: string }>(`
    INSERT INTO admin_users (email, email_canonical, password_hash)
    VALUES ('reviewer@blockfestafrica.com', 'reviewer@blockfestafrica.com', 'x')
    RETURNING id`);
  adminId = admin.id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("the ladder", () => {
  it.each([
    [["x"], BASE],
    [["x", "instagram"], TWO],
    [["x", "instagram", "tiktok"], THREE],
  ])("awards %j -> %i points", async (platforms, expected) => {
    const { entryId } = await makeEntry();
    await submit(entryId, platforms);
    for (const p of platforms) await reviewPlatform(entryId, p, "approved");
    expect(await awardedPoints(entryId)).toBe(expected);
  });

  it("counts one entry however many platforms it was published on", async () => {
    // The rule the whole grouping design exists for. A naive count of approved
    // submissions would say three, and the leaderboard would be wrong.
    const { entryId, enrolmentId } = await makeEntry();
    await submit(entryId, ["x", "instagram", "tiktok"]);
    for (const p of ["x", "instagram", "tiktok"])
      await reviewPlatform(entryId, p, "approved");
    expect(await approvedEntries(enrolmentId)).toBe(1);
  });
});

describe("review order", () => {
  const orderings = [
    ["x", "instagram", "tiktok"],
    ["x", "tiktok", "instagram"],
    ["instagram", "x", "tiktok"],
    ["instagram", "tiktok", "x"],
    ["tiktok", "x", "instagram"],
    ["tiktok", "instagram", "x"],
  ];

  it.each(orderings)(
    "converges on the same total when reviewed %s then %s then %s",
    async (...order) => {
      // Admins work a queue in whatever order they open it.
      const { entryId } = await makeEntry();
      await submit(entryId, ["x", "instagram", "tiktok"]);
      for (const p of order) await reviewPlatform(entryId, p, "approved");
      expect(await awardedPoints(entryId)).toBe(THREE);
    },
  );
});

describe("corrections", () => {
  it("re-prices downwards when a platform is rejected after approval", async () => {
    const { entryId } = await makeEntry();
    await submit(entryId, ["x", "instagram", "tiktok"]);
    for (const p of ["x", "instagram", "tiktok"])
      await reviewPlatform(entryId, p, "approved");
    await reviewPlatform(entryId, "tiktok", "rejected");
    expect(await awardedPoints(entryId)).toBe(TWO);
  });

  it("corrects by appending a negative row, never by editing history", async () => {
    // Points are money. "Why did my total drop" has to be answerable from
    // rows, which means corrections are entries in the ledger, not edits to it.
    const { entryId } = await makeEntry();
    await submit(entryId, ["x", "instagram", "tiktok"]);
    for (const p of ["x", "instagram", "tiktok"])
      await reviewPlatform(entryId, p, "approved");
    await reviewPlatform(entryId, "tiktok", "rejected");
    const { n } = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM point_ledger WHERE entry_id = '${entryId}' AND points < 0`,
    );
    expect(Number(n)).toBeGreaterThanOrEqual(1);
  });

  it("returns to the full total when a rejection is reversed", async () => {
    const { entryId } = await makeEntry();
    await submit(entryId, ["x", "instagram", "tiktok"]);
    for (const p of ["x", "instagram", "tiktok"])
      await reviewPlatform(entryId, p, "approved");
    await reviewPlatform(entryId, "tiktok", "rejected");
    await reviewPlatform(entryId, "tiktok", "approved");
    expect(await awardedPoints(entryId)).toBe(THREE);
  });

  it("drops to nothing when every platform is rejected", async () => {
    const { entryId, enrolmentId } = await makeEntry();
    await submit(entryId, ["x", "instagram"]);
    for (const p of ["x", "instagram"])
      await reviewPlatform(entryId, p, "approved");
    for (const p of ["x", "instagram"])
      await reviewPlatform(entryId, p, "rejected");
    expect(await awardedPoints(entryId)).toBe(0);
    expect(await approvedEntries(enrolmentId)).toBe(0);
  });

  it("is idempotent: recomputing twice changes nothing", async () => {
    const { entryId } = await makeEntry();
    await submit(entryId, ["x", "instagram"]);
    for (const p of ["x", "instagram"])
      await reviewPlatform(entryId, p, "approved");
    const before = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM point_ledger WHERE entry_id = '${entryId}'`,
    );
    await db.query(`SELECT recompute_entry_award('${entryId}')`);
    await db.query(`SELECT recompute_entry_award('${entryId}')`);
    const after = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM point_ledger WHERE entry_id = '${entryId}'`,
    );
    expect(Number(after.n)).toBe(Number(before.n));
    expect(await awardedPoints(entryId)).toBe(TWO);
  });
});

describe("configuration changes", () => {
  it("does not re-price work that is already finished", async () => {
    // An admin raising a point value must not silently reorder the leaderboard
    // under creators who have already earned their position.
    const { entryId } = await makeEntry();
    await submit(entryId, ["x", "instagram", "tiktok"]);
    for (const p of ["x", "instagram", "tiktok"])
      await reviewPlatform(entryId, p, "approved");

    await db.query(`UPDATE challenges SET base_points = ${BASE * 5}`);
    await db.query(`SELECT recompute_entry_award('${entryId}')`);

    expect(await awardedPoints(entryId)).toBe(THREE);
    await db.query(`UPDATE challenges SET base_points = ${BASE}`);
  });
});

describe("the cached total", () => {
  it("always equals the sum of the ledger", async () => {
    // The cache exists so the leaderboard is one cheap read. The ledger is the
    // truth. If they ever disagree, the truth is not what anybody is looking at.
    const { entryId } = await makeEntry();
    await submit(entryId, ["x", "instagram", "tiktok"]);
    for (const p of ["x", "instagram", "tiktok"])
      await reviewPlatform(entryId, p, "approved");
    await reviewPlatform(entryId, "instagram", "rejected");

    const { mismatched } = await one<{ mismatched: number }>(`
      SELECT count(*)::int AS mismatched FROM campaign_creators cc
       WHERE cc.points_total <>
             (SELECT COALESCE(sum(points), 0) FROM point_ledger WHERE campaign_creator_id = cc.id)`);
    expect(Number(mismatched)).toBe(0);
  });
});

describe("shapes the schema refuses outright", () => {
  it("will not take a second submission on the same platform", async () => {
    // This is what caps an entry at three platforms. Not application care.
    const { entryId } = await makeEntry();
    await submit(entryId, ["x"]);
    await expect(submit(entryId, ["x"])).rejects.toThrow();
  });

  it("will not take the same URL twice", async () => {
    const { entryId } = await makeEntry();
    const { entryId: other } = await makeEntry();
    const url = `https://x.com/shared-${uniq()}`;
    await db.query(
      `INSERT INTO submissions (entry_id, platform, url) VALUES ('${entryId}', 'x', '${url}')`,
    );
    await expect(
      db.query(
        `INSERT INTO submissions (entry_id, platform, url) VALUES ('${other}', 'x', '${url}')`,
      ),
    ).rejects.toThrow();
  });

  it("will not take a second entry for the same challenge", async () => {
    const { entryId } = await makeEntry();
    const { campaign_creator_id, challenge_id } = await one<{
      campaign_creator_id: string;
      challenge_id: string;
    }>(
      `SELECT campaign_creator_id, challenge_id FROM challenge_entries WHERE id = '${entryId}'`,
    );
    await expect(
      db.query(`INSERT INTO challenge_entries
        (campaign_creator_id, challenge_id, base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
        VALUES ('${campaign_creator_id}', '${challenge_id}', ${BASE}, ${BONUS_2}, ${BONUS_3})`),
    ).rejects.toThrow();
  });

  it("will not record an approval with no review trail", async () => {
    // Every non-pending status must carry a reviewed_at, so an approval can
    // always be traced to a moment.
    const { entryId } = await makeEntry();
    await expect(
      db.query(`INSERT INTO submissions (entry_id, platform, url, status)
        VALUES ('${entryId}', 'x', 'https://x.com/${uniq()}', 'approved')`),
    ).rejects.toThrow();
  });
});

describe("an entry nobody submitted to", () => {
  it("is worth nothing", async () => {
    const { entryId } = await makeEntry();
    await db.query(`SELECT recompute_entry_award('${entryId}')`);
    expect(await awardedPoints(entryId)).toBe(0);
  });
});

describe("the ladder in lib and the shape the schema accepts", () => {
  it("translates to snapshot values the schema will take", () => {
    // lib/campaigns.ts states the ladder as totals a creator ends up with;
    // the schema stores a base plus a bonus per tier, with a CHECK requiring
    // bonus_3 >= bonus_2 >= 0. Those are two representations of one decision,
    // edited in different files by different people. If someone reorders the
    // ladder in lib, this fails here rather than as a constraint violation on
    // the first entry of the campaign.
    expect(BONUS_2).toBeGreaterThanOrEqual(0);
    expect(BONUS_3).toBeGreaterThanOrEqual(BONUS_2);
  });

  it("is actually accepted by the schema, not just arithmetically valid", () => {
    // Asserting the inequality above is not the same as the database agreeing.
    return expect(makeEntry()).resolves.toBeTruthy();
  });

  it("covers exactly the three platforms the schema allows", () => {
    // A fourth tier in lib would be unreachable: the unique index on
    // (entry_id, platform) caps an entry at three.
    expect(monicaPointLadder.map((t) => t.platforms)).toEqual([1, 2, 3]);
  });
});

describe("who approved it", () => {
  it("refuses to mint points without a named actor", async () => {
    // The action that decides how ₦5,000,000 is split used to be anonymous by
    // construction: review() set a status and a timestamp and nothing else.
    // There is deliberately no default for the actor, because a default is a
    // way to keep doing it anonymously.
    const { entryId } = await makeEntry();
    await submit(entryId, ["x"]);
    await expect(
      db.query(
        `SELECT review(id, 'approved', NULL) FROM submissions WHERE entry_id = '${entryId}'`,
      ),
    ).rejects.toThrow(/reviewer_required/);
  });

  it("records the reviewer against the submission", async () => {
    const { entryId } = await makeEntry();
    await submit(entryId, ["x"]);
    await reviewPlatform(entryId, "x", "approved");

    const row = await one<{ reviewed_by_admin_id: string | null }>(
      `SELECT reviewed_by_admin_id FROM submissions WHERE entry_id = '${entryId}'`,
    );
    expect(row.reviewed_by_admin_id).toBe(adminId);
  });
});

describe("first_approved_at", () => {
  it("is set the first time a creator has an approved entry", async () => {
    // Declared in the schema and never written, which is worse than absent:
    // anything reading it silently got nothing. The published rules lean on a
    // time-based tiebreak, so it has to exist in the data.
    const { entryId, enrolmentId } = await makeEntry();
    await submit(entryId, ["x"]);
    await reviewPlatform(entryId, "x", "approved");

    const row = await one<{ first_approved_at: string | null }>(
      `SELECT first_approved_at FROM campaign_creators WHERE id = '${enrolmentId}'`,
    );
    expect(row.first_approved_at).not.toBeNull();
  });

  it("does not move once set, even if the approval is later reversed", async () => {
    // Losing every approval afterwards does not change when they first had one.
    const { entryId, enrolmentId } = await makeEntry();
    await submit(entryId, ["x"]);
    await reviewPlatform(entryId, "x", "approved");
    const first = await one<{ t: string }>(
      `SELECT first_approved_at AS t FROM campaign_creators WHERE id = '${enrolmentId}'`,
    );

    await reviewPlatform(entryId, "x", "rejected");
    await reviewPlatform(entryId, "x", "approved");

    const after = await one<{ t: string }>(
      `SELECT first_approved_at AS t FROM campaign_creators WHERE id = '${enrolmentId}'`,
    );
    expect(String(after.t)).toBe(String(first.t));
  });
});

describe("a rejected submission", () => {
  it("releases its URL for the rightful author", async () => {
    // While the uniqueness index ignored status, the first person to submit a
    // URL owned it permanently. Anyone could burn a public post by claiming it
    // and being rejected, and its real author could then never submit it.
    const squatter = await makeEntry();
    const author = await makeEntry();
    const url = `https://x.com/real-post-${uniq()}`;

    await db.query(
      `INSERT INTO submissions (entry_id, platform, url) VALUES ('${squatter.entryId}', 'x', '${url}')`,
    );
    await reviewPlatform(squatter.entryId, "x", "rejected");

    await expect(
      db.query(
        `INSERT INTO submissions (entry_id, platform, url) VALUES ('${author.entryId}', 'x', '${url}')`,
      ),
    ).resolves.toBeTruthy();
  });

  it("still stops two live submissions sharing a URL", async () => {
    const a = await makeEntry();
    const b = await makeEntry();
    const url = `https://x.com/contested-${uniq()}`;
    await db.query(
      `INSERT INTO submissions (entry_id, platform, url) VALUES ('${a.entryId}', 'x', '${url}')`,
    );
    await expect(
      db.query(
        `INSERT INTO submissions (entry_id, platform, url) VALUES ('${b.entryId}', 'x', '${url}')`,
      ),
    ).rejects.toThrow();
  });
});
