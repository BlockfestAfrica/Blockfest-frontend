/**
 * A creator taking back their own pending submission.
 *
 * The receipt mail has always told them to send the right one instead if
 * the link was wrong, and the partial unique index refused a second
 * submission on that platform while the first sat pending, so the advice
 * could not be followed. It is also the answer to somebody else getting
 * hold of a personal link and submitting on their behalf: the engine
 * already refuses a post that is not from the registered handle, and a
 * human reviews everything, but the creator had no way to undo it.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let campaignId: string;
let adminId: string;
let week1: string;
let seq = 0;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

async function creatorWithSubmission(url: string) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'w${tag}@e.com', 'w${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'WD${tag}') RETURNING id`);
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolment.id}', '${week1}', 100, 50, 100)
    ON CONFLICT (campaign_creator_id, challenge_id) DO UPDATE SET updated_at = now()
    RETURNING id`);
  const sub = await one<{ id: string }>(`
    INSERT INTO submissions (entry_id, platform, url)
    VALUES ('${entry.id}', 'x', '${url}') RETURNING id`);
  return { enrolment: enrolment.id, submission: sub.id, entry: entry.id };
}

const withdraw = (enrolment: string, submission: string) =>
  db.query(`SELECT * FROM withdraw_submission($1::uuid, $2::uuid)`, [
    enrolment,
    submission,
  ]);

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
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
  week1 = (
    await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    )
  ).id;
  await db.query(`SELECT purge_campaign_data($1, $1)`, ["monica-money-story"]);
});

describe("taking back a pending submission", () => {
  it("removes it and frees the platform for the week", async () => {
    const me = await creatorWithSubmission("https://x.com/me/status/1");
    await withdraw(me.enrolment, me.submission);

    expect(await count(`SELECT count(*)::int AS n FROM submissions`)).toBe(0);

    // The point of it: the same platform accepts a new submission, which
    // the partial unique index refused while the first one was pending.
    await expect(
      db.query(
        `INSERT INTO submissions (entry_id, platform, url)
         VALUES ('${me.entry}', 'x', 'https://x.com/me/status/2')`,
      ),
    ).resolves.toBeTruthy();
  });

  it("leaves a trace with no admin on it, because no admin did it", async () => {
    const me = await creatorWithSubmission("https://x.com/me/status/3");
    await withdraw(me.enrolment, me.submission);

    const row = await one<{
      actor_admin_id: string | null;
      before: { url: string };
    }>(
      `SELECT actor_admin_id, before FROM audit_log WHERE action = 'submission.withdrawn'`,
    );
    expect(row.actor_admin_id).toBeNull();
    expect(row.before.url).toBe("https://x.com/me/status/3");
  });

  it("refuses somebody else's submission, without saying whether it exists", async () => {
    const mine = await creatorWithSubmission("https://x.com/me/status/4");
    const theirs = await creatorWithSubmission("https://x.com/them/status/5");

    await expect(
      withdraw(mine.enrolment, theirs.submission),
    ).rejects.toThrow(/submission_not_found/);
    expect(await count(`SELECT count(*)::int AS n FROM submissions`)).toBe(2);
  });

  it("refuses one a reviewer has already ruled on", async () => {
    const me = await creatorWithSubmission("https://x.com/me/status/6");
    await db.query(
      `SELECT review('${me.submission}', 'approved', '${adminId}', NULL)`,
    );

    await expect(withdraw(me.enrolment, me.submission)).rejects.toThrow(
      /already_reviewed/,
    );
    expect(await count(`SELECT count(*)::int AS n FROM submissions`)).toBe(1);
  });

  it("refuses a rejected one too, since that is a recorded judgement", async () => {
    const me = await creatorWithSubmission("https://x.com/me/status/7");
    await db.query(
      `SELECT review('${me.submission}', 'rejected', '${adminId}', 'Wrong account')`,
    );

    await expect(withdraw(me.enrolment, me.submission)).rejects.toThrow(
      /already_reviewed/,
    );
  });
});
