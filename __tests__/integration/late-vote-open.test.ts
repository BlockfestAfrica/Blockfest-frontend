import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * A missed vote, opened late, through the real route.
 *
 * Stage 2's Community Favourite vote was not opened on its Sunday, and on the
 * Monday the console had hidden the form. The route now asks the same
 * question the console does (lib/vote-open-rule.ts) before it writes
 * anything, because a round can never be cancelled: the week that has just
 * ended may still have its vote, only with its standings recorded (closing
 * needs them), and closing by the time the next stage closes.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  mails: [] as { to: string; subject: string }[],
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
  sendEmailQuietly: async (email: { to: string; subject: string }) => {
    state.mails.push({ to: email.to, subject: email.subject });
  },
  sendEmail: async () => ({ sent: true }),
}));

const { POST } = await import("@/app/api/admin/vote-round/route");

/** Monday 5 October, 10:00 Lagos: stage 3 has started, week 2 is over. */
const MONDAY = new Date("2026-10-05T09:00:00Z");

let db: PGlite;
let campaignId: string;
let seq = 0;
const week2: string[] = [];
const week1: string[] = [];

const one = async <T,>(q: string, params: unknown[] = []) => (await db.query<T>(q, params)).rows[0];
const rounds = async (week: number) =>
  Number(
    (await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM vote_rounds WHERE campaign_id = $1 AND week_no = $2`,
      [campaignId, week],
    )).n,
  );

async function approvedEntry(week: number) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
     VALUES ($1, $2, $2, $3, $4, 'finance') RETURNING id`,
    [`Creator ${tag}`, `late${tag}@e.com`, `0${tag}`, `+234${tag.padStart(10, "0")}`],
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code, points_total, approved_entries_count)
     VALUES ($1, $2, $3, 100, 1) RETURNING id`,
    [campaignId, creator.id, `LATE${tag}`],
  );
  const challenge = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = $1 AND week_no = $2`,
    [campaignId, week],
  );
  return (
    await one<{ id: string }>(
      `INSERT INTO challenge_entries
         (campaign_creator_id, challenge_id, base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot,
          approved_platform_count, awarded_points)
       VALUES ($1, $2, 100, 50, 100, 1, 100) RETURNING id`,
      [enrolment.id, challenge.id],
    )
  ).id;
}

const open = async (body: Record<string, unknown>) => {
  const response = await POST(
    new NextRequest("https://blockfestafrica.com/api/admin/vote-round", {
      method: "POST",
      headers: {
        origin: "https://blockfestafrica.com",
        "x-forwarded-host": "blockfestafrica.com",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as { ok: boolean; message?: string } };
};

const lateWeek2 = (closesAt = "2026-10-07T08:00:00+01:00") => ({
  action: "open",
  weekNo: 2,
  entryIds: week2,
  opensAt: "2026-10-05T08:00:00+01:00",
  closesAt,
});

const record = (week: number) =>
  db.query(`SELECT * FROM take_leaderboard_snapshot('monica-money-story', $1::smallint, $2::uuid)`, [
    week,
    state.adminId,
  ]);

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)).id;
  state.adminId = (
    await one<{ id: string }>(
      `INSERT INTO admin_users (email, email_canonical, password_hash, role)
       VALUES ('owner@example.test', 'owner@example.test', 'x', 'owner') RETURNING id`,
    )
  ).id;
  for (let i = 0; i < 3; i++) week2.push(await approvedEntry(2));
  for (let i = 0; i < 3; i++) week1.push(await approvedEntry(1));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(() => {
  state.mails.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MONDAY);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("opening a missed vote late", () => {
  it("refuses while the week's standings are unrecorded, and writes and sends nothing", async () => {
    const result = await open(lateWeek2());
    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/standings were never recorded/);
    expect(await rounds(2)).toBe(0);
    expect(state.mails).toEqual([]);
  });

  it("refuses an earlier week than the one just ended, recorded or not", async () => {
    await record(1);
    const result = await open({ ...lateWeek2(), weekNo: 1, entryIds: week1 });
    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/stage 2 closed Saturday, 3 October at 12:00 noon/);
    expect(await rounds(1)).toBe(0);
  });

  it("refuses a late vote that would close after the next stage closes, or has already closed", async () => {
    await record(2);
    const tooLate = await open(lateWeek2("2026-10-10T12:30:00+01:00"));
    expect(tooLate.status).toBe(409);
    expect(tooLate.body.message).toBe(
      "A late week 2 vote has to close by Saturday, 10 October at 12:00 noon, when stage 3 closes, so it is finished before week 3's own vote.",
    );
    const past = await open(lateWeek2("2026-10-05T09:00:00+01:00"));
    expect(past.status).toBe(409);
    expect(past.body.message).toBe("The close time has already passed.");
    expect(await rounds(2)).toBe(0);
  });

  it("opens it once the week is recorded, tells the nominees, and the round can be closed on the recorded board", async () => {
    // Week 2 was recorded by the test before; snapshots are never deleted.
    const result = await open(lateWeek2());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(await rounds(2)).toBe(1);
    const toNominees = state.mails.filter((m) => /late\d+@e\.com/.test(m.to));
    expect(toNominees).toHaveLength(3);
    expect(toNominees.every((m) => /week 2/i.test(m.subject))).toBe(true);

    const round = await one<{ id: string }>(
      `SELECT id FROM vote_rounds WHERE campaign_id = $1 AND week_no = 2`,
      [campaignId],
    );
    const close = await POST(
      new NextRequest("https://blockfestafrica.com/api/admin/vote-round", {
        method: "POST",
        headers: {
          origin: "https://blockfestafrica.com",
          "x-forwarded-host": "blockfestafrica.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "close", roundId: round.id }),
      }),
    );
    expect(close.status).toBe(200);
    const closed = await one<{ status: string; pinned: number | null }>(
      `SELECT status::text AS status, tiebreak_snapshot_version AS pinned FROM vote_rounds WHERE id = $1`,
      [round.id],
    );
    expect(closed.status).toBe("closed");
    expect(closed.pinned).not.toBeNull();
  });

  it("refuses a second round for the week, as the engine always has", async () => {
    const again = await open(lateWeek2());
    expect(again.status).toBe(400);
    expect(again.body.message).toBe("This week already has a round. Reload to see it.");
    expect(await rounds(2)).toBe(1);
  });
});
