import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import type { AdminIdentity } from "@/lib/admin/session";
import { applyMigrations } from "../helpers/migrations";

/*
 * "Tell the creators", once per round, and the console remembering it.
 *
 * Owner report: pressed Tell the creators, the email went out (the owner is
 * registered as a creator and got it), and after a reload the button was
 * back. The console kept the send in page state only. These pin the fix
 * from both sides: the round the console loads carries the send from its
 * audit row, and two presses landing together mail the campaign once.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  sends: [] as string[],
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
    state.sends.push(email.to);
    return { sent: true };
  },
  sendEmailQuietly: async () => undefined,
}));

const { POST } = await import("@/app/api/admin/announce-vote/route");
const { currentRound } = await import("@/lib/admin/vote-round");

const ADMIN = { adminId: "x", role: "owner" } as unknown as AdminIdentity;
let db: PGlite;
let campaignId: string;
let roundId: string;
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) =>
  (await db.query<T>(q, params)).rows[0];

const press = () =>
  POST(
    new NextRequest("https://blockfestafrica.com/api/admin/announce-vote", {
      method: "POST",
      headers: {
        origin: "https://blockfestafrica.com",
        "x-forwarded-host": "blockfestafrica.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ roundId }),
    }),
  );

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
  for (const name of ["Ada Obi", "Ben Eze", "Cy Ade"]) {
    const tag = ++seq;
    const person = await one<{ id: string }>(
      `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
       VALUES ($1, $2, $2, $3, $4, 'finance') RETURNING id`,
      [name, `told${tag}@e.com`, `09${tag}`, `+2349${String(tag).padStart(9, "0")}`],
    );
    await db.query(
      `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, $3)`,
      [campaignId, person.id, `TOLD${tag}`],
    );
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM audit_log; DELETE FROM vote_rounds;`);
  state.sends = [];
  roundId = (
    await one<{ id: string }>(
      `INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at)
       VALUES ($1, 1, 'open', now() - interval '1 hour', now() + interval '1 day') RETURNING id`,
      [campaignId],
    )
  ).id;
});

describe("the round the console loads", () => {
  it("says nobody has been told before the press", async () => {
    expect((await currentRound(ADMIN, 1))!.announced).toBeNull();
  });

  it("carries the send, with its time and count, after the press", async () => {
    const answer = await press();
    expect(answer.status).toBe(200);
    const round = (await currentRound(ADMIN, 1))!;
    expect(round.announced).not.toBeNull();
    expect(round.announced!.finished).toBe(true);
    expect(round.announced!.sent).toBe(3);
    expect(Date.now() - round.announced!.at.getTime()).toBeLessThan(60_000);
  });

  it("shows a send that started and never finished as unfinished", async () => {
    await db.query(
      `INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
       VALUES ($1, $2, 'vote.announced', 'vote_round', $3, '{"status":"started","sent":0}'::jsonb)`,
      [campaignId, state.adminId, roundId],
    );
    const round = (await currentRound(ADMIN, 1))!;
    expect(round.announced!.finished).toBe(false);
  });

  it("starts fresh for next week's round", async () => {
    await press();
    await db.query(
      `INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at)
       VALUES ($1, 2, 'open', now(), now() + interval '2 days')`,
      [campaignId],
    );
    expect((await currentRound(ADMIN, 2))!.announced).toBeNull();
  });
});

describe("pressing it", () => {
  it("refuses a second press after the first has finished", async () => {
    expect((await press()).status).toBe(200);
    const again = await press();
    expect(again.status).toBe(409);
    expect(state.sends).toHaveLength(3);
  });

  it("mails the campaign once when two presses land together", async () => {
    const answers = await Promise.all([press(), press()]);
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    expect(state.sends).toHaveLength(3);
    const rows = await db.query(`SELECT 1 FROM audit_log WHERE action = 'vote.announced'`);
    expect(rows.rows).toHaveLength(1);
  });
});
