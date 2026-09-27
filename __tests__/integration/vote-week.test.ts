import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import type { AdminIdentity } from "@/lib/admin/session";
import { applyMigrations } from "../helpers/migrations";

/*
 * Which earlier week still has a vote to finish.
 *
 * A 48-hour vote opened on a Sunday closes on the Tuesday, after the calendar
 * has moved to the next stage. The winners screen follows this answer so the
 * close, the review and the announce stay reachable. Unfinished means open,
 * or closed with its Community Favourite not yet announced; announcing marks
 * the round published (publish_weekly_winner, 0059).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});

const { unfinishedVoteWeek } = await import("@/lib/admin/vote-round");

const ADMIN = { id: "a", email: "a@example.test", role: "owner" } as unknown as AdminIdentity;
let db: PGlite;
let campaignId: string;

async function round(weekNo: number, status: "open" | "closed" | "published") {
  await db.query(
    `INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at)
     VALUES ($1, $2, $3::vote_round_status, '2026-09-27T08:00:00+01:00', '2026-09-29T08:00:00+01:00')`,
    [campaignId, weekNo, status],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  campaignId = (
    await db.query<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)
  ).rows[0].id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM vote_rounds`);
});

describe("unfinishedVoteWeek", () => {
  it("is nothing when no earlier week has a vote", async () => {
    expect(await unfinishedVoteWeek(ADMIN, 2)).toBeNull();
  });

  it("finds last week's vote while it is still open, or closed and not yet announced", async () => {
    await round(1, "open");
    expect(await unfinishedVoteWeek(ADMIN, 2)).toBe(1);
    await db.exec(`UPDATE vote_rounds SET status = 'closed'`);
    expect(await unfinishedVoteWeek(ADMIN, 2)).toBe(1);
  });

  it("lets go once the Community Favourite is announced", async () => {
    await round(1, "published");
    expect(await unfinishedVoteWeek(ADMIN, 2)).toBeNull();
  });

  it("never points at the current week or a later one", async () => {
    await round(2, "open");
    expect(await unfinishedVoteWeek(ADMIN, 2)).toBeNull();
  });

  it("picks the most recent unfinished week", async () => {
    await round(1, "closed");
    await round(2, "open");
    expect(await unfinishedVoteWeek(ADMIN, 3)).toBe(2);
  });
});
