import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * "Announce to creators" for a live stage: every active creator, once.
 *
 * Week 2 went live and the owner was about to press it. It mailed one
 * creator at a time inside a 300 second budget, so past roughly three
 * hundred creators the batch was cut off, and the ledger claimed before the
 * first send then refused the retry: the rest were never told. And its
 * once-per-stage check was a read two round trips before the claim, so two
 * presses together both mailed everybody. These pin the fixes: small
 * batches that reach everyone, and a claim only one press can hold.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  sends: [] as string[],
  inFlight: 0,
  maxInFlight: 0,
}));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});
vi.mock("@/lib/admin/session", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/session")>();
  return {
    ...real,
    requireAdmin: async () => ({
      ok: true,
      admin: { adminId: state.adminId, role: "owner", email: "owner@example.test" },
    }),
  };
});
vi.mock("@/lib/email/client", () => ({
  sendEmail: async (email: { to: string }) => {
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    state.inFlight -= 1;
    state.sends.push(email.to);
    return { sent: true };
  },
  sendEmailQuietly: async () => undefined,
}));

const { POST } = await import("@/app/api/admin/announce-challenge/route");

let db: PGlite;
let campaignId: string;
let challengeId: string;

const one = async <T,>(q: string, params: unknown[] = []) =>
  (await db.query<T>(q, params)).rows[0];

const press = () =>
  POST(
    new NextRequest("https://blockfestafrica.com/api/admin/announce-challenge", {
      method: "POST",
      headers: {
        origin: "https://blockfestafrica.com",
        "x-forwarded-host": "blockfestafrica.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ challengeId }),
    }),
  );

const CREATORS = 23;

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  campaignId = (
    await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)
  ).id;
  state.adminId = (
    await one<{ id: string }>(
      `INSERT INTO admin_users (email, email_canonical, password_hash, role)
       VALUES ('owner@example.test', 'owner@example.test', 'x', 'owner') RETURNING id`,
    )
  ).id;
  for (let i = 0; i < CREATORS; i += 1) {
    const person = await one<{ id: string }>(
      `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
       VALUES ($1, $2, $2, $3, $4, 'finance') RETURNING id`,
      [`Creator ${i}`, `c${i}@e.com`, `07${i}`, `+23470${String(i).padStart(8, "0")}`],
    );
    await db.query(
      `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, $3)`,
      [campaignId, person.id, `ANN${i}`],
    );
  }
  challengeId = (
    await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = $1 AND week_no = 2`,
      [campaignId],
    )
  ).id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM audit_log`);
  await db.query(`UPDATE challenges SET status = 'active' WHERE id = $1`, [challengeId]);
  state.sends = [];
  state.inFlight = 0;
  state.maxInFlight = 0;
});

describe("announcing a live stage", () => {
  it("mails every active creator, a few at a time rather than one by one", async () => {
    const answer = await press();
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ ok: true, sent: CREATORS, failed: 0 });
    expect(new Set(state.sends).size).toBe(CREATORS);
    expect(state.maxInFlight).toBeGreaterThan(1);
    expect(state.maxInFlight).toBeLessThanOrEqual(4);
    const row = await one<{ after: { status: string; sent: number } }>(
      `SELECT after FROM audit_log WHERE action = 'challenge.announced'`,
    );
    expect(row.after).toMatchObject({ status: "finished", sent: CREATORS });
  });

  it("mails the campaign once when two presses land together", async () => {
    const answers = await Promise.all([press(), press()]);
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    expect(state.sends).toHaveLength(CREATORS);
    const rows = await db.query(`SELECT 1 FROM audit_log WHERE action = 'challenge.announced'`);
    expect(rows.rows).toHaveLength(1);
  });

  it("refuses a second press, and a stage announced before this change", async () => {
    expect((await press()).status).toBe(200);
    expect((await press()).status).toBe(409);
    await db.exec(`DELETE FROM audit_log`);
    await db.query(
      `INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
       VALUES ($1, $2, 'challenge.announced', 'challenge', $3, '{"status":"finished"}'::jsonb)`,
      [campaignId, state.adminId, challengeId],
    );
    state.sends = [];
    expect((await press()).status).toBe(409);
    expect(state.sends).toHaveLength(0);
  });

  it("refuses a week that is not active", async () => {
    await db.query(`UPDATE challenges SET status = 'draft' WHERE id = $1`, [challengeId]);
    expect((await press()).status).toBe(409);
    expect(state.sends).toHaveLength(0);
  });
});
