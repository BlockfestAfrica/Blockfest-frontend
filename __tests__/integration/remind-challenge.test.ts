import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * "Remind them": the deadline reminder for a live week.
 *
 * The owner asked for a button, pressed by a person the day before or on the
 * day of a close, that tells creators the stage is about to close, the way
 * Announce tells them it opened. These pin who it reaches (only creators with
 * nothing in), that it goes once per stage even with two presses together,
 * and that it refuses a week it cannot help.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  sends: [] as { to: string; subject: string }[],
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
  sendEmail: async (email: { to: string; subject: string }) => {
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    state.inFlight -= 1;
    state.sends.push({ to: email.to, subject: email.subject });
    return { sent: true };
  },
  sendEmailQuietly: async () => undefined,
}));

const { POST } = await import("@/app/api/admin/remind-challenge/route");
const { reminderState } = await import("@/lib/admin/reminders");

let db: PGlite;
let campaignId: string;
let challengeId: string;
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) =>
  (await db.query<T>(q, params)).rows[0];

const press = () =>
  POST(
    new NextRequest("https://blockfestafrica.com/api/admin/remind-challenge", {
      method: "POST",
      headers: {
        origin: "https://blockfestafrica.com",
        "x-forwarded-host": "blockfestafrica.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ challengeId }),
    }),
  );

/** A creator in the campaign, and optionally one submission of theirs for the week. */
async function creator(
  label: string,
  submission: "none" | "pending" | "approved" | "rejected" = "none",
  status: "active" | "disqualified" = "active",
) {
  const n = ++seq;
  const person = await one<{ id: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
     VALUES ($1, $2, $2, $3, $4, 'finance') RETURNING id`,
    [label, `${label.toLowerCase()}@e.com`, `08${n}`, `+23480${String(n).padStart(8, "0")}`],
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, $3) RETURNING id`,
    [campaignId, person.id, `REM${n}`],
  );
  if (status === "disqualified") {
    await db.query(`UPDATE campaign_creators SET status = 'disqualified' WHERE id = $1`, [enrolment.id]);
  }
  if (submission !== "none") {
    const entry = await one<{ id: string }>(
      `INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
         base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
       VALUES ($1, $2, 100, 150, 200) RETURNING id`,
      [enrolment.id, challengeId],
    );
    const sub = await one<{ id: string }>(
      `INSERT INTO submissions (entry_id, platform, url) VALUES ($1, 'x', $2) RETURNING id`,
      [entry.id, `https://x.com/${label}/status/${n}`],
    );
    if (submission !== "pending") {
      await db.query(`SELECT review($1::uuid, $2::submission_status, $3::uuid, $4)`, [
        sub.id,
        submission,
        state.adminId,
        submission === "rejected" ? "Not on the brief" : null,
      ]);
    }
  }
}

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
  challengeId = (
    await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = $1 AND week_no = 3`,
      [campaignId],
    )
  ).id;
  // Nothing in: never submitted, or the only link was sent back.
  await creator("Ada");
  await creator("Bola", "rejected");
  // Something in: waiting for review, or approved.
  await creator("Chi", "pending");
  await creator("Dayo", "approved");
  // Removed from the campaign: not reminded.
  await creator("Efe", "none", "disqualified");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM audit_log WHERE action = 'challenge.reminded'`);
  // Live, and closing tomorrow.
  await db.query(
    `UPDATE challenges SET status = 'active', starts_at = now() - interval '5 days',
            ends_at = now() + interval '20 hours' WHERE id = $1`,
    [challengeId],
  );
  state.sends = [];
  state.inFlight = 0;
  state.maxInFlight = 0;
});

describe("the deadline reminder", () => {
  it("reaches only active creators with nothing in, and records the counts", async () => {
    const answer = await press();
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ ok: true, sent: 2, failed: 0 });
    expect(state.sends.map((s) => s.to).sort()).toEqual(["ada@e.com", "bola@e.com"]);
    expect(state.sends[0].subject).toMatch(/^Stage 3 closes (today|tomorrow) at /);
    const row = await one<{ after: { status: string; sent: number; recipients: number } }>(
      `SELECT after FROM audit_log WHERE action = 'challenge.reminded'`,
    );
    expect(row.after).toMatchObject({ status: "finished", sent: 2, recipients: 2 });
  });

  it("goes once per stage, even when two presses land together", async () => {
    const answers = await Promise.all([press(), press()]);
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    expect(state.sends).toHaveLength(2);
    expect((await press()).status).toBe(409);
    expect(state.sends).toHaveLength(2);
    const rows = await db.query(`SELECT 1 FROM audit_log WHERE action = 'challenge.reminded'`);
    expect(rows.rows).toHaveLength(1);
  });

  it("refuses a week that is not live, or has already closed, and claims nothing", async () => {
    await db.query(`UPDATE challenges SET status = 'draft' WHERE id = $1`, [challengeId]);
    expect((await press()).status).toBe(409);
    await db.query(
      `UPDATE challenges SET status = 'active', ends_at = now() - interval '1 minute' WHERE id = $1`,
      [challengeId],
    );
    const late = await press();
    expect(late.status).toBe(409);
    expect((await late.json()).message).toMatch(/already closed/);
    expect(state.sends).toHaveLength(0);
    const rows = await db.query(`SELECT 1 FROM audit_log WHERE action = 'challenge.reminded'`);
    expect(rows.rows).toHaveLength(0);
  });

  it("says where things stand for the console, before and after", async () => {
    const before = await reminderState({ adminId: state.adminId } as never, challengeId);
    expect(before).toMatchObject({ waiting: 2, active: 4, sent: null });
    await press();
    const after = await reminderState({ adminId: state.adminId } as never, challengeId);
    expect(after.sent).toMatchObject({ sent: 2, failed: 0, finished: true });
  });
});

describe("with everyone in", () => {
  it("sends nothing and claims nothing, so a later reminder is still possible", async () => {
    const others = await db.query<{ id: string }>(
      `SELECT cc.id FROM campaign_creators cc
         JOIN creators c ON c.id = cc.creator_id
        WHERE c.email IN ('ada@e.com', 'bola@e.com')`,
    );
    await db.query(`UPDATE campaign_creators SET status = 'disqualified' WHERE id = ANY($1::uuid[])`, [
      others.rows.map((r) => r.id),
    ]);
    const answer = await press();
    expect(answer.status).toBe(409);
    expect((await answer.json()).message).toMatch(/already has an entry/);
    expect(state.sends).toHaveLength(0);
    const rows = await db.query(`SELECT 1 FROM audit_log WHERE action = 'challenge.reminded'`);
    expect(rows.rows).toHaveLength(0);
  });
});
