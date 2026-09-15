/**
 * The audit trail's newest rows, against real Postgres.
 *
 * The coverage sweep behind the console's audit page found four actions with
 * no trail, and one of them was the approval that mints the points a
 * 5,000,000 naira pool is split by. These recreate each gap and assert the
 * row lands in the same transaction as the act, with the actor on it.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;
let week1: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

async function makeCreator() {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  await db.query(`
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized, verified_at)
    VALUES ('${creator.id}', 'x', 'h${tag}', 'h${tag}', now())`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return enrolment.id;
}

async function pendingSubmission(enrolment: string, url: string) {
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolment}', '${week1}', 100, 50, 100)
    ON CONFLICT (campaign_creator_id, challenge_id) DO UPDATE SET updated_at = now()
    RETURNING id`);
  const sub = await one<{ id: string }>(`
    INSERT INTO submissions (entry_id, platform, url)
    VALUES ('${entry.id}', 'x', '${url}') RETURNING id`);
  return sub.id;
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
    DELETE FROM audit_log; DELETE FROM handle_change_requests;
    DELETE FROM referrals; DELETE FROM point_ledger;
    DELETE FROM submissions; DELETE FROM challenge_entries;
    DELETE FROM creator_social_handles; DELETE FROM campaign_creators;
    DELETE FROM creators; DELETE FROM admin_sessions;
  `);
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
});

describe("reviewing a submission", () => {
  it("an approval writes its own row, with the reviewer on it", async () => {
    const me = await makeCreator();
    const sub = await pendingSubmission(me, "https://x.com/a/1");
    await db.query(`SELECT review('${sub}', 'approved', '${adminId}', NULL)`);

    expect(
      await count(`
        SELECT count(*)::int AS n FROM audit_log
         WHERE action = 'submission.approved'
           AND actor_admin_id = '${adminId}'
           AND entity_id = '${sub}'
           AND campaign_id = '${campaignId}'`),
    ).toBe(1);
  });

  it("a rejection writes its row and carries the note a dispute is answered with", async () => {
    const me = await makeCreator();
    const sub = await pendingSubmission(me, "https://x.com/a/2");
    await db.query(
      `SELECT review('${sub}', 'rejected', '${adminId}', 'Wrong account, not the registered handle')`,
    );

    const row = await one<{ note: string; actor_admin_id: string }>(`
      SELECT note, actor_admin_id FROM audit_log
       WHERE action = 'submission.rejected' AND entity_id = '${sub}'`);
    expect(row.note).toBe("Wrong account, not the registered handle");
    expect(row.actor_admin_id).toBe(adminId);
  });
});

describe("deciding a handle request", () => {
  const file = async (enrolment: string) => {
    await db.query(
      `SELECT * FROM request_handle_change($1::uuid, 'x'::platform, 'newhandle'::text, 'typo at registration'::text)`,
      [enrolment],
    );
    return (
      await one<{ id: string }>(
        `SELECT id FROM handle_change_requests WHERE campaign_creator_id = '${enrolment}'`,
      )
    ).id;
  };

  it("a rejection now appears in the trail, not only on the request row", async () => {
    const me = await makeCreator();
    const request = await file(me);
    await db.query(
      `SELECT * FROM decide_handle_request($1::uuid, $2::uuid, false, 'That account is not yours')`,
      [request, adminId],
    );

    const row = await one<{ actor_admin_id: string; note: string }>(`
      SELECT actor_admin_id, note FROM audit_log
       WHERE action = 'handle_request.rejected' AND entity_id = '${request}'`);
    expect(row.actor_admin_id).toBe(adminId);
    expect(row.note).toBe("That account is not yours");
  });

  it("an approval writes its own row beside the handle.corrected one", async () => {
    const me = await makeCreator();
    const request = await file(me);
    await db.query(
      `SELECT * FROM decide_handle_request($1::uuid, $2::uuid, true, NULL)`,
      [request, adminId],
    );

    expect(
      await count(`
        SELECT count(*)::int AS n FROM audit_log
         WHERE action = 'handle_request.approved'
           AND entity_id = '${request}'
           AND actor_admin_id = '${adminId}'`),
    ).toBe(1);
    // The side effect keeps its own trail: two rows, two facts.
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'handle.corrected'`,
      ),
    ).toBe(1);
  });
});

describe("signing in", () => {
  it("an ordinary sign-in writes the anchor row every later action hangs off", async () => {
    const hash = "a".repeat(64);
    const minted = await db.query(
      `SELECT * FROM create_admin_session($1, $2, $3)`,
      ["partnership@blockfestafrica.com", "identity-audit-test", hash],
    );
    expect(minted.rows.length).toBe(1);

    expect(
      await count(`
        SELECT count(*)::int AS n FROM audit_log
         WHERE action = 'admin.signed_in' AND actor_admin_id = '${adminId}'`),
    ).toBe(1);
  });

  it("a refused sign-in writes nothing under the admin's name", async () => {
    const hash = "b".repeat(64);
    await db.query(`SELECT * FROM create_admin_session($1, $2, $3)`, [
      "stranger@example.com",
      "identity-nobody",
      hash,
    ]);

    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'admin.signed_in'`,
      ),
    ).toBe(0);
  });
});
