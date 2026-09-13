/**
 * One post, one entry, however the link is spelled.
 *
 * Uniqueness compared the URL string, and a string is not a post. Every pair
 * below is the same post written two ways, and every one of them was two
 * distinct "unique" entries: full points, repeatable every week, for work done
 * once. On a 5,000,000 naira pool decided by points, that is the whole game.
 *
 * Asserted against a real Postgres because the rule lives in a generated column
 * and an index, not in TypeScript. A unit test of a helper would prove nothing
 * about what the database will actually accept.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

async function enrol(platform = "x") {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  await db.query(
    `INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized, verified_at)
     VALUES ($1, $2, $3, $3, now())`,
    [creator.id, platform, `h${tag}`],
  );
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return enrolment.id;
}

/** Submit directly, bypassing the author check, to isolate the identity rule. */
async function store(enrolment: string, platform: string, url: string) {
  const challenge = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
  );
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolment}', '${challenge.id}', 100, 100, 200)
    ON CONFLICT (campaign_creator_id, challenge_id) DO UPDATE SET base_points_snapshot = 100
    RETURNING id`);
  return db.query(
    `INSERT INTO submissions (entry_id, platform, url) VALUES ($1, $2, $3)`,
    [entry.id, platform, url],
  );
}

const identityOf = async (url: string, platform: string) =>
  (
    await one<{ post_identity: string }>(
      `SELECT post_identity FROM submissions WHERE url = '${url}' AND platform = '${platform}' LIMIT 1`,
    )
  ).post_identity;

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
});

/** Every pair is the same post. The second must be refused. */
const SAME_POST: Array<[string, string, string, string]> = [
  ["x", "the domain rename", "https://x.com/ada/status/123", "https://twitter.com/ada/status/123"],
  ["x", "the mobile host", "https://x.com/ada/status/123", "https://mobile.x.com/ada/status/123"],
  ["x", "a different handle in the path", "https://x.com/ada/status/123", "https://x.com/someoneelse/status/123"],
  ["x", "handle case", "https://x.com/ada/status/123", "https://x.com/Ada/status/123"],
  ["x", "the plural form", "https://x.com/ada/status/123", "https://x.com/ada/statuses/123"],
  ["x", "a media suffix", "https://x.com/ada/status/123", "https://x.com/ada/status/123/photo/1"],
  ["x", "a doubled slash", "https://x.com/ada/status/123", "https://x.com//ada/status/123"],
  ["x", "the web status form", "https://x.com/ada/status/123", "https://x.com/i/web/status/123"],
  ["instagram", "the short domain", "https://instagram.com/p/ABCdef/", "https://instagr.am/p/ABCdef/"],
  ["instagram", "reel instead of p", "https://instagram.com/p/ABCdef/", "https://instagram.com/reel/ABCdef/"],
  ["instagram", "the plural reels", "https://instagram.com/p/ABCdef/", "https://instagram.com/reels/ABCdef/"],
  ["instagram", "a username prefix", "https://instagram.com/p/ABCdef/", "https://instagram.com/ada/p/ABCdef/"],
  ["tiktok", "the mobile host", "https://tiktok.com/@ada/video/7211", "https://m.tiktok.com/@ada/video/7211"],
  ["tiktok", "a different handle", "https://tiktok.com/@ada/video/7211", "https://tiktok.com/@thief/video/7211"],
];

describe("the same post, spelled two ways", () => {
  for (const [platform, how, first, second] of SAME_POST) {
    it(`refuses the second when it differs by ${how}`, async () => {
      const a = await enrol(platform);
      const b = await enrol(platform);

      await store(a, platform, first);
      await expect(
        store(b, platform, second),
        `${second} was accepted alongside ${first}, so one post counted twice`,
      ).rejects.toThrow();
    });
  }
});

describe("genuinely different posts", () => {
  /**
   * The other half, and the reason the identity is not simply the host.
   * Over-collapsing would block real entries, which costs a creator their week
   * exactly as silently as the bug it fixes.
   */
  const DIFFERENT: Array<[string, string, string]> = [
    ["x", "https://x.com/ada/status/123", "https://x.com/ada/status/124"],
    ["instagram", "https://instagram.com/p/ABCdef/", "https://instagram.com/p/ABCdeg/"],
    // Shortcodes are case sensitive, so these are two different posts.
    ["instagram", "https://instagram.com/p/ABCdef/", "https://instagram.com/p/abcdef/"],
    ["tiktok", "https://tiktok.com/@ada/video/7211", "https://tiktok.com/@ada/video/7212"],
  ];

  for (const [platform, first, second] of DIFFERENT) {
    it(`allows ${second} beside ${first}`, async () => {
      const a = await enrol(platform);
      const b = await enrol(platform);
      await store(a, platform, first);
      await expect(store(b, platform, second)).resolves.toBeTruthy();
    });
  }
});

describe("links whose post id cannot be read", () => {
  /**
   * vm.tiktok.com short links encode no video id and resolve only by following
   * the redirect, which the database cannot do. The fallback must be the URL
   * itself, never a constant: a constant would collapse every short link onto
   * one value and let the first creator to post one block everybody else.
   */
  it("does not collapse two different short links onto each other", async () => {
    const a = await enrol("tiktok");
    const b = await enrol("tiktok");
    await store(a, "tiktok", "https://vm.tiktok.com/ZMabcdef/");
    await expect(
      store(b, "tiktok", "https://vm.tiktok.com/ZMgggggg/"),
      "a constant fallback would block every creator after the first",
    ).resolves.toBeTruthy();
  });

  it("still refuses the very same short link twice", async () => {
    const a = await enrol("tiktok");
    const b = await enrol("tiktok");
    await store(a, "tiktok", "https://vm.tiktok.com/ZMabcdef/");
    await expect(store(b, "tiktok", "https://vm.tiktok.com/ZMabcdef/")).rejects.toThrow();
  });
});

describe("what the identity looks like", () => {
  it("is the platform and the post id", async () => {
    const a = await enrol("x");
    await store(a, "x", "https://x.com/ada/status/123");
    expect(await identityOf("https://x.com/ada/status/123", "x")).toBe("x:123");
  });

  /** Rejection releases the claim, which 0003 established and this preserves. */
  it("lets a rejected post be entered by its real author", async () => {
    const thief = await enrol("x");
    const author = await enrol("x");

    await store(thief, "x", "https://x.com/ada/status/999");
    await db.query(`UPDATE submissions SET status = 'rejected', reviewed_at = now()`);

    await expect(
      store(author, "x", "https://twitter.com/ada/status/999"),
      "a rejected claim must not keep holding the post under another spelling",
    ).resolves.toBeTruthy();
  });
});

/**
 * The migration has to survive data that already breaks its own rule.
 *
 * Creating a unique index over rows that already collide fails, and a failed
 * migration blocks the deploy, which on launch morning means the site does not
 * ship. Deploy previews are seeded from production, so this is not hypothetical
 * even if the table looks clean locally.
 *
 * Simulated by applying every migration up to 0022, inserting a collision that
 * the old rule allowed, and then applying 0023 over it.
 */
describe("applying the migration to data that already collides", () => {
  it("resolves the collision instead of failing the deploy", async () => {
    const fresh = new PGlite();
    try {
      await applyMigrations(fresh, { upTo: "0022" });

      const campaign = (
        await fresh.query<{ id: string }>(
          `SELECT id FROM campaigns WHERE slug = 'monica-money-story'`,
        )
      ).rows[0];
      const challenge = (
        await fresh.query<{ id: string }>(
          `SELECT id FROM challenges WHERE campaign_id = '${campaign.id}' AND week_no = 1`,
        )
      ).rows[0];

      const made: string[] = [];
      for (const tag of ["1", "2"]) {
        const creator = (
          await fresh.query<{ id: string }>(`
            INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
            VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+2340000000${tag}', 'finance')
            RETURNING id`)
        ).rows[0];
        const enrolment = (
          await fresh.query<{ id: string }>(`
            INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
            VALUES ('${campaign.id}', '${creator.id}', 'CODE${tag}') RETURNING id`)
        ).rows[0];
        const entry = (
          await fresh.query<{ id: string }>(`
            INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
              base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
            VALUES ('${enrolment.id}', '${challenge.id}', 100, 100, 200) RETURNING id`)
        ).rows[0];
        made.push(entry.id);
      }

      // The same post, two spellings. The old index allowed exactly this.
      await fresh.query(
        `INSERT INTO submissions (entry_id, platform, url) VALUES ($1, 'x', 'https://x.com/ada/status/555')`,
        [made[0]],
      );
      await fresh.query(
        `INSERT INTO submissions (entry_id, platform, url) VALUES ($1, 'x', 'https://twitter.com/ada/status/555')`,
        [made[1]],
      );

      await expect(
        applyMigrations(fresh, { from: "0023" }),
        "0023 must not fail on data the old rule permitted",
      ).resolves.not.toThrow();

      const rows = await fresh.query<{ url: string; status: string }>(
        `SELECT url, status FROM submissions ORDER BY created_at, id`,
      );

      expect(rows.rows[0].status, "the earliest claim keeps the post").toBe("pending");
      expect(rows.rows[1].status, "the later one is released, not deleted").toBe("rejected");
      expect(rows.rows.length, "nothing is destroyed").toBe(2);
    } finally {
      await fresh.close();
    }
  }, 60_000);
});
