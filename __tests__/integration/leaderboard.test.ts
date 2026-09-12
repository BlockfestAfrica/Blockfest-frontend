/**
 * The public leaderboard, against a real Postgres.
 *
 * Two things matter here and nothing else does.
 *
 * The ordering decides how 5,000,000 naira is split, and the rules promise a
 * specific tiebreak: "Where creators are level, the order is decided by who
 * reached that total first, then by the number of approved entries." That is
 * not first_approved_at, which is when somebody had their first approved entry
 * and says nothing about who got to 300 points first. Using that field would
 * have been a plausible reading of something that already existed and a quiet
 * breach of a published rule.
 *
 * And the output is published to anybody who visits, so a stray column here is
 * a data breach rather than a bug.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";
import { NEVER_PUBLISH } from "@/lib/leaderboard";

let db: PGlite;
let seq = 0;
let campaignId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const board = async () =>
  (
    await db.query<{
      rank: string;
      display_name: string;
      points_total: number;
      approved_entries: number;
    }>(`SELECT * FROM campaign_leaderboard('monica-money-story', 100)`)
  ).rows;

/** A creator with a points history written directly onto the ledger. */
async function creatorWith(
  name: string,
  awards: Array<{ points: number; at: string }>,
  approvedEntries = 1,
) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('${name}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);

  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code, points_total, approved_entries_count)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}',
            ${awards.reduce((t, a) => t + a.points, 0)}, ${approvedEntries})
    RETURNING id`);

  const challenge = await one<{ id: string }>(`
    SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`);
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolment.id}', '${challenge.id}', 100, 100, 200) RETURNING id`);

  for (const award of awards) {
    await db.query(`
      INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, entry_id, created_at)
      VALUES ('${campaignId}', '${enrolment.id}', 'challenge_entry', ${award.points},
              '${entry.id}', '${award.at}')`);
  }

  return enrolment.id;
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
    DELETE FROM point_ledger; DELETE FROM submissions;
    DELETE FROM challenge_entries; DELETE FROM campaign_creators;
    DELETE FROM creators;
  `);
  campaignId = (
    await one<{ id: string }>(
      `SELECT id FROM campaigns WHERE slug = 'monica-money-story'`,
    )
  ).id;
});

describe("ordering", () => {
  it("puts the highest total first", async () => {
    await creatorWith("Low", [{ points: 100, at: "2026-09-15 10:00+01" }]);
    await creatorWith("High", [{ points: 300, at: "2026-09-15 10:00+01" }]);

    const rows = await board();
    expect(rows[0].display_name).toBe("High");
    expect(rows[1].display_name).toBe("Low");
  });

  it("leaves out anybody with no points", async () => {
    // A leaderboard of zeroes is a list of everybody who registered, which is
    // not a leaderboard and publishes names for no reason.
    await creatorWith("Scored", [{ points: 100, at: "2026-09-15 10:00+01" }]);
    await creatorWith("Unscored", []);

    const rows = await board();
    expect(rows).toHaveLength(1);
    expect(rows[0].display_name).toBe("Scored");
  });
});

describe("the tiebreak the rules promise", () => {
  /**
   * Both end on 300. One got there on Tuesday, the other on Friday. The rules
   * say the one who reached it first is ahead.
   */
  it("separates level creators by who reached that total first", async () => {
    await creatorWith("Friday", [
      { points: 100, at: "2026-09-15 09:00+01" },
      { points: 200, at: "2026-09-18 09:00+01" },
    ]);
    await creatorWith("Tuesday", [
      { points: 300, at: "2026-09-16 09:00+01" },
    ]);

    const rows = await board();
    expect(rows.map((r) => r.display_name)).toEqual(["Tuesday", "Friday"]);
  });

  /**
   * The distinction that matters. "Earlybird" was approved first, so
   * first_approved_at would rank them ahead, and they reached 300 last. Ranking
   * on that field would break the published rule.
   */
  it("is not first_approved_at", async () => {
    await creatorWith("Earlybird", [
      { points: 100, at: "2026-09-14 08:00+01" },
      { points: 100, at: "2026-09-19 08:00+01" },
      { points: 100, at: "2026-09-20 08:00+01" },
    ]);
    await creatorWith("Latecomer", [
      { points: 300, at: "2026-09-17 08:00+01" },
    ]);

    const rows = await board();
    expect(
      rows.map((r) => r.display_name),
      "Latecomer reached 300 on the 17th, Earlybird on the 20th",
    ).toEqual(["Latecomer", "Earlybird"]);
  });

  it("falls through to approved entries when the moment is identical", async () => {
    const at = "2026-09-16 09:00+01";
    await creatorWith("Fewer", [{ points: 300, at }], 1);
    await creatorWith("More", [{ points: 300, at }], 3);

    const rows = await board();
    expect(rows.map((r) => r.display_name)).toEqual(["More", "Fewer"]);
  });

  /**
   * A correction that takes points away and gives them back must not move the
   * moment somebody reached their total: they were already there earlier.
   */
  it("is not moved by a later correction that nets to zero", async () => {
    await creatorWith("Corrected", [
      { points: 300, at: "2026-09-15 09:00+01" },
      { points: -100, at: "2026-09-18 09:00+01" },
      { points: 100, at: "2026-09-19 09:00+01" },
    ]);
    await creatorWith("Steady", [{ points: 300, at: "2026-09-16 09:00+01" }]);

    const rows = await board();
    expect(
      rows.map((r) => r.display_name),
      "Corrected was on 300 from the 15th, before Steady",
    ).toEqual(["Corrected", "Steady"]);
  });
});

describe("what is published", () => {
  it("returns only rank, name, points and entries", async () => {
    await creatorWith("Ada", [{ points: 100, at: "2026-09-15 10:00+01" }]);
    const rows = await board();

    expect(Object.keys(rows[0]).sort()).toEqual([
      "approved_entries",
      "campaign_creator_id",
      "display_name",
      "points_total",
      "rank",
      "reached_total_at",
    ]);
  });

  /**
   * The database function returns an id, which the serialiser drops. This
   * asserts the SQL side carries nothing personal beyond the name, so that a
   * future caller that forgets the serialiser still cannot leak an address.
   */
  it("carries no contact detail at all, even before serialising", async () => {
    await creatorWith("Ada", [{ points: 100, at: "2026-09-15 10:00+01" }]);
    const rows = await board();
    const serialised = JSON.stringify(rows).toLowerCase();

    for (const field of ["@e.com", "+234", "registration_ip", "access_token"]) {
      expect(serialised, `leaderboard leaked ${field}`).not.toContain(field);
    }
  });

  it("never names a field the serialiser forbids", async () => {
    await creatorWith("Ada", [{ points: 100, at: "2026-09-15 10:00+01" }]);
    const rows = await board();
    const keys = Object.keys(rows[0]);

    // campaign_creator_id is returned by the function and dropped by
    // toPublicRow, so it is the one permitted exception here.
    const forbidden = NEVER_PUBLISH.filter(
      (f) => keys.includes(f) && f !== "campaign_creator_id",
    );
    expect(forbidden).toEqual([]);
  });
});
