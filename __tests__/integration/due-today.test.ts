import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * The morning list's endpoint, against a real Postgres.
 *
 * Called once a day by the scheduled function. It must refuse without the
 * secret, email owners only (never reviewers, never creators), and send at
 * most one list a day however often it is called.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  sends: [] as { to: string; subject: string; text: string }[],
}));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});
vi.mock("@/lib/email/client", () => ({
  sendEmail: async (email: { to: string; subject: string; text: string }) => {
    state.sends.push(email);
    return { sent: true };
  },
  sendEmailQuietly: async () => undefined,
}));

const { POST } = await import("@/app/api/cron/due-today/route");

let db: PGlite;

const call = (auth?: string, dry = false) =>
  POST(
    new NextRequest(`https://blockfestafrica.com/api/cron/due-today${dry ? "?dry=1" : ""}`, {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  await db.exec(`
    INSERT INTO admin_users (email, email_canonical, password_hash, role)
    VALUES ('owner@example.test', 'owner@example.test', 'x', 'owner'),
           ('reviewer@example.test', 'reviewer@example.test', 'x', 'reviewer'),
           ('gone@example.test', 'gone@example.test', 'x', 'owner');
    UPDATE admin_users SET is_active = false, revoked_at = now() WHERE email = 'gone@example.test';
  `);
  // Week 3 live, closing tomorrow, never announced.
  await db.exec(`
    UPDATE challenges SET status = 'active', starts_at = now() - interval '5 days',
           ends_at = now() + interval '20 hours'
     WHERE week_no = 3
       AND campaign_id = (SELECT id FROM campaigns WHERE slug = 'monica-money-story');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  state.sends = [];
  await db.exec(`DELETE FROM audit_log WHERE action = 'nudge.due-today'`);
  process.env.CRON_SECRET = "test-secret";
});

describe("the morning list endpoint", () => {
  it("refuses when no secret is configured, and a wrong one", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer test-secret")).status).toBe(503);
    process.env.CRON_SECRET = "test-secret";
    expect((await call("Bearer wrong")).status).toBe(403);
    expect((await call()).status).toBe(403);
    expect(state.sends).toHaveLength(0);
  });

  it("on a dry run returns the list and sends nothing", async () => {
    const answer = await call("Bearer test-secret", true);
    expect(answer.status).toBe(200);
    const body = await answer.json();
    expect(body.items.map((i: { text: string }) => i.text)).toContain(
      "Announce week 3 to creators: it is live and nobody has been told.",
    );
    expect(state.sends).toHaveLength(0);
    const rows = await db.query(`SELECT 1 FROM audit_log WHERE action = 'nudge.due-today'`);
    expect(rows.rows).toHaveLength(0);
  });

  it("emails active owners only, once a day", async () => {
    const answer = await call("Bearer test-secret");
    expect(answer.status).toBe(200);
    // Exactly the active owners, whoever the migrations seeded; never a
    // reviewer, never a revoked owner.
    const owners = await db.query<{ email: string }>(
      `SELECT email FROM admin_users WHERE role = 'owner' AND is_active ORDER BY email`,
    );
    expect(state.sends.map((s) => s.to).sort()).toEqual(owners.rows.map((r) => r.email).sort());
    expect(state.sends.map((s) => s.to)).toContain("owner@example.test");
    expect(state.sends.map((s) => s.to)).not.toContain("reviewer@example.test");
    expect(state.sends.map((s) => s.to)).not.toContain("gone@example.test");
    expect(state.sends[0].text).toContain("Announce week 3 to creators");
    expect(state.sends[0].text).toContain("https://blockfestafrica.com/admin/campaign#stages");

    const sent = state.sends.length;
    const again = await call("Bearer test-secret");
    expect((await again.json()).skipped).toBe("already sent today");
    expect(state.sends).toHaveLength(sent);
  });

  it("goes only to DUE_TODAY_TO when the team names people", async () => {
    process.env.DUE_TODAY_TO = "named@example.test, not-an-address";
    try {
      expect((await call("Bearer test-secret")).status).toBe(200);
      expect(state.sends.map((s) => s.to)).toEqual(["named@example.test"]);
    } finally {
      delete process.env.DUE_TODAY_TO;
    }
  });
});
