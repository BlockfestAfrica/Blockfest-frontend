import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * The public Community Favourite count.
 *
 * The number on the winners page has to be the number the result is decided
 * on. So these drive every state a vote can be in (never verified, verified,
 * held at the domain cap, released, removed as fraud, unswept, cast for a
 * withdrawn nominee) and require the public count to agree with vote_tally,
 * the view closing, review and publishing all read.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});

const { voteBoard, currentShortlist, finalCounts, flaggedWeeks, WINNER_NEVER_PUBLISH } = await import("@/lib/winners");
const { readBoard } = await import("@/lib/vote-board");

let db: PGlite;
let campaignId: string;
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) =>
  (await db.query<T>(q, params)).rows[0];

async function entryFor(name: string, weekNo = 1) {
  const tag = ++seq;
  const person = await one<{ id: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
     VALUES ($1, $2, $2, $3, $4, 'finance') RETURNING id`,
    [name, `count${tag}@e.com`, `07${tag}`, `+2348${String(tag).padStart(9, "0")}`],
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, $3) RETURNING id`,
    [campaignId, person.id, `CNT${tag}`],
  );
  const challenge = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = $1 AND week_no = $2`,
    [campaignId, weekNo],
  );
  return (
    await one<{ id: string }>(
      `INSERT INTO challenge_entries (campaign_creator_id, challenge_id, base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
       VALUES ($1, $2, 100, 50, 100) RETURNING id`,
      [enrolment.id, challenge.id],
    )
  ).id;
}

async function round(
  weekNo: number,
  status: "draft" | "open" | "closed" | "published",
  opensAt: string,
  names: string[],
) {
  const r = await one<{ id: string }>(
    `INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at)
     VALUES ($1, $2, $3::vote_round_status, $4::timestamptz, $4::timestamptz + interval '2 days') RETURNING id`,
    [campaignId, weekNo, status, opensAt],
  );
  const nominees: string[] = [];
  for (const [index, name] of names.entries()) {
    const n = await one<{ id: string }>(
      `INSERT INTO vote_round_nominees (round_id, entry_id, display_order) VALUES ($1, $2, $3) RETURNING id`,
      [r.id, await entryFor(name, weekNo), index + 1],
    );
    nominees.push(n.id);
  }
  return { roundId: r.id, nominees };
}

type Kind = "counted" | "pending" | "held" | "fraud" | "unswept";
async function vote(roundId: string, nomineeId: string, kind: Kind) {
  const email = `voter${++seq}@e.com`;
  await db.query(
    `INSERT INTO votes (round_id, nominee_id, voter_email_canonical, verified_at, held_at,
                        status, removed_reason, removed_mode)
     VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::vote_status, $7, $8)`,
    [
      roundId,
      nomineeId,
      email,
      kind === "pending" ? null : "2026-09-27T09:00:00Z",
      kind === "held" ? "2026-09-27T09:00:00Z" : null,
      kind === "fraud" || kind === "unswept" ? "removed" : "counted",
      kind === "fraud" || kind === "unswept" ? "test" : null,
      kind === "fraud" ? "fraud" : kind === "unswept" ? "unsweep" : null,
    ],
  );
}

const counts = async () =>
  Object.fromEntries((await voteBoard())!.nominees.map((n) => [n.name, n.votes]));

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
  await db.exec(`DELETE FROM votes; DELETE FROM vote_round_nominees; DELETE FROM vote_rounds;`);
});

describe("voteBoard", () => {
  it("is nothing while no round exists", async () => {
    expect(await voteBoard()).toBeNull();
  });

  it("counts exactly what vote_tally counts, whatever state each vote is in", async () => {
    const { roundId, nominees } = await round(1, "open", "2026-09-27T08:00:00+01:00", ["Ada", "Ben"]);
    const [ada, ben] = nominees;
    await vote(roundId, ada, "counted");
    await vote(roundId, ada, "counted");
    await vote(roundId, ada, "pending");
    await vote(roundId, ada, "held");
    await vote(roundId, ada, "fraud");
    await vote(roundId, ben, "counted");
    await vote(roundId, ben, "unswept");

    expect(await counts()).toEqual({ Ada: 2, Ben: 1 });

    const official = (
      await db.query<{ nominee_id: string; votes: number }>(
        `SELECT nominee_id, votes FROM vote_tally WHERE round_id = $1`,
        [roundId],
      )
    ).rows;
    const board = (await voteBoard())!;
    for (const row of official) {
      expect(board.nominees.find((n) => n.nomineeId === row.nominee_id)?.votes).toBe(row.votes);
    }
  });

  it("moves when a held vote is released and when a counted one is removed", async () => {
    const { roundId, nominees } = await round(1, "open", "2026-09-27T08:00:00+01:00", ["Ada"]);
    await vote(roundId, nominees[0], "held");
    expect(await counts()).toEqual({ Ada: 0 });
    await db.exec(`UPDATE votes SET held_at = NULL`);
    expect(await counts()).toEqual({ Ada: 1 });
    await db.exec(`UPDATE votes SET status = 'removed', removed_reason = 'test', removed_mode = 'fraud'`);
    expect(await counts()).toEqual({ Ada: 0 });
  });

  it("leaves a withdrawn nominee off the count and off the ballot", async () => {
    const { roundId, nominees } = await round(1, "open", "2026-09-27T08:00:00+01:00", ["Ada", "Ben"]);
    await vote(roundId, nominees[1], "counted");
    await db.query(
      `UPDATE vote_round_nominees SET withdrawn_at = now(), withdrawn_reason = 'test' WHERE id = $1`,
      [nominees[1]],
    );
    expect(await counts()).toEqual({ Ada: 0 });
    expect((await currentShortlist()).map((n) => n.name)).toEqual(["Ada"]);
  });

  it("follows the latest round, stays up once it closes, and is final once published", async () => {
    await round(1, "published", "2026-09-06T08:00:00+01:00", ["Old"]);
    const { roundId } = await round(2, "open", "2026-09-13T08:00:00+01:00", ["New"]);
    let board = (await voteBoard())!;
    expect(board.weekNo).toBe(2);
    expect(board.nominees.map((n) => n.name)).toEqual(["New"]);
    expect([board.closed, board.final]).toEqual([false, false]);

    await db.query(`UPDATE vote_rounds SET status = 'closed' WHERE id = $1`, [roundId]);
    board = (await voteBoard())!;
    expect([board.weekNo, board.closed, board.final]).toEqual([2, true, false]);

    await db.query(`UPDATE vote_rounds SET status = 'published' WHERE id = $1`, [roundId]);
    board = (await voteBoard())!;
    expect([board.weekNo, board.closed, board.final]).toEqual([2, true, true]);
  });

  it("keeps last week's count up while next week's round is staged but not yet open", async () => {
    await round(1, "published", "2026-09-06T08:00:00+01:00", ["Old"]);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    await round(2, "open", tomorrow, ["New"]);
    const board = (await voteBoard())!;
    expect([board.weekNo, board.final]).toEqual([1, true]);
    expect(board.nominees.map((n) => n.name)).toEqual(["Old"]);
  });

  it("returns a staged round when it is the only one, for the page to hold back", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    await round(1, "open", tomorrow, ["Soon"]);
    expect((await voteBoard())!.opensAt).toBe(new Date(tomorrow).toISOString());
  });

  it("is flagged once a vote in the round is removed as fraud, and not for an unsweep", async () => {
    const { roundId, nominees } = await round(1, "open", "2026-09-27T08:00:00+01:00", ["Ada"]);
    await vote(roundId, nominees[0], "counted");
    expect((await voteBoard())!.flagged).toBe(false);
    await vote(roundId, nominees[0], "unswept");
    expect((await voteBoard())!.flagged).toBe(false);
    await vote(roundId, nominees[0], "fraud");
    expect((await voteBoard())!.flagged).toBe(true);
  });

  it("never shows a draft round", async () => {
    await round(1, "draft", "2026-09-27T08:00:00+01:00", ["Draft"]);
    expect(await voteBoard()).toBeNull();
  });

  it("publishes names and counts and nothing that identifies a creator or a voter", async () => {
    const { roundId, nominees } = await round(1, "open", "2026-09-27T08:00:00+01:00", ["Ada"]);
    await vote(roundId, nominees[0], "counted");
    const board = (await voteBoard())!;

    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") {
        for (const [key, inner] of Object.entries(value)) {
          keys.add(key);
          walk(inner);
        }
      }
    };
    walk(board);
    expect([...keys].sort()).toEqual(
      ["asOf", "closed", "closesAt", "final", "flagged", "name", "nomineeId", "nominees", "opensAt", "votes", "weekNo"].sort(),
    );
    const text = JSON.stringify(board);
    for (const field of WINNER_NEVER_PUBLISH) expect(keys.has(field)).toBe(false);
    expect(text).not.toContain("@");

    // And the page's reader accepts exactly this shape.
    expect(readBoard(JSON.parse(JSON.stringify({ ok: true, board })))).toEqual(board);
  });
});

describe("the count route", () => {
  const route = readFileSync(
    join(process.cwd(), "app/api/campaigns/monica/vote/count/route.ts"),
    "utf8",
  );

  it("reads the count through voteBoard and nothing else", () => {
    expect(route).toContain("voteBoard()");
    expect(route).not.toMatch(/FROM\s+votes/i);
  });

  it("is shared at the edge for less time than the page waits between asks", async () => {
    const { EDGE_SECONDS, REFRESH_MS } = await import("@/lib/vote-board");
    expect(route).toMatch(/s-maxage=\$\{EDGE_SECONDS\}/);
    expect(route).toContain("max-age=0");
    // A stale window on top would hand a page the copy it already has.
    expect(route).not.toContain("stale-while-revalidate");
    expect(EDGE_SECONDS * 1000).toBeLessThan(REFRESH_MS);
    expect(EDGE_SECONDS).toBeGreaterThanOrEqual(180);
  });

  it("reads the view the result is decided on", () => {
    const lib = readFileSync(join(process.cwd(), "lib/winners.ts"), "utf8");
    const body = lib.slice(lib.indexOf("export async function voteBoard"));
    expect(body.slice(0, body.indexOf("\n}\n"))).toMatch(/JOIN vote_tally t/);
  });
});

describe("the winners page", () => {
  const page = readFileSync(
    join(process.cwd(), "app/campaigns/monica-money-story/winners/page.tsx"),
    "utf8",
  );

  it("draws the count and stays a static, cached page", () => {
    // The count is drawn inside its week's card (weekly-winners.tsx).
    const parts = readFileSync(join(process.cwd(), "components/campaigns/weekly-winners.tsx"), "utf8");
    expect(parts).toContain("<LiveVoteCount />");
    expect(page).toContain("<WeekCard");
    expect(page).toContain("export const revalidate = 60");
    expect(page).not.toMatch(/\bcookies\(|\bheaders\(|force-dynamic/);
  });
});

describe("finalCounts", () => {
  /*
   * Each published week's count stays public once the next week's vote
   * takes the live count's place. Only published rounds (their tally is
   * final), from the same view the result was decided on.
   */
  it("keeps a published week's count, and leaves open and closed rounds out", async () => {
    const one = await round(1, "published", "2026-09-06T08:00:00+01:00", ["Ada", "Ben"]);
    await vote(one.roundId, one.nominees[0], "counted");
    await vote(one.roundId, one.nominees[0], "counted");
    await vote(one.roundId, one.nominees[0], "held");
    await vote(one.roundId, one.nominees[0], "fraud");
    await vote(one.roundId, one.nominees[1], "counted");
    const two = await round(2, "closed", "2026-09-13T08:00:00+01:00", ["Cy"]);
    await vote(two.roundId, two.nominees[0], "counted");
    await round(3, "open", "2026-09-20T08:00:00+01:00", ["Di"]);

    const finals = await finalCounts();
    expect(Object.keys(finals)).toEqual(["1"]);
    expect(finals[1].map((n) => [n.name, n.votes])).toEqual([
      ["Ada", 2],
      ["Ben", 1],
    ]);
    expect(Object.keys(finals[1][0]).sort()).toEqual(["name", "nomineeId", "votes"]);
  });
});

describe("flaggedWeeks", () => {
  /*
   * The fraud notice stays with a published week in the record. Only weeks
   * whose published round had a vote removed as fraud, and only the week.
   */
  it("names published weeks with a fraud removal, and nothing else", async () => {
    const one = await round(1, "published", "2026-09-06T08:00:00+01:00", ["Ada"]);
    await vote(one.roundId, one.nominees[0], "fraud");
    const two = await round(2, "published", "2026-09-13T08:00:00+01:00", ["Ben"]);
    await vote(two.roundId, two.nominees[0], "counted");
    const three = await round(3, "closed", "2026-09-20T08:00:00+01:00", ["Cy"]);
    await vote(three.roundId, three.nominees[0], "fraud");

    expect(await flaggedWeeks()).toEqual([1]);
  });
});

