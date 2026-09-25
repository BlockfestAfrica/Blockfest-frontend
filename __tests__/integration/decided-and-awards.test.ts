import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import type { AdminIdentity } from "@/lib/admin/session";
import { applyMigrations } from "../helpers/migrations";
import { holdChallengeOpen } from "../helpers/challenge-window";

/*
 * The two things the console could not answer.
 *
 * "Where is the link I approved?" The Decided page showed who decided and
 * when, but never the post, and only the newest fifty. And "have I already
 * given them this bonus?" The award form showed nothing that had been given
 * before, so the only record was somebody's memory.
 *
 * These run the real queries, through drizzle, against the real schema, so
 * the SQL behind both answers is exercised rather than restated in the test.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});

const { decidedSubmissions, decidedCounts } = await import("@/lib/admin/review");
const { participants } = await import("@/lib/admin/participants");

/** The functions only require that the guard ran; the type is the proof. */
const ADMIN = { adminId: "unused", email: "a@e.com", role: "owner" } as unknown as AdminIdentity;

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

async function makeCreator(name: string, handle: string) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('${name}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  await db.query(`
    INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized, verified_at)
    VALUES ('${creator.id}', 'x', '${handle}', '${handle}', now())`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return enrolment.id;
}

/** File a submission for a week and decide it. Returns the entry and submission. */
async function decide(
  enrolment: string,
  weekNo: number,
  url: string,
  decision: "approved" | "rejected",
) {
  const challenge = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = ${weekNo}`,
  );
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${enrolment}', '${challenge.id}', 100, 100, 200)
    ON CONFLICT (campaign_creator_id, challenge_id) DO UPDATE SET updated_at = now()
    RETURNING id`);
  const sub = await one<{ id: string }>(`
    INSERT INTO submissions (entry_id, platform, url)
    VALUES ('${entry.id}', 'x', '${url}') RETURNING id`);
  await db.query(
    `SELECT review($1::uuid, $2::submission_status, $3::uuid, $4)`,
    [sub.id, decision, adminId, decision === "rejected" ? "Not on the brief" : null],
  );
  return { entryId: entry.id, submissionId: sub.id };
}

const award = (
  enrolment: string,
  source: string,
  points: number,
  note: string,
  entry: string | null = null,
) =>
  db.query(
    `SELECT * FROM award_points($1::uuid, $2::ledger_source, $3::integer, $4::text, $5::uuid, $6::uuid)`,
    [enrolment, source, points, note, adminId, entry],
  );

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM audit_log; DELETE FROM referrals; DELETE FROM point_ledger;
    DELETE FROM submissions; DELETE FROM challenge_entries;
    DELETE FROM creator_social_handles; DELETE FROM campaign_creators;
    DELETE FROM creators;
  `);
  campaignId = (
    await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)
  ).id;
  adminId = (
    await one<{ id: string }>(
      `SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`,
    )
  ).id;
  await holdChallengeOpen(db, 1);
  await holdChallengeOpen(db, 2);
});

describe("the Decided page's query", () => {
  it("returns the link that was decided on", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    await decide(ada, 1, "https://x.com/adawrites/status/111", "approved");

    const rows = await decidedSubmissions(ADMIN);
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe("https://x.com/adawrites/status/111");
    expect(rows[0].status).toBe("approved");
    expect(rows[0].creatorName).toBe("Ada Obi");
  });

  it("filters by decision and by week, in SQL", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    const ben = await makeCreator("Ben Eze", "benmoney");
    await decide(ada, 1, "https://x.com/adawrites/status/1", "approved");
    await decide(ben, 1, "https://x.com/benmoney/status/2", "rejected");
    await decide(ben, 2, "https://x.com/benmoney/status/3", "approved");

    const approved = await decidedSubmissions(ADMIN, { status: "approved" });
    expect(approved.map((r) => r.url).sort()).toEqual([
      "https://x.com/adawrites/status/1",
      "https://x.com/benmoney/status/3",
    ]);

    const weekOne = await decidedSubmissions(ADMIN, { weekNo: 1 });
    expect(weekOne).toHaveLength(2);

    const rejectedWeekOne = await decidedSubmissions(ADMIN, {
      status: "rejected",
      weekNo: 1,
    });
    expect(rejectedWeekOne.map((r) => r.creatorName)).toEqual(["Ben Eze"]);
  });

  it("finds a decision by name, by handle, or by part of the link", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    const ben = await makeCreator("Ben Eze", "benmoney");
    await decide(ada, 1, "https://x.com/adawrites/status/555", "approved");
    await decide(ben, 1, "https://x.com/benmoney/status/777", "approved");

    expect((await decidedSubmissions(ADMIN, { search: "obi" })).map((r) => r.creatorName)).toEqual(["Ada Obi"]);
    expect((await decidedSubmissions(ADMIN, { search: "benmon" })).map((r) => r.creatorName)).toEqual(["Ben Eze"]);
    expect((await decidedSubmissions(ADMIN, { search: "status/555" })).map((r) => r.creatorName)).toEqual(["Ada Obi"]);
  });

  it("treats % and _ in a search as the characters typed", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    await decide(ada, 1, "https://x.com/adawrites/status/9", "approved");

    // Unescaped, a lone % matches every row and _ matches any one character.
    expect(await decidedSubmissions(ADMIN, { search: "%" })).toEqual([]);
    expect(await decidedSubmissions(ADMIN, { search: "ada_rites" })).toEqual([]);
  });

  it("never returns what is still waiting", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    const challenge = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    );
    const entry = await one<{ id: string }>(`
      INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
        base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
      VALUES ('${ada}', '${challenge.id}', 100, 100, 200) RETURNING id`);
    await db.query(`
      INSERT INTO submissions (entry_id, platform, url)
      VALUES ('${entry.id}', 'x', 'https://x.com/adawrites/status/4')`);

    expect(await decidedSubmissions(ADMIN)).toEqual([]);
  });

  it("counts every decision, not the page", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    const ben = await makeCreator("Ben Eze", "benmoney");
    await decide(ada, 1, "https://x.com/adawrites/status/1", "approved");
    await decide(ben, 1, "https://x.com/benmoney/status/2", "rejected");
    await decide(ben, 2, "https://x.com/benmoney/status/3", "approved");

    expect(await decidedCounts(ADMIN)).toEqual({ approved: 2, rejected: 1 });
    // A page of one still counts the whole.
    expect(await decidedSubmissions(ADMIN, { limit: 1 })).toHaveLength(1);
  });
});

describe("what the award panel knows was already given", () => {
  it("lists each bonus with who gave it, why, and when", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    await award(ada, "quality_bonus", 50, "Outstanding storytelling");

    const [row] = await participants(ADMIN, { slug: "monica-money-story" });
    expect(row.awards).toHaveLength(1);
    expect(row.awards[0]).toMatchObject({
      source: "quality_bonus",
      points: 50,
      note: "Outstanding storytelling",
      by: "partnership@blockfestafrica.com",
      entryId: null,
      weekNo: null,
    });
    expect(row.awards[0].at).toBeInstanceOf(Date);
    expect(Number.isNaN(row.awards[0].at.getTime())).toBe(false);
  });

  it("keeps a take-back as its own row, so the net is visible", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    await award(ada, "quality_bonus", 50, "Outstanding storytelling");
    await award(ada, "quality_bonus", -50, "Given twice by mistake");

    const [row] = await participants(ADMIN, { slug: "monica-money-story" });
    expect(row.awards.map((a) => a.points).sort((a, b) => a - b)).toEqual([-50, 50]);
    expect(row.awards.reduce((t, a) => t + a.points, 0)).toBe(0);
  });

  it("ties an engagement bonus to the week of the entry that earned it", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    const { entryId } = await decide(ada, 1, "https://x.com/adawrites/status/1", "approved");
    await award(ada, "engagement_milestone", 40, "Crossed 10K views", entryId);

    const [row] = await participants(ADMIN, { slug: "monica-money-story" });
    expect(row.awards).toHaveLength(1);
    expect(row.awards[0]).toMatchObject({
      source: "engagement_milestone",
      entryId,
      weekNo: 1,
    });
  });

  it("leaves out what the engine awards, which nobody gave by hand", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    await decide(ada, 1, "https://x.com/adawrites/status/1", "approved");

    const [row] = await participants(ADMIN, { slug: "monica-money-story" });
    expect(row.points, "the approval did pay").toBeGreaterThan(0);
    expect(row.awards).toEqual([]);
  });

  it("is per creator", async () => {
    const ada = await makeCreator("Ada Obi", "adawrites");
    const ben = await makeCreator("Ben Eze", "benmoney");
    await award(ada, "quality_bonus", 50, "Outstanding storytelling");

    const rows = await participants(ADMIN, { slug: "monica-money-story" });
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.awards.length]));
    expect(byName).toEqual({ "Ada Obi": 1, "Ben Eze": 0 });
    void ben;
  });
});
