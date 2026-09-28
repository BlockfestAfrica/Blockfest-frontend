import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * What the public leaderboard shows beside each name, from the real query.
 *
 * Movement, stages, weekly prizes and platforms each come from a different
 * table joined on the enrolment id, and the board is published to anybody who
 * visits. So these run leaderboardView itself, through drizzle, against every
 * migration, and check two things: that each figure is right, including the
 * rows that must NOT count (a rejected post, a draft winner, an older
 * recording of the standings), and that nothing identifying leaves the
 * database, at any depth, before or after the serialiser.
 *
 * Its own database, because snapshot rows cannot be deleted (0021 refuses it)
 * and the other leaderboard tests clear their tables between cases.
 */

const state = vi.hoisted(() => ({ db: null as unknown, raw: [] as Record<string, unknown>[] }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});

const { leaderboardView } = await import("@/lib/leaderboard");
const { NEVER_PUBLISH } = await import("@/lib/leaderboard-row");

let db: PGlite;
let campaignId: string;
let seq = 0;

const one = async <T = Record<string, unknown>>(text: string): Promise<T> =>
  (await db.query<T>(text)).rows[0];

/** Stage 2 is open: the board measures movement from the stage 1 standings. */
const DURING_STAGE_2 = new Date("2026-09-29T12:00:00+01:00");
/** Stage 1: nothing before it to measure from. */
const DURING_STAGE_1 = new Date("2026-09-20T12:00:00+01:00");
/** Stage 3: measured from the stage 2 standings, recorded once. */
const DURING_STAGE_3 = new Date("2026-10-06T12:00:00+01:00");
/** Stage 4: the stage 3 standings were never recorded. */
const DURING_STAGE_4 = new Date("2026-10-13T12:00:00+01:00");

async function challengeId(weekNo: number, type: "regular" | "wildcard" = "regular") {
  const found = await one<{ id: string } | undefined>(
    `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = ${weekNo} AND type = '${type}'`,
  );
  if (found) return found.id;
  // Neither exists in the campaign; the schema allows both.
  return (
    await one<{ id: string }>(`
      INSERT INTO challenges (campaign_id, title, description, week_no, type, starts_at, ends_at)
      VALUES ('${campaignId}', 'Extra', 'Extra', ${weekNo}, '${type}',
              '2026-10-01T00:00:00Z', '2026-10-30T00:00:00Z')
      RETURNING id`)
  ).id;
}

async function creator(name: string, points: number) {
  const tag = `${++seq}`;
  const person = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('${name}', 'lb${tag}@e.com', 'lb${tag}@e.com', '0${tag}', '+23480${tag.padStart(8, "0")}', 'finance')
    RETURNING id`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code, points_total, approved_entries_count)
    VALUES ('${campaignId}', '${person.id}', 'LB${tag}', ${points}, 1)
    RETURNING id`);
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolment.id}', '${await challengeId(1)}', 100, 50, 100)
    RETURNING id`);
  await db.query(`
    INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, entry_id, created_at)
    VALUES ('${campaignId}', '${enrolment.id}', 'challenge_entry', ${points},
            '${entry.id}', '2026-09-18 10:0${seq % 10}+01')`);
  return enrolment.id;
}

async function post(
  enrolment: string,
  weekNo: number,
  platform: "x" | "instagram" | "tiktok",
  status: "approved" | "rejected" | "pending",
  type: "regular" | "wildcard" = "regular",
) {
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolment}', '${await challengeId(weekNo, type)}', 100, 50, 100)
    ON CONFLICT (campaign_creator_id, challenge_id) DO UPDATE SET updated_at = now()
    RETURNING id`);
  const n = ++seq;
  const url =
    platform === "x"
      ? `https://x.com/lb${n}/status/${9000 + n}`
      : platform === "instagram"
        ? `https://instagram.com/p/LB${n}`
        : `https://tiktok.com/@lb${n}/video/${7000 + n}`;
  await db.query(
    `INSERT INTO submissions (entry_id, platform, url, status, reviewed_at)
     VALUES ($1, $2, $3, $4::submission_status, $5::timestamptz)`,
    [entry.id, platform, url, status, status === "pending" ? null : "2026-09-26T10:00:00Z"],
  );
}

async function snapshot(weekNo: number, version: number, ranks: Array<[string, number]>) {
  for (const [enrolment, rank] of ranks) {
    await db.query(
      `INSERT INTO leaderboard_snapshots
         (campaign_id, week_no, version, rank, campaign_creator_id, display_name, points_total, approved_entries)
       VALUES ($1, $2, $3, $4, $5, 'copied name', 100, 1)`,
      [campaignId, weekNo, version, rank, enrolment],
    );
  }
}

async function winner(
  enrolment: string,
  category: "creator_of_week" | "community_favourite",
  published: boolean,
) {
  await db.query(
    `INSERT INTO weekly_winners (campaign_id, week_no, category, campaign_creator_id, prize_amount_naira, note, published_at)
     VALUES ($1, 1, $2, $3, 250000, 'a private note', $4)`,
    [campaignId, category, enrolment, published ? "2026-09-27T18:00:00+01:00" : null],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  const real = drizzle(db, { schema });
  // Records what the database hands back, before any serialiser sees it.
  state.db = {
    execute: async (query: Parameters<typeof real.execute>[0]) => {
      const result = await real.execute(query);
      state.raw = (result.rows ?? []) as Record<string, unknown>[];
      return result;
    },
  };
  campaignId = (
    await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)
  ).id;

  const ada = await creator("Ada", 350);
  const ben = await creator("Ben", 300);
  const cy = await creator("Cy", 200);
  const dee = await creator("Dee", 150);

  // Ada: two stages, all three platforms.
  await post(ada, 1, "x", "approved");
  await post(ada, 1, "instagram", "approved");
  await post(ada, 2, "tiktok", "approved");
  // Ben: one approved platform; the rejected and the waiting ones never count.
  await post(ben, 1, "x", "approved");
  await post(ben, 1, "instagram", "rejected");
  await post(ben, 1, "tiktok", "pending");
  await post(cy, 1, "instagram", "approved");
  await post(dee, 1, "x", "approved");
  // Approved, but not stages: a wildcard, and a week past the four.
  await post(dee, 3, "tiktok", "approved", "wildcard");
  await post(dee, 5, "instagram", "approved");

  // Stage 1 recorded twice; the later recording is the baseline. Cy was not
  // on either.
  await snapshot(1, 1, [
    [ada, 2],
    [ben, 1],
    [dee, 3],
  ]);
  await snapshot(1, 2, [
    [ben, 1],
    [dee, 2],
    [ada, 3],
  ]);
  // Stage 2 recorded once. Its latest version (1) is lower than stage 1's
  // (2), so a version lookup that ignored the week would find nothing here.
  await snapshot(2, 1, [
    [cy, 1],
    [ada, 2],
  ]);

  await winner(ben, "creator_of_week", true);
  // Chosen, not yet announced. Must not show.
  await winner(ada, "community_favourite", false);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const byName = async (now: Date) => {
  const view = await leaderboardView(100, now);
  return { view, row: (name: string) => view.rows.find((r) => r.name === name)! };
};

describe("movement", () => {
  it("measures from the latest recording of the previous stage", async () => {
    const { view, row } = await byName(DURING_STAGE_2);
    expect(view.movementSince).toBe(1);
    expect(view.rows.map((r) => r.name)).toEqual(["Ada", "Ben", "Cy", "Dee"]);
    // Version 2 had Ada 3rd, not version 1's 2nd.
    expect(row("Ada").previousRank).toBe(3);
    expect(row("Ben").previousRank).toBe(1);
    expect(row("Dee").previousRank).toBe(2);
  });

  it("calls a creator missing from those standings new, not unchanged", async () => {
    const { row } = await byName(DURING_STAGE_2);
    expect(row("Cy").previousRank).toBeNull();
  });

  it("measures each stage from its own previous stage's recording", async () => {
    const { view, row } = await byName(DURING_STAGE_3);
    expect(view.movementSince).toBe(2);
    expect(row("Cy").previousRank).toBe(1);
    expect(row("Ada").previousRank).toBe(2);
    expect(row("Ben").previousRank).toBeNull();
  });

  it("shows no movement when the previous stage's standings were never recorded", async () => {
    const { view } = await byName(DURING_STAGE_4);
    expect(view.movementSince).toBeNull();
    expect(view.rows.every((r) => r.previousRank === null)).toBe(true);
  });

  it("shows no movement during stage 1, when there is nothing before it", async () => {
    const { view } = await byName(DURING_STAGE_1);
    expect(view.movementSince).toBeNull();
    expect(view.rows.every((r) => r.previousRank === null)).toBe(true);
  });
});

describe("stages and platforms", () => {
  it("counts stages and platforms from approved posts only", async () => {
    const { row } = await byName(DURING_STAGE_2);
    expect(row("Ada").stages).toBe(2);
    expect(row("Ada").platforms).toEqual(["x", "instagram", "tiktok"]);
    expect(row("Ben").stages).toBe(1);
    expect(row("Ben").platforms).toEqual(["x"]);
    expect(row("Cy").platforms).toEqual(["instagram"]);
  });

  it("counts only the regular stages, however many approved posts there are", async () => {
    const { row } = await byName(DURING_STAGE_2);
    expect(row("Dee").stages).toBe(1);
    // The posts still show where they were approved.
    expect(row("Dee").platforms).toEqual(["x", "instagram", "tiktok"]);
  });

  it("knows how many stages there are", async () => {
    const { view } = await byName(DURING_STAGE_2);
    expect(view.stageCount).toBe(4);
  });
});

describe("weekly prizes", () => {
  it("shows an announced winner and never a draft", async () => {
    const { row } = await byName(DURING_STAGE_2);
    expect(row("Ben").badges).toEqual([{ weekNo: 1, category: "creator_of_week" }]);
    expect(row("Ada").badges).toEqual([]);
  });
});

describe("what is published", () => {
  it("gets back from the database only the columns it names", async () => {
    await leaderboardView(100, DURING_STAGE_2);
    expect(Object.keys(state.raw[0]).sort()).toEqual([
      "badges",
      "display_name",
      "has_baseline",
      "platforms",
      "points_total",
      "previous_rank",
      "rank",
      "stages",
    ]);
  });

  it("publishes exactly the row fields, and no id, prize or note, at any depth", async () => {
    const { view } = await byName(DURING_STAGE_2);
    for (const row of view.rows) {
      expect(Object.keys(row).sort()).toEqual([
        "badges",
        "name",
        "platforms",
        "points",
        "previousRank",
        "rank",
        "stages",
      ]);
    }

    const keys: string[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") {
        for (const [key, inner] of Object.entries(value)) {
          keys.push(key);
          walk(inner);
        }
      }
    };
    walk(view);
    walk(state.raw);
    expect(keys.filter((k) => (NEVER_PUBLISH as readonly string[]).includes(k))).toEqual([]);

    const serialised = JSON.stringify([view, state.raw]).toLowerCase();
    expect(serialised, "an id reached the output").not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
    for (const leak of ["@e.com", "+234", "a private note", "250000", "copied name"]) {
      expect(serialised, `leaked ${leak}`).not.toContain(leak);
    }
  });
});
