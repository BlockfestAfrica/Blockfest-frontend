/**
 * Correcting a registered handle, against a real Postgres.
 *
 * This replaces a manual UPDATE against production, whose likely failure was
 * specific: handle changed, handle_normalized forgotten, after which the
 * wrong_account check compares against the stale normalised value and refuses
 * the RIGHT account forever. The two columns moving together is the whole
 * point of the function, so it is the first thing proved.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;
let week1: string;

const one = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T> =>
  (await db.query<T>(sql, p)).rows[0];

async function enrolWith(handle: string) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}')
    RETURNING id`);
  await db.query(
    `INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
     VALUES ($1, 'x', $2, lower($2))`,
    [creator.id, handle],
  );
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return enrolment.id;
}

const correct = (
  enrolment: string,
  newHandle: string,
  reason: string | null = "They wrote in from their registered email",
  admin: string | null = adminId,
  platform = "x",
) =>
  db.query(
    `SELECT * FROM correct_social_handle($1::uuid, $2::platform, $3::text, $4::uuid, $5::text)`,
    [enrolment, platform, newHandle, admin, reason],
  );

const handleRow = async (enrolment: string) =>
  one<{ handle: string; handle_normalized: string; verified_at: string | null; verification_code: string }>(`
    SELECT h.handle, h.handle_normalized, h.verified_at, h.verification_code
      FROM creator_social_handles h
      JOIN campaign_creators cc ON cc.creator_id = h.creator_id
     WHERE cc.id = '${enrolment}'`);

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
  adminId = (await one<{ id: string }>(`SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`)).id;
  week1 = (await one<{ id: string }>(`SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`)).id;
});

describe("correcting", () => {
  it("moves handle and handle_normalized together", async () => {
    const me = await enrolWith("amaraa");
    await correct(me, "amara");

    const row = await handleRow(me);
    expect(row.handle).toBe("amara");
    expect(row.handle_normalized, "the column a manual edit forgets").toBe("amara");
  });

  it("accepts the @ people naturally type, and normalises case", async () => {
    const me = await enrolWith("amaraa");
    await correct(me, "@Amara");
    expect((await handleRow(me)).handle).toBe("amara");
  });

  it("reports what changed", async () => {
    const me = await enrolWith("amaraa");
    const { rows } = await correct(me, "amara");
    expect(rows[0]).toMatchObject({ old_handle: "amaraa", new_handle: "amara" });
  });

  it("writes an audit row carrying both values and the reason", async () => {
    const me = await enrolWith("amaraa");
    await correct(me, "amara", "Creator wrote in");

    const audit = await one<{ after: { from: string; to: string }; note: string }>(`
      SELECT after, note FROM audit_log WHERE action = 'handle.corrected'`);
    expect(audit.after.from).toBe("amaraa");
    expect(audit.after.to).toBe("amara");
    expect(audit.note).toBe("Creator wrote in");
  });

  it("clears the verification state that belonged to the old handle", async () => {
    // Enforcement is off since 0034, but a verified_at standing against a
    // handle nobody proved would make the column lie to whoever turns it back
    // on. The code is reminted for the same reason.
    const me = await enrolWith("amaraa");
    await db.query(`UPDATE creator_social_handles SET verified_at = now()`);
    const before = (await handleRow(me)).verification_code;

    await correct(me, "amara");
    const row = await handleRow(me);
    expect(row.verified_at).toBeNull();
    expect(row.verification_code).not.toBe(before);
    expect(row.verification_code).toMatch(/^BF-[0-9A-F]{6}$/);
  });

  /**
   * The end-to-end that is the whole reason this exists: after the correction,
   * the submission that was being refused goes through.
   */
  it("unblocks the creator whose registration had the typo", async () => {
    const me = await enrolWith("amaraa");

    // Refused: the post is from @amara, the registration says @amaraa.
    await expect(
      db.query(
        `SELECT * FROM submit_entry($1::uuid, $2::uuid, 'x'::platform, $3::text, true, $4::text)`,
        [me, week1, "https://x.com/amara/status/1", "amara"],
      ),
    ).rejects.toThrow(/wrong_account/);

    await correct(me, "amara");

    await expect(
      db.query(
        `SELECT * FROM submit_entry($1::uuid, $2::uuid, 'x'::platform, $3::text, true, $4::text)`,
        [me, week1, "https://x.com/amara/status/1", "amara"],
      ),
    ).resolves.toBeTruthy();
  });
});

describe("what it refuses", () => {
  it("a missing reason", async () => {
    const me = await enrolWith("amaraa");
    await expect(correct(me, "amara", "   ")).rejects.toThrow(/reason_required/);
    expect((await handleRow(me)).handle, "unchanged").toBe("amaraa");
  });

  it("a missing admin", async () => {
    const me = await enrolWith("amaraa");
    await expect(correct(me, "amara", "why", null)).rejects.toThrow(/admin_required/);
  });

  it("a handle registration itself would refuse", async () => {
    const me = await enrolWith("amaraa");
    for (const bad of ["has space", "way".repeat(20), "névé", ""]) {
      await expect(correct(me, bad), bad).rejects.toThrow(/handle_invalid/);
    }
  });

  it("a platform the creator never registered", async () => {
    const me = await enrolWith("amaraa");
    await expect(
      correct(me, "amara", "why", adminId, "tiktok"),
    ).rejects.toThrow(/handle_not_found/);
  });

  it("an enrolment that does not exist", async () => {
    await expect(
      correct("00000000-0000-0000-0000-000000000000", "amara"),
    ).rejects.toThrow(/unknown_creator/);
  });
});
