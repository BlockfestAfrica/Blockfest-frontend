/**
 * The request half of the mistyped-handle fix, against a real Postgres.
 *
 * The owner's requirement, stated as behaviour: a creator filing a request
 * changes NOTHING about their registration, an admin sees the request and the
 * creator's own reason, and the handle moves only on a hand approval, through
 * the same audited function a direct fix uses. The first and last of those are
 * the ones worth proving hardest, because each is one careless refactor away
 * from a self-service handle editor.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T> =>
  (await db.query<T>(sql, p)).rows[0];

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

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

const file = (
  enrolment: string,
  newHandle: string,
  reason = "I typed it wrong when I registered",
) =>
  db.query(
    `SELECT * FROM request_handle_change($1::uuid, 'x'::platform, $2::text, $3::text)`,
    [enrolment, newHandle, reason],
  );

const decide = (
  request: string,
  approve: boolean,
  note = "",
  admin: string | null = adminId,
) =>
  db.query(
    `SELECT * FROM decide_handle_request($1::uuid, $2::uuid, $3::boolean, $4::text)`,
    [request, admin, approve, note],
  );

const pendingId = async (enrolment: string) =>
  (
    await one<{ id: string }>(
      `SELECT id FROM handle_change_requests
        WHERE campaign_creator_id = '${enrolment}' AND status = 'pending'`,
    )
  ).id;

const handleOf = async (enrolment: string) =>
  one<{ handle: string; handle_normalized: string }>(`
    SELECT h.handle, h.handle_normalized
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
    DELETE FROM audit_log; DELETE FROM handle_change_requests;
    DELETE FROM referrals; DELETE FROM point_ledger;
    DELETE FROM submissions; DELETE FROM challenge_entries;
    DELETE FROM creator_social_handles; DELETE FROM campaign_creators;
    DELETE FROM creators;
  `);
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)).id;
  adminId = (await one<{ id: string }>(`SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`)).id;
});

describe("filing a request", () => {
  it("changes nothing about the registration", async () => {
    // The requirement that keeps this from being a self-service editor.
    const me = await enrolWith("amaraa");
    await file(me, "amara");

    const row = await handleOf(me);
    expect(row.handle, "untouched until a person approves").toBe("amaraa");
  });

  it("records what the admin will judge: both handles and the creator's words", async () => {
    const me = await enrolWith("amaraa");
    await file(me, "@Amara", "The a key stuck");

    const request = await one<{ old_handle: string; requested_handle: string; reason: string }>(
      `SELECT old_handle, requested_handle, reason FROM handle_change_requests`,
    );
    expect(request.old_handle).toBe("amaraa");
    expect(request.requested_handle, "normalised like registration").toBe("amara");
    expect(request.reason).toBe("The a key stuck");
  });

  it("replaces a pending request rather than stacking a second", async () => {
    const me = await enrolWith("amaraa");
    await file(me, "amara", "first try");
    await file(me, "amara_", "no wait, underscore");

    expect(await count(`SELECT count(*)::int AS n FROM handle_change_requests`)).toBe(1);
    const request = await one<{ requested_handle: string; reason: string }>(
      `SELECT requested_handle, reason FROM handle_change_requests`,
    );
    expect(request.requested_handle).toBe("amara_");
    expect(request.reason).toBe("no wait, underscore");
  });

  it("refuses a blank reason, a bad shape, an unchanged handle, and a voided creator", async () => {
    const me = await enrolWith("amaraa");
    await expect(file(me, "amara", "  ")).rejects.toThrow(/reason_required/);
    await expect(file(me, "has space")).rejects.toThrow(/handle_invalid/);
    await expect(file(me, "amaraa")).rejects.toThrow(/handle_unchanged/);

    await db.query(`SELECT void_enrolment($1::uuid, $2::uuid, 'Bought engagement')`, [me, adminId]);
    await expect(file(me, "amara")).rejects.toThrow(/enrolment_not_active/);
  });
});

describe("approving", () => {
  it("moves the handle, both columns, through the audited path", async () => {
    const me = await enrolWith("amaraa");
    await file(me, "amara");
    await decide(await pendingId(me), true);

    const row = await handleOf(me);
    expect(row.handle).toBe("amara");
    expect(row.handle_normalized).toBe("amara");

    // The same audit trail as a direct fix, joined to the request by id.
    expect(
      await count(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'handle.corrected'`),
    ).toBe(1);
    const audit = await one<{ note: string }>(
      `SELECT note FROM audit_log WHERE action = 'handle.corrected'`,
    );
    expect(audit.note).toContain("Approved request");
    expect(audit.note).toContain("I typed it wrong");
  });

  it("marks the request approved, by whom, when", async () => {
    const me = await enrolWith("amaraa");
    await file(me, "amara");
    await decide(await pendingId(me), true);

    const request = await one<{ status: string; decided_by_admin_id: string; decided_at: string }>(
      `SELECT status, decided_by_admin_id, decided_at FROM handle_change_requests`,
    );
    expect(request.status).toBe("approved");
    expect(request.decided_by_admin_id).toBe(adminId);
    expect(request.decided_at).not.toBeNull();
  });
});

describe("rejecting", () => {
  it("changes nothing, and carries a note for the creator", async () => {
    const me = await enrolWith("amaraa");
    await file(me, "amara");
    await decide(await pendingId(me), false, "That account belongs to somebody else");

    expect((await handleOf(me)).handle).toBe("amaraa");
    const request = await one<{ status: string; decision_note: string }>(
      `SELECT status, decision_note FROM handle_change_requests`,
    );
    expect(request.status).toBe("rejected");
    expect(request.decision_note).toBe("That account belongs to somebody else");
  });

  it("refuses a rejection with nothing to say", async () => {
    // The note is what the creator reads on their own page.
    const me = await enrolWith("amaraa");
    await file(me, "amara");
    await expect(decide(await pendingId(me), false, "")).rejects.toThrow(/note_required/);
  });

  it("lets the creator file again after a rejection", async () => {
    const me = await enrolWith("amaraa");
    await file(me, "amara");
    await decide(await pendingId(me), false, "Check the spelling and try again");
    await expect(file(me, "amara_ng", "It is actually this one")).resolves.toBeTruthy();
  });
});

describe("the race two admins can run", () => {
  it("tells the second decider rather than double-applying", async () => {
    const me = await enrolWith("amaraa");
    await file(me, "amara");
    const request = await pendingId(me);

    await decide(request, true);
    await expect(decide(request, false, "changed my mind")).rejects.toThrow(
      /request_already_decided/,
    );
  });

  it("refuses a decision with no admin", async () => {
    const me = await enrolWith("amaraa");
    await file(me, "amara");
    await expect(decide(await pendingId(me), true, "", null)).rejects.toThrow(/admin_required/);
  });
});

describe("a handle change cannot take somebody else's handle", () => {
  it("refuses at filing time, so the queue never fills with the ungrantable", async () => {
    const victim = await enrolWith("bigcreator");
    const squatter = await enrolWith("nobody");
    void victim;

    await expect(file(squatter, "bigcreator")).rejects.toThrow(/handle_taken/);
  });

  it("refuses the approval too, which is the check that binds", async () => {
    // Filed while the handle was free, approved after somebody took it:
    // the guard lives in correct_social_handle because that is the one
    // statement every change passes through.
    const squatter = await enrolWith("nobody2");
    await file(squatter, "laterclaimed");
    const request = await one<{ id: string }>(
      `SELECT id FROM handle_change_requests WHERE campaign_creator_id = '${squatter}'`,
    );
    await enrolWith("laterclaimed");

    await expect(
      decide(request.id, true, "", adminId, "laterclaimed"),
    ).rejects.toThrow(/handle_taken/);
  });

  it("still lets a creator correct their own typo", async () => {
    const me = await enrolWith("mytpyo");
    await file(me, "mytypo");
    const request = await one<{ id: string }>(
      `SELECT id FROM handle_change_requests WHERE campaign_creator_id = '${me}'`,
    );
    await expect(
      decide(request.id, true, "", adminId, "mytypo"),
    ).resolves.toBeTruthy();
  });
});
