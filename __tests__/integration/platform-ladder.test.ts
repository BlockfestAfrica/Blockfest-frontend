/**
 * The ladder the database actually pays, after 0030.
 *
 * The page and the database hold the same rule in two shapes: monicaPointLadder
 * is the total a creator ends up with, point_rules holds the increment above
 * base_points, and recompute_entry_award adds them. Asserting the page's copy
 * proves nothing about what gets paid, so this walks a real entry through the
 * engine.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";
import { holdChallengeOpen } from "../helpers/challenge-window";
import { monicaPointLadder } from "@/lib/campaigns";

let db: PGlite;
let seq = 0;
let campaignId: string;
let week1: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T> =>
  (await db.query<T>(sql, p)).rows[0];

const PLATFORMS = ["x", "instagram", "tiktok"] as const;

async function creatorOn(platforms: readonly string[]) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  for (const platform of platforms) {
    await db.query(
      `INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized, verified_at)
       VALUES ($1, $2, $3, $3, now())`,
      [creator.id, platform, `h${tag}${platform}`],
    );
  }
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return { enrolmentId: enrolment.id, tag };
}

/** Submit and approve one entry on each platform, through the real functions. */
async function earnOn(count: number) {
  const platforms = PLATFORMS.slice(0, count);
  const { enrolmentId, tag } = await creatorOn(platforms);

  for (const platform of platforms) {
    const handle = `h${tag}${platform}`;
    const url =
      platform === "x"
        ? `https://x.com/${handle}/status/${seq}${count}${platform.length}`
        : platform === "tiktok"
          ? `https://tiktok.com/@${handle}/video/${seq}${count}${platform.length}`
          : `https://instagram.com/p/AB${seq}${count}${platform.length}/`;
    const author = platform === "instagram" ? null : handle;

    const posted = await db.query(
      `SELECT * FROM submit_entry($1::uuid, $2::uuid, $3::platform, $4::text, true, $5::text)`,
      [enrolmentId, week1, platform, url, author],
    );
    const id = (posted.rows[0] as { submission_id: string }).submission_id;
    await db.query(`SELECT review($1::uuid, 'approved'::submission_status, $2::uuid, NULL)`, [
      id,
      adminId,
    ]);
  }

  return Number(
    (
      await one<{ points_total: number }>(
        `SELECT points_total FROM campaign_creators WHERE id = '${enrolmentId}'`,
      )
    ).points_total,
  );
}

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
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)).id;
  week1 = (await one<{ id: string }>(`SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`)).id;
  adminId = (await one<{ id: string }>(`SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`)).id;

  // The seed carries the campaign's real window, which is now in the past.
  await holdChallengeOpen(db);
});

describe("what the engine pays", () => {
  it("100 for one platform", async () => {
    expect(await earnOn(1)).toBe(100);
  });

  it("150 for two, not 200", async () => {
    // The change: the second posting is the same piece repurposed, so it is
    // worth 50 rather than another 100.
    expect(await earnOn(2)).toBe(150);
  });

  it("200 for all three, not 300", async () => {
    expect(await earnOn(3)).toBe(200);
  });
});

describe("the page and the database agree", () => {
  it("pays exactly what monicaPointLadder promises", async () => {
    // The assertion that matters: a creator reading the ladder on the campaign
    // page and a creator reading their own total must see the same numbers.
    for (const tier of monicaPointLadder) {
      expect(await earnOn(tier.platforms), `${tier.platforms} platform(s)`).toBe(
        tier.points,
      );
    }
  });
});
