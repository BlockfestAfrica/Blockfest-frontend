/**
 * Submission intake, against a real Postgres.
 *
 * A submission needs an entry, the entry has to be created by the first
 * submission and reused by the second, and the point rates have to be frozen
 * onto it at that moment. Over a driver with no interactive transactions that
 * is three round trips with two gaps in it, so it is one function, and these
 * assertions are about what that function refuses as much as what it accepts.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";
import { monicaPointLadder } from "@/lib/campaigns";

let db: PGlite;
let seq = 0;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

/**
 * Move a challenge's window so that it contains the present moment.
 *
 * submit_entry checks the window against now(), which is correct and is exactly
 * what stops somebody entering week four on day one. The seeded weeks are real
 * dates in September and October, so a suite run before 14 September sits
 * outside all of them. Rather than making the function take a clock as an
 * argument, which would mean testing something other than what ships, the
 * fixture moves the window.
 */
async function openNow(challenge: string) {
  await db.query(`
    UPDATE challenges
       SET starts_at = now() - interval '1 day',
           ends_at   = now() + interval '1 day'
     WHERE id = '${challenge}'`);
}

let campaignId: string;
let week1: string;
let week2: string;

/** A registered creator, with the handles they said they would publish from. */
async function makeCreator(platforms: string[] = ["x"]) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('Creator ${tag}', 'c${tag}@example.com', 'c${tag}@example.com',
            '080${tag}', '+2348${tag.padStart(9, "0")}', 'finance')
    RETURNING id`);

  for (const p of platforms) {
    await db.query(`
      INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
      VALUES ('${creator.id}', '${p}', 'h${tag}${p}', 'h${tag}${p}')`);
  }

  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}')
    RETURNING id`);

  return enrolment.id;
}

const submit = (enrolment: string, challenge: string, platform: string, url: string) =>
  db.query(
    `SELECT * FROM submit_entry('${enrolment}', '${challenge}', '${platform}', '${url}')`,
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
    DELETE FROM submissions; DELETE FROM challenge_entries;
    DELETE FROM creator_social_handles; DELETE FROM campaign_creators;
    DELETE FROM creators;
  `);
  const c = await one<{ id: string }>(
    `SELECT id FROM campaigns WHERE slug = 'monica-money-story'`,
  );
  campaignId = c.id;
  week1 = (
    await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    )
  ).id;
  week2 = (
    await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 2`,
    )
  ).id;
});

describe("the seeded challenges", () => {
  it("publishes all four stages", async () => {
    expect(
      await count(
        `SELECT count(*)::int AS n FROM challenges WHERE campaign_id = '${campaignId}'`,
      ),
    ).toBe(4);
  });

  it("starts week 1 on the day the campaign opens", async () => {
    const row = await one<{ starts_at: Date }>(
      `SELECT starts_at FROM challenges WHERE id = '${week1}'`,
    );
    const campaign = await one<{ starts_at: Date }>(
      `SELECT starts_at FROM campaigns WHERE id = '${campaignId}'`,
    );
    expect(new Date(row.starts_at).getTime()).toBe(
      new Date(campaign.starts_at).getTime(),
    );
  });

  it("runs the weeks back to back with no gap and no overlap", async () => {
    const gaps = await count(`
      SELECT count(*)::int AS n FROM (
        SELECT ends_at, lead(starts_at) OVER (ORDER BY week_no) AS next_start
          FROM challenges WHERE campaign_id = '${campaignId}'
      ) w
       WHERE next_start IS NOT NULL
         AND next_start <> ends_at + interval '1 second'`);
    expect(gaps).toBe(0);
  });

  it("is idempotent, so re-running the seed adds nothing", async () => {
    await db.exec(
      (await import("node:fs")).readFileSync(
        (await import("node:path")).join(
          process.cwd(),
          "netlify/database/migrations/0008_submissions.sql",
        ),
        "utf8",
      ),
    );
    expect(
      await count(
        `SELECT count(*)::int AS n FROM challenges WHERE campaign_id = '${campaignId}'`,
      ),
    ).toBe(4);
  });
});

describe("submitting", () => {
  beforeEach(async () => {
    await openNow(week1);
  });

  it("creates the entry on the first submission", async () => {
    const me = await makeCreator(["x"]);
    const res = await submit(me, week1, "x", "https://x.com/a/1");
    expect((res.rows[0] as { is_first_for_entry: boolean }).is_first_for_entry).toBe(
      true,
    );
    expect(
      await count(`SELECT count(*)::int AS n FROM challenge_entries`),
    ).toBe(1);
  });

  it("reuses that entry for a second platform", async () => {
    const me = await makeCreator(["x", "instagram"]);
    await submit(me, week1, "x", "https://x.com/a/2");
    const second = await submit(me, week1, "instagram", "https://instagram.com/a/2");

    expect(
      (second.rows[0] as { is_first_for_entry: boolean }).is_first_for_entry,
    ).toBe(false);
    expect(await count(`SELECT count(*)::int AS n FROM challenge_entries`)).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM submissions`)).toBe(2);
  });

  /**
   * The rates are frozen when the entry is created. If they were read at review
   * time, editing a rule mid-campaign would silently rewrite what people had
   * already been told they were playing for.
   */
  it("freezes the published ladder onto the entry", async () => {
    const me = await makeCreator(["x"]);
    await submit(me, week1, "x", "https://x.com/a/3");

    const e = await one<{
      base_points_snapshot: number;
      bonus_2_snapshot: number;
      bonus_3_snapshot: number;
    }>(`SELECT base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot
          FROM challenge_entries LIMIT 1`);

    expect(e.base_points_snapshot).toBe(monicaPointLadder[0].points);
    expect(e.base_points_snapshot + e.bonus_2_snapshot).toBe(
      monicaPointLadder[1].points,
    );
    expect(e.base_points_snapshot + e.bonus_3_snapshot).toBe(
      monicaPointLadder[2].points,
    );
  });

  it("does not move a snapshot when the rules change afterwards", async () => {
    const me = await makeCreator(["x"]);
    await submit(me, week1, "x", "https://x.com/a/4");
    await db.query(
      `UPDATE point_rules SET default_points = 999 WHERE campaign_id = '${campaignId}'`,
    );
    const e = await one<{ base_points_snapshot: number }>(
      `SELECT base_points_snapshot FROM challenge_entries LIMIT 1`,
    );
    expect(e.base_points_snapshot).toBe(monicaPointLadder[0].points);
  });

  it("starts every submission pending and unreviewed", async () => {
    const me = await makeCreator(["x"]);
    await submit(me, week1, "x", "https://x.com/a/5");
    expect(
      await count(
        `SELECT count(*)::int AS n FROM submissions
          WHERE status = 'pending' AND reviewed_at IS NULL AND reviewed_by_admin_id IS NULL`,
      ),
    ).toBe(1);
  });
});

describe("what it refuses", () => {
  beforeEach(async () => {
    await openNow(week1);
  });

  it("refuses a platform the creator never registered", async () => {
    // The rules say an entry has to come from an account listed at
    // registration, and nothing else can check that after the fact.
    const me = await makeCreator(["x"]);
    await expect(
      submit(me, week1, "tiktok", "https://tiktok.com/a/1"),
    ).rejects.toThrow(/platform_not_registered/);
  });

  it("refuses a second submission on the same platform", async () => {
    const me = await makeCreator(["x"]);
    await submit(me, week1, "x", "https://x.com/a/6");
    await expect(
      submit(me, week1, "x", "https://x.com/a/different"),
    ).rejects.toThrow(/already_submitted_for_platform/);
  });

  it("refuses a URL somebody else has already submitted", async () => {
    const a = await makeCreator(["x"]);
    const b = await makeCreator(["x"]);
    await submit(a, week1, "x", "https://x.com/shared/1");
    await expect(submit(b, week1, "x", "https://x.com/shared/1")).rejects.toThrow(
      /url_already_submitted/,
    );
  });

  it("releases a URL once the first submission is rejected", async () => {
    // The uniqueness index is partial on status. Otherwise the first person to
    // claim a public post owns it forever, even after being rejected.
    const a = await makeCreator(["x"]);
    const b = await makeCreator(["x"]);
    await submit(a, week1, "x", "https://x.com/released/1");
    await db.query(
      `UPDATE submissions SET status = 'rejected', reviewed_at = now()`,
    );
    await expect(
      submit(b, week1, "x", "https://x.com/released/1"),
    ).resolves.toBeTruthy();
  });

  it("refuses a challenge from another campaign", async () => {
    const other = await one<{ id: string }>(`
      INSERT INTO campaigns (slug, name, status) VALUES ('other', 'Other', 'active')
      RETURNING id`);
    const foreign = await one<{ id: string }>(`
      INSERT INTO challenges (campaign_id, title, description, week_no, starts_at, ends_at, base_points)
      VALUES ('${other.id}', 'X', 'Y', 1, now() - interval '1 day', now() + interval '1 day', 100)
      RETURNING id`);
    const me = await makeCreator(["x"]);
    await expect(
      submit(me, foreign.id, "x", "https://x.com/foreign/1"),
    ).rejects.toThrow(/unknown_challenge/);
  });

  it("refuses an unknown creator", async () => {
    await expect(
      submit(
        "00000000-0000-0000-0000-000000000000",
        week1,
        "x",
        "https://x.com/nobody/1",
      ),
    ).rejects.toThrow(/unknown_creator/);
  });

  it("refuses a plain http URL", async () => {
    const me = await makeCreator(["x"]);
    await expect(submit(me, week1, "x", "http://x.com/insecure")).rejects.toThrow();
  });
});

describe("the challenge window", () => {
  it("refuses a week that has not opened yet", async () => {
    // All four challenges are published at once, so the dates are what stop
    // somebody entering week four on day one.
    const me = await makeCreator(["x"]);
    await expect(submit(me, week2, "x", "https://x.com/early/1")).rejects.toThrow(
      /challenge_not_open/,
    );
  });

  it("refuses a week that has closed", async () => {
    const me = await makeCreator(["x"]);
    await db.query(
      `UPDATE challenges SET starts_at = now() - interval '30 days',
                             ends_at = now() - interval '20 days'
        WHERE id = '${week1}'`,
    );
    await expect(submit(me, week1, "x", "https://x.com/late/1")).rejects.toThrow(
      /challenge_ended/,
    );
  });

  it("refuses a challenge that was closed by hand", async () => {
    const me = await makeCreator(["x"]);
    await db.query(
      `UPDATE challenges SET status = 'closed' WHERE id = '${week1}'`,
    );
    await expect(submit(me, week1, "x", "https://x.com/closed/1")).rejects.toThrow(
      /challenge_closed/,
    );
  });
});
