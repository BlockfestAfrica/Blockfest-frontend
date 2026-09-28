import { describe, expect, it } from "vitest";
import { NEVER_PUBLISH, toPublicRow } from "@/lib/leaderboard-row";

/*
 * The serialiser is the privacy boundary of a page anybody can read, and the
 * table it feeds runs in the browser, so every field it lets through reaches
 * every visitor. These feed it the worst a query could hand it: every column
 * the SQL can produce, plus the ones it must never produce, nested inside the
 * json values as well as beside them.
 */

const hostile = {
  rank: "1",
  display_name: "  Ada Obi  ",
  points_total: 350,
  stages: 2,
  previous_rank: 3,
  has_baseline: true,
  approved_entries: 2,
  reached_total_at: "2026-09-18T09:00:00Z",
  campaign_creator_id: "0f0e0d0c-0b0a-4000-8000-000000000001",
  email: "ada@example.com",
  referral_code: "ADA123",
  badges: [
    {
      weekNo: 1,
      category: "creator_of_week",
      campaign_creator_id: "0f0e0d0c-0b0a-4000-8000-000000000001",
      entry_id: "0f0e0d0c-0b0a-4000-8000-000000000002",
      prize_amount_naira: 250000,
      note: "private",
    },
    { weekNo: 9, category: "creator_of_week" },
    { weekNo: 2, category: "grand_prize" },
    "not an object",
  ],
  platforms: ["tiktok", "x", "x", "facebook", { platform: "instagram" }],
};

describe("toPublicRow", () => {
  const row = toPublicRow(hostile, 4);

  it("keeps exactly the published fields", () => {
    expect(Object.keys(row).sort()).toEqual([
      "badges",
      "name",
      "platforms",
      "points",
      "previousRank",
      "rank",
      "stages",
    ]);
  });

  it("rebuilds each badge from its two allowed keys, and drops the ones that are not real", () => {
    expect(row.badges).toEqual([{ weekNo: 1, category: "creator_of_week" }]);
  });

  it("keeps known platforms only, once each, in the campaign's order", () => {
    expect(row.platforms).toEqual(["x", "tiktok"]);
  });

  it("names no forbidden field at any depth, and carries no id", () => {
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
    walk(row);
    expect(keys.filter((k) => (NEVER_PUBLISH as readonly string[]).includes(k))).toEqual([]);
    expect(JSON.stringify(row)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(JSON.stringify(row)).not.toMatch(/250000|private|ADA123|@example/);
  });

  it("trims the name and reads the numbers", () => {
    expect(row.name).toBe("Ada Obi");
    expect(row.rank).toBe(1);
    expect(row.points).toBe(350);
    expect(row.previousRank).toBe(3);
  });

  it("never says more stages than the campaign has", () => {
    // approved_entries_count is not capped by the schema; a wildcard week
    // would otherwise read "5 of 4".
    expect(toPublicRow({ ...hostile, stages: 5 }, 4).stages).toBe(4);
    expect(toPublicRow({ ...hostile, stages: -1 }, 4).stages).toBe(0);
  });

  it("reads json that arrives as text, and survives json that is not", () => {
    const fromText = toPublicRow(
      {
        ...hostile,
        badges: JSON.stringify([{ weekNo: 2, category: "community_favourite" }]),
        platforms: '["instagram"]',
      },
      4,
    );
    expect(fromText.badges).toEqual([{ weekNo: 2, category: "community_favourite" }]);
    expect(fromText.platforms).toEqual(["instagram"]);

    const broken = toPublicRow({ ...hostile, badges: "{not json", platforms: null }, 4);
    expect(broken.badges).toEqual([]);
    expect(broken.platforms).toEqual([]);
  });

  it("has no previous rank when there was none", () => {
    expect(toPublicRow({ ...hostile, previous_rank: null }, 4).previousRank).toBeNull();
    expect(toPublicRow({ ...hostile, previous_rank: 0 }, 4).previousRank).toBeNull();
  });
});
