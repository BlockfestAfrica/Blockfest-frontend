/**
 * Adding a platform after registration.
 *
 * All three handles are optional at registration, so somebody who only had X
 * that day registered X alone. The ladder pays more for the same piece posted
 * on two or three platforms, and until now there was no way back: submit_entry
 * raises platform_not_registered with no handle row, and request_handle_change
 * raises handle_not_found because there is nothing to change. Two correct
 * refusals describing a dead end.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

async function creatorWithX() {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  await db.query(`
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
    VALUES ('${creator.id}', 'x', 'only${tag}', 'only${tag}')`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'ADD${tag}') RETURNING id`);
  return { creatorId: creator.id, enrolmentId: enrolment.id, tag };
}

const add = (enrolment: string, platform: string, handle: string) =>
  db.query(`SELECT * FROM add_social_handle('${enrolment}', '${platform}', '${handle}')`);

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
  campaignId = (
    await one<{ id: string }>(
      `SELECT id FROM campaigns WHERE slug = 'monica-money-story'`,
    )
  ).id;
});

describe("adding a platform", () => {
  it("lets a creator who registered with X alone add Instagram", async () => {
    const me = await creatorWithX();
    await add(me.enrolmentId, "instagram", "my.insta");

    const rows = await db.query<{ platform: string; handle: string }>(
      `SELECT platform, handle FROM creator_social_handles
        WHERE creator_id = '${me.creatorId}' ORDER BY platform`,
    );
    expect(rows.rows.map((r) => r.platform).sort()).toEqual(["instagram", "x"]);
  });

  it("unblocks submitting on that platform, which is the whole point", async () => {
    const me = await creatorWithX();
    const challenge = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    );

    // Before: the dead end.
    await expect(
      db.query(
        `SELECT * FROM submit_entry('${me.enrolmentId}', '${challenge.id}', 'instagram', 'https://www.instagram.com/p/AAA1/', true, '')`,
      ),
    ).rejects.toThrow(/platform_not_registered/);

    await add(me.enrolmentId, "instagram", "my.insta");

    await expect(
      db.query(
        `SELECT * FROM submit_entry('${me.enrolmentId}', '${challenge.id}', 'instagram', 'https://www.instagram.com/p/AAA1/', true, '')`,
      ),
    ).resolves.toBeTruthy();
  });

  it("takes the @ people type", async () => {
    const me = await creatorWithX();
    await add(me.enrolmentId, "tiktok", "@My.Handle");
    const row = await one<{ handle: string }>(
      `SELECT handle FROM creator_social_handles
        WHERE creator_id = '${me.creatorId}' AND platform = 'tiktok'`,
    );
    expect(row.handle).toBe("my.handle");
  });

  it("refuses a platform they already have, which is the change flow's job", async () => {
    const me = await creatorWithX();
    await expect(add(me.enrolmentId, "x", "someoneelse")).rejects.toThrow(
      /handle_already_set/,
    );
  });

  it("refuses a handle another active creator already holds", async () => {
    const mine = await creatorWithX();
    const theirs = await creatorWithX();
    await add(theirs.enrolmentId, "instagram", "contested");

    await expect(add(mine.enrolmentId, "instagram", "contested")).rejects.toThrow(
      /handle_taken/,
    );
  });

  it("does not let a disqualified creator gain a new way to submit", async () => {
    const me = await creatorWithX();
    await db.query(
      `UPDATE campaign_creators SET status = 'disqualified' WHERE id = '${me.enrolmentId}'`,
    );
    await expect(add(me.enrolmentId, "tiktok", "late")).rejects.toThrow(
      /enrolment_not_active/,
    );
  });

  it("refuses a handle that is not a handle", async () => {
    const me = await creatorWithX();
    for (const bad of ["", "   ", "has space", "way-too-long".repeat(10)]) {
      await expect(add(me.enrolmentId, "tiktok", bad)).rejects.toThrow(
        /handle_invalid/,
      );
    }
  });

  it("lands unverified, so it grants no trust registration would not have", async () => {
    const me = await creatorWithX();
    await add(me.enrolmentId, "instagram", "fresh");
    const row = await one<{ verified_at: string | null }>(
      `SELECT verified_at FROM creator_social_handles
        WHERE creator_id = '${me.creatorId}' AND platform = 'instagram'`,
    );
    expect(row.verified_at).toBeNull();
  });

  it("records who added what, with no admin named", async () => {
    const me = await creatorWithX();
    await add(me.enrolmentId, "instagram", "traceable");
    const row = await one<{ action: string; actor_admin_id: string | null; after: Record<string, unknown> }>(
      `SELECT action, actor_admin_id, after FROM audit_log WHERE action = 'handle.added'`,
    );
    expect(row.action).toBe("handle.added");
    expect(row.actor_admin_id, "the creator did this, not the team").toBeNull();
    expect(row.after.platform).toBe("instagram");
    expect(row.after.handle).toBe("traceable");
  });

  it("still enforces wrong_account, so a borrowed handle claims nothing", async () => {
    const me = await creatorWithX();
    const challenge = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    );
    await add(me.enrolmentId, "tiktok", "notmine");

    await expect(
      db.query(
        `SELECT * FROM submit_entry('${me.enrolmentId}', '${challenge.id}', 'tiktok', 'https://www.tiktok.com/@somebodyelse/video/12345', true, 'somebodyelse')`,
      ),
    ).rejects.toThrow(/wrong_account/);
  });
});
