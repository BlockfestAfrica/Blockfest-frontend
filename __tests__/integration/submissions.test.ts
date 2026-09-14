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
/**
 * Push a challenge into the future, relative to now.
 *
 * The fixture restores the four real production windows, which is right for
 * tests about the real schedule and wrong for tests about a window's state.
 * Four assertions here said "this week has not opened" and actually meant "21
 * September is in the future". From the night week 2 opens that stops being
 * true and they invert, and because netlify.toml runs the suite before the
 * build, no deploy of any kind publishes until somebody works out that the
 * tests did not break, the clock moved. Mid-campaign that is the pause switch
 * and every copy fix gone at once, on a 5,000,000 naira campaign.
 */
async function notOpenYet(challenge: string) {
  await db.query(`
    UPDATE challenges
       SET starts_at = now() + interval '1 day',
           ends_at   = now() + interval '8 days'
     WHERE id = '${challenge}'`);
}


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
      INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized, verified_at)
      VALUES ('${creator.id}', '${p}', 'h${tag}${p}', 'h${tag}${p}', now())`);
  }

  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}')
    RETURNING id`);

  return enrolment.id;
}

const submit = (
  enrolment: string,
  challenge: string,
  platform: string,
  url: string,
  allowBeforeOpen = false,
  author: string | null = null,
) =>
  db.query(
    `SELECT * FROM submit_entry('${enrolment}', '${challenge}', '${platform}', '${url}', ${allowBeforeOpen}, ${author === null ? "NULL" : `'${author}'`})`,
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

  // Challenges are seeded once and several tests move their windows or close
  // them. Without restoring, a test that closes week 1 changes the result of
  // every test that runs after it, and the failure appears in whichever test
  // happens to be next rather than in the one that caused it.
  //
  // These are the published windows, Monday to Saturday with the Sunday between
  // stages kept clear. They must stay identical to 0031_five_stages.sql: this
  // fixture overwrites whatever the migrations produced, so a fixture carrying
  // the old dates would quietly test a schedule the campaign does not run, and
  // the assertions about the shape of the calendar would fail against correct
  // migrations. That is exactly what happened when the stages changed.
  await db.exec(`
    UPDATE challenges SET status = 'active';
    UPDATE challenges SET starts_at = '2026-09-14 00:00:00+01',
                          ends_at   = '2026-09-19 23:59:59+01' WHERE week_no = 1;
    UPDATE challenges SET starts_at = '2026-09-21 00:00:00+01',
                          ends_at   = '2026-09-26 23:59:59+01' WHERE week_no = 2;
    UPDATE challenges SET starts_at = '2026-09-28 00:00:00+01',
                          ends_at   = '2026-10-03 23:59:59+01' WHERE week_no = 3;
    UPDATE challenges SET starts_at = '2026-10-05 00:00:00+01',
                          ends_at   = '2026-10-10 23:59:59+01' WHERE week_no = 4;
    UPDATE challenges SET starts_at = '2026-10-12 00:00:00+01',
                          ends_at   = '2026-10-17 23:59:59+01' WHERE week_no = 5;
  `);
  // The campaign's own clock is part of several fixtures now: the
  // pre-launch override only works before it. Reset it with the windows.
  await db.exec(
    `UPDATE campaigns SET starts_at = '2026-09-14 00:00:00+01'
      WHERE slug = 'monica-money-story'`,
  );
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
  it("publishes all five stages", async () => {
    expect(
      await count(
        `SELECT count(*)::int AS n FROM challenges WHERE campaign_id = '${campaignId}'`,
      ),
    ).toBe(5);
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

  /**
   * The gap is the design, not a mistake.
   *
   * Stages run Monday to Saturday and the Sunday between them is kept clear:
   * that is when the week's entries are reviewed and the weekly winners
   * announced, so a stage never ends on the day its own result is published.
   * The earlier shape ran Monday to Sunday back to back, which is why the site
   * said Saturday in one place and Sunday in another.
   *
   * Asserted as exactly one clear day, so a stage cannot quietly grow into the
   * Sunday or leave a second one nobody can submit in.
   */
  it("leaves exactly one clear day between stages", async () => {
    const wrong = await count(`
      SELECT count(*)::int AS n FROM (
        SELECT ends_at, lead(starts_at) OVER (ORDER BY week_no) AS next_start
          FROM challenges WHERE campaign_id = '${campaignId}'
      ) w
       WHERE next_start IS NOT NULL
         AND next_start <> ends_at + interval '1 day 1 second'`);
    expect(wrong).toBe(0);
  });

  it("closes every stage on a Saturday and opens the next on a Monday", async () => {
    // The days themselves, not just the spacing, because a uniform gap would
    // also be satisfied by the whole campaign sliding by a day.
    const offDays = await count(`
      SELECT count(*)::int AS n FROM challenges
       WHERE campaign_id = '${campaignId}'
         AND (extract(dow FROM ends_at AT TIME ZONE 'Africa/Lagos') <> 6
           OR extract(dow FROM starts_at AT TIME ZONE 'Africa/Lagos') <> 1)`);
    expect(offDays).toBe(0);
  });

  it("is idempotent, so re-running the seed adds nothing", async () => {
    // Only the seed is replayed, not the whole migration file. 0008 also
    // defines submit_entry, and 0010 replaced that with a different signature,
    // so re-running the file would resurrect the old function beside the new
    // one. Netlify applies each migration exactly once, so that never happens
    // in production, and a fixture that does it is testing something the
    // system does not do.
    const sql = (await import("node:fs")).readFileSync(
      (await import("node:path")).join(
        process.cwd(),
        "netlify/database/migrations/0008_submissions.sql",
      ),
      "utf8",
    );
    const seedOnly = sql.slice(0, sql.indexOf("CREATE OR REPLACE FUNCTION"));
    await db.exec(seedOnly);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM challenges WHERE campaign_id = '${campaignId}'`,
      ),
    ).toBe(5);
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

  it("refuses a URL somebody else has already been credited for", async () => {
    // The rule is about credit, not about claims. 0025 moved exclusivity onto
    // approval, because refusing the second CLAIM is what let anybody burn a
    // rival's post by filing it first.
    const a = await makeCreator(["x"]);
    const b = await makeCreator(["x"]);
    await submit(a, week1, "x", "https://x.com/shared/1");
    await db.query(
      `UPDATE submissions SET status = 'approved', reviewed_at = now()`,
    );
    await expect(submit(b, week1, "x", "https://x.com/shared/1")).rejects.toThrow(
      /url_already_submitted/,
    );
  });

  it("lets a second creator claim a post that is only pending", async () => {
    // The burn attack. Under the old rule the first filing held the post until
    // a reviewer looked, so a creator who saw a rival's post could file it and
    // cost them the week.
    const a = await makeCreator(["x"]);
    const b = await makeCreator(["x"]);
    await submit(a, week1, "x", "https://x.com/contested/1");
    await expect(
      submit(b, week1, "x", "https://x.com/contested/1"),
    ).resolves.toBeTruthy();
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
    await notOpenYet(week2);
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

/**
 * Walking the flow before the first week opens.
 *
 * Registration is forced open ahead of launch so the whole journey can be
 * tested. The challenge window is a separate gate, so without this nobody could
 * exercise submit, review and score until 14 September, which is the day all
 * three have to work.
 *
 * The override lifts exactly one check, and the asymmetry is the safety.
 */
describe("the pre-launch override", () => {
  it("allows a week that has not opened yet, while the campaign has not", async () => {
    await db.query(
      `UPDATE campaigns SET starts_at = now() + interval '2 days'
        WHERE id = '${campaignId}'`,
    );
    await notOpenYet(week2);
    const me = await makeCreator(["x"]);
    await expect(
      submit(me, week2, "x", "https://x.com/preview/1", true),
    ).resolves.toBeTruthy();
  });

  /**
   * The override dies with the launch. The env flag behind it outlived
   * 14 September, and every review Sunday, with no week open, the route
   * fell through to offering the NEXT week, which the old guard accepted:
   * entries filed into an unopened challenge a day early, every week.
   */
  it("is dead once the campaign has started", async () => {
    await notOpenYet(week2);
    const dead = await makeCreator(["x"]);
    await expect(
      submit(dead, week2, "x", "https://x.com/preview/3", true),
    ).rejects.toThrow(/challenge_not_open/);
  });

  it("still refuses that week without it", async () => {
    await db.query(
      `UPDATE campaigns SET starts_at = now() + interval '2 days'
        WHERE id = '${campaignId}'`,
    );
    await notOpenYet(week2);
    const me = await makeCreator(["x"]);
    await expect(
      submit(me, week2, "x", "https://x.com/preview/2", false),
    ).rejects.toThrow(/challenge_not_open/);
  });

  /**
   * Never overridden, and this is the point. Opening an upcoming week early
   * affects only the days before launch. Reopening a finished one would let an
   * entry be filed against a challenge that has already been scored, and in
   * week four against the one that decides the final leaderboard.
   */
  it("does not reopen a week that has ended", async () => {
    const me = await makeCreator(["x"]);
    await db.query(
      `UPDATE challenges SET starts_at = now() - interval '30 days',
                             ends_at = now() - interval '20 days'
        WHERE id = '${week1}'`,
    );
    await expect(
      submit(me, week1, "x", "https://x.com/reopen/1", true),
    ).rejects.toThrow(/challenge_ended/);
  });

  it("does not reopen a week that was closed by hand", async () => {
    const me = await makeCreator(["x"]);
    await db.query(`UPDATE challenges SET status = 'closed' WHERE id = '${week1}'`);
    await expect(
      submit(me, week1, "x", "https://x.com/reopen/2", true),
    ).rejects.toThrow(/challenge_closed/);
  });

  it("relaxes nothing else at all", async () => {
    // Every other refusal still applies with the override set.
    await db.query(
      `UPDATE campaigns SET starts_at = now() + interval '2 days'
        WHERE id = '${campaignId}'`,
    );
    await notOpenYet(week2);
    const me = await makeCreator(["x"]);
    await expect(
      submit(me, week2, "tiktok", "https://tiktok.com/x/1", true),
    ).rejects.toThrow(/platform_not_registered/);

    await submit(me, week2, "x", "https://x.com/dup/1", true);
    await expect(
      submit(me, week2, "x", "https://x.com/dup/2", true),
    ).rejects.toThrow(/already_submitted_for_platform/);
  });

  it("leaves only one submit_entry callable", async () => {
    expect(
      await count(
        `SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'submit_entry'`,
      ),
    ).toBe(1);
  });
});

/**
 * Submitting somebody else's post.
 *
 * The only ownership test used to be whether the creator had registered SOME
 * handle on that platform. It never asked whether that handle was the one in
 * the link, so anybody could register with any handle string, wait for a rival
 * to publish a strong post, and submit their URL. The reviewer saw a bare link,
 * opened a real on-brief post, and approved it.
 *
 * The author is read out of the URL by the server, never sent by the client.
 */
describe("attribution", () => {
  beforeEach(async () => {
    await openNow(week1);
  });

  it("accepts a post from the account the creator registered", async () => {
    const tag = seq + 1;
    const me = await makeCreator(["x"]);
    const handle = `h${tag}x`;
    await expect(
      submit(me, week1, "x", `https://x.com/${handle}/status/1`, false, handle),
    ).resolves.toBeTruthy();
  });

  it("refuses a post published by somebody else", async () => {
    const me = await makeCreator(["x"]);
    await expect(
      submit(
        me,
        week1,
        "x",
        "https://x.com/rivalcreator/status/99",
        false,
        "rivalcreator",
      ),
    ).rejects.toThrow(/wrong_account/);
  });

  it("compares without regard to case", async () => {
    const tag = seq + 1;
    const me = await makeCreator(["x"]);
    const handle = `h${tag}x`;
    await expect(
      submit(
        me,
        week1,
        "x",
        `https://x.com/${handle.toUpperCase()}/status/2`,
        false,
        handle.toUpperCase(),
      ),
    ).resolves.toBeTruthy();
  });

  /**
   * Instagram puts no author in the URL, so there is nothing to compare and the
   * server passes null. That must mean "nothing to compare", not "skip the
   * check", so the platform registration test still has to run.
   */
  it("still accepts a platform with no author in the link", async () => {
    const me = await makeCreator(["instagram"]);
    await expect(
      submit(me, week1, "instagram", "https://instagram.com/p/Cabc/", false, null),
    ).resolves.toBeTruthy();
  });

  it("still refuses an unregistered platform when there is no author", async () => {
    const me = await makeCreator(["x"]);
    await expect(
      submit(me, week1, "instagram", "https://instagram.com/p/Cxyz/", false, null),
    ).rejects.toThrow(/platform_not_registered/);
  });
});

/**
 * A rejected submission must not block that platform for the rest of the week.
 *
 * submission_one_per_platform was a plain unique index, so a creator whose
 * entry was rejected could never resubmit on that platform, even to fix exactly
 * what the reviewer asked them to fix. The URL index was made partial on status
 * in 0003 for the same reason; this half was missed.
 */
describe("resubmitting after a rejection", () => {
  beforeEach(async () => {
    await openNow(week1);
  });

  it("lets a creator try again on the same platform", async () => {
    const tag = seq + 1;
    const me = await makeCreator(["x"]);
    const handle = `h${tag}x`;
    await submit(me, week1, "x", `https://x.com/${handle}/status/10`, false, handle);
    await db.query(
      `UPDATE submissions SET status = 'rejected', reviewed_at = now()`,
    );
    await expect(
      submit(me, week1, "x", `https://x.com/${handle}/status/11`, false, handle),
    ).resolves.toBeTruthy();
  });

  it("still refuses a second live submission on that platform", async () => {
    const tag = seq + 1;
    const me = await makeCreator(["x"]);
    const handle = `h${tag}x`;
    await submit(me, week1, "x", `https://x.com/${handle}/status/12`, false, handle);
    await expect(
      submit(me, week1, "x", `https://x.com/${handle}/status/13`, false, handle),
    ).rejects.toThrow(/already_submitted_for_platform/);
  });
});

/**
 * Which collision the creator is told about.
 *
 * submit_entry catches unique_violation and picks between two messages. Both
 * indexes it is choosing between are partial on status <> 'rejected', so a
 * rejected row is not a collision. The test that matters is the one where a
 * rejected row exists AND the real collision is the URL: the handler used to
 * see the old rejected row and report the platform, sending the creator away
 * from the fix.
 */
describe("the message when a submission collides", () => {
  it("names the URL, not the platform, when a rejected row is lying around", async () => {
    await openNow(week1);
    const mine = await makeCreator(["x"]);
    const other = await makeCreator(["x"]);

    // Somebody else already holds this URL, credited. Approved rather than
    // merely pending, because 0025 made approval the exclusive state.
    await submit(other, week1, "x", "https://x.com/taken/1");
    await db.query(
      `UPDATE submissions SET status = 'approved', reviewed_at = now()`,
    );

    // I have a rejected entry on the same platform, which frees the slot.
    const first = await submit(mine, week1, "x", "https://x.com/mine/1");
    // Through review(), not by hand: submission_reviewed_consistently requires
    // the status and reviewed_at to move together, and a fixture that writes
    // one without the other is not the state production can reach.
    const admin = (
      await db.query<{ id: string }>(
        `SELECT id FROM admin_users ORDER BY created_at LIMIT 1`,
      )
    ).rows[0];
    await db.query(
      `SELECT review($1::uuid, 'rejected'::submission_status, $2::uuid, 'Not your account')`,
      [(first.rows[0] as { submission_id: string }).submission_id, admin.id],
    );

    // Now collide on the URL. The platform is genuinely free.
    await expect(
      submit(mine, week1, "x", "https://x.com/taken/1"),
    ).rejects.toThrow(/url_already_submitted/);
  });

  it("still names the platform when the platform really is taken", async () => {
    await openNow(week1);
    const mine = await makeCreator(["x"]);

    await submit(mine, week1, "x", "https://x.com/mine/a");
    await expect(
      submit(mine, week1, "x", "https://x.com/mine/b"),
    ).rejects.toThrow(/already_submitted_for_platform/);
  });
});

/**
 * Re-deciding a submission the creator has already replaced.
 *
 * A rejected submission frees its platform, which is what 0011 exists for and
 * what the rejection note tells the creator to do. So a reviewer who decides
 * their rejection was wrong, and approves the old one, collides with the
 * replacement. Before this it was an unmapped unique_violation: the most
 * sympathetic case in the queue getting the least useful error.
 */
describe("re-deciding a superseded submission", () => {
  it("is refused by name rather than as a constraint violation", async () => {
    await openNow(week1);
    const me = await makeCreator(["x"]);
    const admin = (
      await db.query<{ id: string }>(
        `SELECT id FROM admin_users ORDER BY created_at LIMIT 1`,
      )
    ).rows[0];

    const first = await submit(me, week1, "x", "https://x.com/first/1");
    const firstId = (first.rows[0] as { submission_id: string }).submission_id;

    await db.query(
      `SELECT review($1::uuid, 'rejected'::submission_status, $2::uuid, 'Not your account')`,
      [firstId, admin.id],
    );

    // The creator does exactly what the note told them to.
    await submit(me, week1, "x", "https://x.com/second/1");

    // The reviewer changes their mind about the first one.
    await expect(
      db.query(
        `SELECT review($1::uuid, 'approved'::submission_status, $2::uuid, NULL)`,
        [firstId, admin.id],
      ),
    ).rejects.toThrow(/superseded_by_newer_submission/);
  });

  it("still lets an ordinary decision through", async () => {
    await openNow(week1);
    const me = await makeCreator(["x"]);
    const admin = (
      await db.query<{ id: string }>(
        `SELECT id FROM admin_users ORDER BY created_at LIMIT 1`,
      )
    ).rows[0];

    const only = await submit(me, week1, "x", "https://x.com/only/1");
    await expect(
      db.query(
        `SELECT review($1::uuid, 'approved'::submission_status, $2::uuid, NULL)`,
        [(only.rows[0] as { submission_id: string }).submission_id, admin.id],
      ),
    ).resolves.toBeTruthy();
  });
});
