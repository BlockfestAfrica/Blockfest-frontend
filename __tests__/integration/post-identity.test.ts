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
  return { enrolmentId: enrolment.id, handle: `h${tag}` };
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

/** Approve whatever is stored for this url, or throw if the rule refuses. */
const approve = (url: string) =>
  db.query(
    `UPDATE submissions SET status = 'approved', reviewed_at = now() WHERE url = $1`,
    [url],
  );

describe("the same post, spelled two ways", () => {
  /**
   * The rule is about credit, not about claims. Two creators may both claim a
   * post, because refusing the second claim is what let anybody burn a rival's
   * post by filing it first. Only one may ever be paid for it.
   */
  for (const [platform, how, first, second] of SAME_POST) {
    it(`never pays twice when the second differs by ${how}`, async () => {
      const a = await enrol(platform);
      const b = await enrol(platform);

      await store(a.enrolmentId, platform, first);
      await approve(first);

      // The claim is allowed. The credit is not.
      await store(b.enrolmentId, platform, second);
      await expect(
        approve(second),
        `${second} was credited alongside ${first}, so one post was paid twice`,
      ).rejects.toThrow();
    });
  }

  it("lets a second creator claim a post that is only pending", async () => {
    // The burn attack this exists to stop: under the old rule the first filing
    // held the post until a reviewer looked, so a creator who saw a rival's
    // reel could file it and cost them the week. Instagram was the whole of the
    // exposure, because X and TikTok carry the author in the path and
    // submit_entry refuses a mismatch outright.
    const thief = await enrol("instagram");
    const author = await enrol("instagram");

    await store(thief.enrolmentId, "instagram", "https://instagram.com/p/BURNED/");
    await expect(
      store(author.enrolmentId, "instagram", "https://instagram.com/p/BURNED/"),
      "a pending claim must not block the real author from entering their own post",
    ).resolves.toBeTruthy();
  });

  it("still lets the real author be paid after the thief is rejected", async () => {
    const thief = await enrol("instagram");
    const author = await enrol("instagram");

    await store(thief.enrolmentId, "instagram", "https://instagram.com/p/CONTEST/");
    await store(author.enrolmentId, "instagram", "https://instagram.com/p/CONTEST/");

    await db.query(
      `UPDATE submissions SET status = 'rejected', reviewed_at = now()
        WHERE entry_id IN (SELECT id FROM challenge_entries WHERE campaign_creator_id = $1)`,
      [thief.enrolmentId],
    );

    // Scoped to the author's own row. Both rows carry the same url, so a blanket
    // update would try to approve the rejected one too and collide with itself.
    await expect(
      db.query(
        `UPDATE submissions SET status = 'approved', reviewed_at = now()
          WHERE status = 'pending'
            AND entry_id IN (SELECT id FROM challenge_entries WHERE campaign_creator_id = $1)`,
        [author.enrolmentId],
      ),
    ).resolves.toBeTruthy();
  });
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
      await store(a.enrolmentId, platform, first);
      await expect(store(b.enrolmentId, platform, second)).resolves.toBeTruthy();
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
    await store(a.enrolmentId, "tiktok", "https://vm.tiktok.com/ZMabcdef/");
    await expect(
      store(b.enrolmentId, "tiktok", "https://vm.tiktok.com/ZMgggggg/"),
      "a constant fallback would block every creator after the first",
    ).resolves.toBeTruthy();
  });

  it("still refuses to pay for the very same short link twice", async () => {
    const a = await enrol("tiktok");
    const b = await enrol("tiktok");
    await store(a.enrolmentId, "tiktok", "https://vm.tiktok.com/ZMabcdef/");
    await db.query(
      `UPDATE submissions SET status = 'approved', reviewed_at = now()`,
    );
    await store(b.enrolmentId, "tiktok", "https://vm.tiktok.com/ZMabcdef/");
    await expect(
      db.query(
        `UPDATE submissions SET status = 'approved', reviewed_at = now()
          WHERE status = 'pending'`,
      ),
    ).rejects.toThrow();
  });
});

describe("what the identity looks like", () => {
  it("is the platform and the post id", async () => {
    const a = await enrol("x");
    await store(a.enrolmentId, "x", "https://x.com/ada/status/123");
    expect(await identityOf("https://x.com/ada/status/123", "x")).toBe("x:123");
  });

  /** Rejection releases the credit, which 0003 established and this preserves. */
  it("lets a rejected post be credited to its real author", async () => {
    const thief = await enrol("x");
    const author = await enrol("x");

    await store(thief.enrolmentId, "x", "https://x.com/ada/status/999");
    await db.query(
      `UPDATE submissions SET status = 'approved', reviewed_at = now()`,
    );
    await store(author.enrolmentId, "x", "https://twitter.com/ada/status/999");

    // Reversed on review: the first was not theirs after all.
    await db.query(
      `UPDATE submissions SET status = 'rejected', reviewed_at = now()
        WHERE url = 'https://x.com/ada/status/999'`,
    );

    await expect(
      db.query(
        `UPDATE submissions SET status = 'approved', reviewed_at = now()
          WHERE url = 'https://twitter.com/ada/status/999'`,
      ),
      "a rejected credit must not keep holding the post under another spelling",
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

/**
 * The burn attack, and the line between a claim and a credit.
 *
 * Exercised through submit_entry and review() rather than by writing rows, so
 * what is asserted is what a creator and a reviewer actually meet.
 */
describe("two creators contesting one post", () => {
  let adminId: string;

  beforeEach(async () => {
    adminId = (
      await one<{ id: string }>(
        `SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`,
      )
    ).id;
  });

  /**
   * p_author is what authorFromUrl reads out of the URL, never the submitter's
   * own handle. Passing their handle would compare a value against itself and
   * the wrong_account check would pass for everybody.
   */
  function authorIn(url: string, platform: string): string | null {
    if (platform === "x") return url.split("/")[3] ?? null;
    if (platform === "tiktok") {
      const at = url.split("/").find((s) => s.startsWith("@"));
      return at ? at.slice(1) : null;
    }
    return null;
  }

  async function enterVia(enrolment: string, platform: string, url: string) {
    const challenge = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    );
    const result = await db.query(
      `SELECT * FROM submit_entry($1::uuid, $2::uuid, $3::platform, $4::text, true, $5::text)`,
      [enrolment, challenge.id, platform, url, authorIn(url, platform)],
    );
    return (result.rows[0] as { submission_id: string }).submission_id;
  }

  const decide = (submission: string, status: string) =>
    db.query(`SELECT review($1::uuid, $2::submission_status, $3::uuid, 'note')`, [
      submission,
      status,
      adminId,
    ]);

  const URL = "https://instagram.com/p/CONTESTED/";

  it("lets the real author enter a post a thief has pending", async () => {
    const thief = await enrol("instagram");
    const author = await enrol("instagram");

    await enterVia(thief.enrolmentId, "instagram", URL);
    await expect(
      enterVia(author.enrolmentId, "instagram", URL),
      "a pending claim used to hold the post until a reviewer looked, which cost the author the week",
    ).resolves.toBeTruthy();
  });

  it("pays only one of them", async () => {
    const thief = await enrol("instagram");
    const author = await enrol("instagram");

    const a = await enterVia(thief.enrolmentId, "instagram", URL);
    const b = await enterVia(author.enrolmentId, "instagram", URL);

    await decide(a, "approved");
    await expect(decide(b, "approved")).rejects.toThrow(/post_already_credited/);
  });

  it("frees the post when the wrong one was approved and is reversed", async () => {
    const thief = await enrol("instagram");
    const author = await enrol("instagram");

    const a = await enterVia(thief.enrolmentId, "instagram", URL);
    const b = await enterVia(author.enrolmentId, "instagram", URL);

    await decide(a, "approved");
    await decide(a, "rejected");
    await expect(decide(b, "approved")).resolves.toBeTruthy();
  });

  it("still refuses a post somebody is already credited for, at submit", async () => {
    // The good half of the old rule, kept. Without this a creator pastes a
    // link, is told it went through, and finds out at review that it never
    // counted.
    const first = await enrol("instagram");
    const second = await enrol("instagram");

    const a = await enterVia(first.enrolmentId, "instagram", "https://instagram.com/p/TAKEN/");
    await decide(a, "approved");

    await expect(
      enterVia(second.enrolmentId, "instagram", "https://instagram.com/p/TAKEN/"),
    ).rejects.toThrow(/url_already_submitted/);
  });

  it("refuses it under a different spelling too", async () => {
    const first = await enrol("instagram");
    const second = await enrol("instagram");

    const a = await enterVia(first.enrolmentId, "instagram", "https://instagram.com/p/SPELL/");
    await decide(a, "approved");

    await expect(
      enterVia(second.enrolmentId, "instagram", "https://instagr.am/reel/SPELL/"),
    ).rejects.toThrow(/url_already_submitted/);
  });

  /**
   * X and TikTok were never exposed to the burn, because the author is in the
   * path. Asserted so that stays true rather than being assumed.
   */
  it("still refuses somebody else's X post outright", async () => {
    const thief = await enrol("x");
    await expect(
      enterVia(thief.enrolmentId, "x", "https://x.com/someoneelse/status/4242"),
    ).rejects.toThrow(/wrong_account/);
  });
});
