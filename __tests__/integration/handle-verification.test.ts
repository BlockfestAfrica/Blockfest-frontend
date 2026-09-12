/**
 * Proving a handle belongs to the person claiming it.
 *
 * Registration accepts any string matching a handle pattern, and the handle is
 * not decoration: submission intake resolves a pasted URL back to an enrolment
 * through this table, so whoever holds the row collects the points for whatever
 * that account publishes. On a 5,000,000 naira pool that is the cheapest fraud
 * available.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

const SLUG = "monica-money-story";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

/** A creator claiming a handle, exactly as registration leaves them. */
async function claim(handle: string, platform = "x") {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  const row = await one<{ id: string }>(`
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
    VALUES ('${creator.id}', '${platform}', '${handle}', lower('${handle}'))
    RETURNING id`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return { creatorId: creator.id, handleId: row.id, enrolmentId: enrolment.id };
}

const verify = (handleId: string, admin: string | null = adminId) =>
  db.query(`SELECT * FROM verify_social_handle($1::uuid, $2::uuid)`, [
    handleId,
    admin,
  ]);

/** A pending submission on x for a creator, ready to be reviewed. */
async function submissionFor(enrolmentId: string, url: string) {
  const week1 = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
  );
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolmentId}', '${week1.id}', 100, 100, 200) RETURNING id`);
  return (
    await one<{ id: string }>(`
      INSERT INTO submissions (entry_id, platform, url)
      VALUES ('${entry.id}', 'x', '${url}') RETURNING id`)
  ).id;
}

const decide = (submissionId: string, status: string) =>
  db.query(
    `SELECT review($1::uuid, $2::submission_status, $3::uuid, 'note')`,
    [submissionId, status, adminId],
  );

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  campaignId = (
    await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = '${SLUG}'`)
  ).id;
  adminId = (
    await one<{ id: string }>(
      `SELECT id FROM admin_users WHERE role = 'owner' ORDER BY email_canonical LIMIT 1`,
    )
  ).id;
  await db.query(`SELECT purge_campaign_data($1, $1)`, [SLUG]);
});

describe("claiming, before anybody has checked", () => {
  it("gives every handle a code to publish", async () => {
    const { handleId } = await claim("ada");
    const row = await one<{ verification_code: string }>(
      `SELECT verification_code FROM creator_social_handles WHERE id = '${handleId}'`,
    );
    expect(row.verification_code).toMatch(/^BF-[0-9A-F]{6}$/);
  });

  it("never marks a claim verified on its own", async () => {
    // Registration cannot check anything, so it must not be able to write the
    // column that says somebody did.
    const { handleId } = await claim("ada");
    expect(
      await count(
        `SELECT count(*)::int AS n FROM creator_social_handles
          WHERE id = '${handleId}' AND verified_at IS NULL`,
      ),
    ).toBe(1);
  });

  /** The acceptance criterion from the issue, and the reason for the design. */
  it("lets two creators claim the same handle, and only one ever verify it", async () => {
    const first = await claim("contested");
    const second = await claim("contested");

    await expect(verify(first.handleId)).resolves.toBeTruthy();
    await expect(verify(second.handleId)).rejects.toThrow(
      /handle_already_verified_elsewhere/,
    );
  });
});

describe("verifying", () => {
  it("is attributed and logged", async () => {
    const { handleId } = await claim("ada");
    await verify(handleId);

    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log
          WHERE action = 'handle.verified' AND actor_admin_id = '${adminId}'`,
      ),
    ).toBe(1);
  });

  it("refuses without an admin, so it can never happen by itself", async () => {
    const { handleId } = await claim("ada");
    await expect(verify(handleId, null)).rejects.toThrow(/admin_required/);
  });

  it("does not log a second act of checking when run twice", async () => {
    // Idempotent, but not pretending somebody looked twice.
    const { handleId } = await claim("ada");
    await verify(handleId);
    await verify(handleId);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'handle.verified'`,
      ),
    ).toBe(1);
  });

  it("refuses a handle that does not exist", async () => {
    await expect(
      verify("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(/handle_not_found/);
  });
});

describe("approving through a handle nobody has checked", () => {
  /** The acceptance criterion, and the whole reason any of this exists. */
  it("is refused", async () => {
    const { enrolmentId } = await claim("ada");
    const submission = await submissionFor(enrolmentId, "https://x.com/ada/1");

    await expect(decide(submission, "approved")).rejects.toThrow(
      /handle_not_verified/,
    );
  });

  it("mints no points when it is refused", async () => {
    const { enrolmentId } = await claim("ada");
    const submission = await submissionFor(enrolmentId, "https://x.com/ada/2");
    await expect(decide(submission, "approved")).rejects.toThrow();

    expect(
      await count(
        `SELECT count(*)::int AS n FROM point_ledger
          WHERE campaign_creator_id = '${enrolmentId}'`,
      ),
    ).toBe(0);
  });

  it("allows the approval once the handle is verified", async () => {
    const { handleId, enrolmentId } = await claim("ada");
    const submission = await submissionFor(enrolmentId, "https://x.com/ada/3");

    await verify(handleId);
    await expect(decide(submission, "approved")).resolves.toBeTruthy();

    expect(
      Number(
        (
          await one<{ points_total: number }>(
            `SELECT points_total FROM campaign_creators WHERE id = '${enrolmentId}'`,
          )
        ).points_total,
      ),
    ).toBe(100);
  });

  /**
   * Rejection stays open on purpose. A reviewer looking at something wrong must
   * never be blocked from saying so, and a rejection pays nobody.
   */
  it("still allows a rejection, which pays nobody", async () => {
    const { enrolmentId } = await claim("ada");
    const submission = await submissionFor(enrolmentId, "https://x.com/ada/4");
    await expect(decide(submission, "rejected")).resolves.toBeTruthy();
  });
});

describe("taking a claim back", () => {
  it("releases the handle for the person who actually owns it", async () => {
    const squatter = await claim("realcreator");
    await verify(squatter.handleId);

    // The real owner registers later and cannot verify, which is the state the
    // partial index leaves them in.
    const owner = await claim("realcreator");
    await expect(verify(owner.handleId)).rejects.toThrow(
      /handle_already_verified_elsewhere/,
    );

    await db.query(`SELECT void_enrolment($1::uuid, $2::uuid, $3::text)`, [
      squatter.enrolmentId,
      adminId,
      "Claimed a handle they do not control",
    ]);

    await expect(verify(owner.handleId)).resolves.toBeTruthy();
  });

  it("takes the voided creator off the board", async () => {
    const { enrolmentId } = await claim("ada");
    await db.query(`SELECT void_enrolment($1::uuid, $2::uuid, $3::text)`, [
      enrolmentId,
      adminId,
      "Duplicate account",
    ]);
    const row = await one<{ status: string }>(
      `SELECT status FROM campaign_creators WHERE id = '${enrolmentId}'`,
    );
    expect(row.status).toBe("disqualified");
  });

  it("needs a reason, like every other action that takes something away", async () => {
    const { enrolmentId } = await claim("ada");
    await expect(
      db.query(`SELECT void_enrolment($1::uuid, $2::uuid, $3::text)`, [
        enrolmentId,
        adminId,
        "  ",
      ]),
    ).rejects.toThrow(/reason_required/);
  });

  it("is logged with the reason", async () => {
    const { enrolmentId } = await claim("ada");
    await db.query(`SELECT void_enrolment($1::uuid, $2::uuid, $3::text)`, [
      enrolmentId,
      adminId,
      "Claimed a handle they do not control",
    ]);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log
          WHERE action = 'enrolment.voided'
            AND note = 'Claimed a handle they do not control'`,
      ),
    ).toBe(1);
  });
});
