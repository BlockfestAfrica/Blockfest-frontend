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

const { unfinishedVoteWeek, candidateEntries } = await import("@/lib/admin/vote-round");

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

describe("candidateEntries", () => {
  it("carries each approved post with the handle registered on its platform", async () => {
    const one = async <T,>(q: string, params: unknown[] = []) => (await db.query<T>(q, params)).rows[0];
    const person = await one<{ id: string }>(
      `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
       VALUES ('Ada Obi', 'ada@e.com', 'ada@e.com', '0801', '+2348010000001', 'finance') RETURNING id`,
    );
    const enrolment = await one<{ id: string }>(
      `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
       VALUES ($1, $2, 'ADA1') RETURNING id`,
      [campaignId, person.id],
    );
    await db.query(
      `INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
       VALUES ($1, 'x', 'AdaObi', 'adaobi')`,
      [person.id],
    );
    const challenge = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = $1 AND week_no = 1`,
      [campaignId],
    );
    const entry = await one<{ id: string }>(
      `INSERT INTO challenge_entries (campaign_creator_id, challenge_id, base_points_snapshot,
         bonus_2_snapshot, bonus_3_snapshot, approved_platform_count, awarded_points)
       VALUES ($1, $2, 100, 50, 100, 2, 150) RETURNING id`,
      [enrolment.id, challenge.id],
    );
    const post = (platform: string, url: string, status: string) =>
      db.query(
        `INSERT INTO submissions (entry_id, platform, url, status, reviewed_at)
         VALUES ($1, $2::platform, $3, $4::submission_status, $5::timestamptz)`,
        [entry.id, platform, url, status, status === "pending" ? null : "2026-09-26T10:00:00Z"],
      );
    await post("instagram", "https://instagram.com/p/ADA1", "approved");
    await post("x", "https://x.com/AdaObi/status/901", "approved");
    await post("tiktok", "https://tiktok.com/@ada/video/77", "rejected");

    const [nominee] = await candidateEntries(ADMIN, 1);
    expect(nominee.name).toBe("Ada Obi");
    expect(nominee.posts).toEqual([
      { platform: "x", handle: "AdaObi", url: "https://x.com/AdaObi/status/901" },
      { platform: "instagram", handle: null, url: "https://instagram.com/p/ADA1" },
    ]);
  });
});
