import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { ALLOWLISTED_DOMAINS, hashCode } from "@/lib/campaign-vote";
import { voteDomainKey } from "@/lib/vote-domain";
import { MIGRATIONS_DIR, applyMigrations, migrationFiles } from "../helpers/migrations";

/*
 * One registrable domain, one allowance of ten (0069).
 *
 * After 0068 a farm could still spread itself over subdomains: the cap, the
 * fraud count and "Remove all" all keyed on the full host, so a.oemails.com,
 * b.oemails.com and c.oemails.com each got a fresh ten, and a red team
 * counted thirty after the parent had been swept. These pin the key: the
 * verify route passes the registrable domain, the engine counts every host
 * under it, a key that is not this host or a parent of it falls back to the
 * host, and the old six-argument call keeps working while a deploy rolls
 * out.
 *
 * The lock that stops parallel verifies racing past the cap cannot be
 * exercised here: PGlite has one connection, so nothing runs in parallel.
 * The red team's run on a local Postgres is the evidence (twelve to sixteen
 * counted against a cap of ten without it, exactly ten with it). What can be
 * pinned is that the lock is taken before the tally, which is the whole of
 * what makes it work.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});
vi.mock("@/lib/email/client", () => ({
  sendEmail: async () => ({ sent: true }),
  sendEmailQuietly: async () => undefined,
}));

const { POST: verifyRoute } = await import("@/app/api/campaigns/monica/vote/verify/route");

let db: PGlite;
let campaignId: string;
let adminId: string;
let roundId: string;
let nomineeId: string;
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) =>
  (await db.query<T>(q, params)).rows[0];

const CODE = "123456";

/** A pending vote with a code the verify route will accept. */
async function cast(email: string) {
  await db.query(
    `SELECT * FROM cast_vote('monica-money-story', $1::uuid, $2::uuid, $3, $4, 'ip', 'ua')`,
    [roundId, nomineeId, email, hashCode(email, CODE)],
  );
}

/** Cast, then verify through the real route, as a voter does. */
async function voteThroughRoute(email: string) {
  await cast(email);
  const response = await verifyRoute(
    new NextRequest("https://blockfestafrica.com/api/campaigns/monica/vote/verify", {
      method: "POST",
      headers: {
        origin: "https://blockfestafrica.com",
        "x-forwarded-host": "blockfestafrica.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ roundId, email, code: CODE }),
    }),
  );
  expect(response.status).toBe(200);
  return stored(email);
}

type Verdict = { vote_id: string; held: boolean; auto_blocked: boolean };

/** Cast, then verify through the engine with an explicit key. */
async function vote(email: string, key: string | null = voteDomainKey(email)) {
  await cast(email);
  return one<Verdict>(
    `SELECT * FROM verify_vote('monica-money-story', $1::uuid, $2, $3, 10, false, $4::text)`,
    [roundId, email, hashCode(email, CODE), key],
  );
}

/** What the engine stored for one address. */
const stored = (email: string) =>
  one<{ held: boolean; held_reason: string | null }>(
    `SELECT held_at IS NOT NULL AS held, held_reason FROM votes
      WHERE round_id = $1 AND voter_email_canonical = $2 AND verified_at IS NOT NULL`,
    [roundId, email],
  );

const addresses = (n: number, host: string) =>
  Array.from({ length: n }, () => `v${++seq}@${host}`);

async function removeAsFraud(email: string) {
  const { id } = await one<{ id: string }>(
    `SELECT id FROM votes WHERE round_id = $1 AND voter_email_canonical = $2`,
    [roundId, email],
  );
  await db.query(`SELECT remove_vote($1::uuid, $2::uuid, 'Catch-all farm', 'fraud')`, [adminId, id]);
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  campaignId = (
    await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)
  ).id;
  adminId = (
    await one<{ id: string }>(
      `INSERT INTO admin_users (email, email_canonical, password_hash, role)
       VALUES ('owner@example.test', 'owner@example.test', 'x', 'owner') RETURNING id`,
    )
  ).id;
  const person = await one<{ id: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
     VALUES ('Ada Obi', 'ada@e.com', 'ada@e.com', '0801', '+2348010000019', 'finance') RETURNING id`,
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, 'KEY1') RETURNING id`,
    [campaignId, person.id],
  );
  const challenge = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = $1 AND week_no = 1`,
    [campaignId],
  );
  const entry = await one<{ id: string }>(
    `INSERT INTO challenge_entries (campaign_creator_id, challenge_id, base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
     VALUES ($1, $2, 100, 50, 100) RETURNING id`,
    [enrolment.id, challenge.id],
  );
  roundId = (
    await one<{ id: string }>(
      `INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at)
       VALUES ($1, 1, 'open', now() - interval '1 hour', now() + interval '1 day') RETURNING id`,
      [campaignId],
    )
  ).id;
  nomineeId = (
    await one<{ id: string }>(
      `INSERT INTO vote_round_nominees (round_id, entry_id, display_order) VALUES ($1, $2, 1) RETURNING id`,
      [roundId, entry.id],
    )
  ).id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM votes; DELETE FROM audit_log; DELETE FROM request_throttle;`);
});

describe("the cap keys on the registrable domain", () => {
  it("holds the eleventh vote across subdomains, through the verify route, as 'cap'", async () => {
    const ten = [
      ...addresses(4, "a.oemails.com"),
      ...addresses(3, "b.oemails.com"),
      ...addresses(3, "oemails.com"),
    ];
    for (const email of ten) {
      expect(await voteThroughRoute(email)).toEqual({ held: false, held_reason: null });
    }
    // A fresh subdomain used to mean a fresh ten.
    const [eleventh] = addresses(1, "c.oemails.com");
    expect(await voteThroughRoute(eleventh)).toEqual({ held: true, held_reason: "cap" });
  });

  it("keeps a subdomain's fraud removals in the parent's allowance", async () => {
    // Swept: ten from one subdomain, removed as fraud. Before 0069 the
    // parent and every sibling still had a full ten of their own.
    const swept = addresses(10, "a.oemails.com");
    for (const email of swept) expect((await vote(email)).held).toBe(false);
    for (const email of swept) await removeAsFraud(email);

    expect((await vote(addresses(1, "oemails.com")[0])).held).toBe(true);
    expect((await vote(addresses(1, "b.oemails.com")[0])).held).toBe(true);
    const [last] = addresses(1, "x.y.oemails.com");
    expect((await vote(last)).held).toBe(true);
    expect(await stored(last)).toEqual({ held: true, held_reason: "cap" });
  });

  it("does not count a lookalike that only ends in the same letters", async () => {
    for (const email of addresses(10, "oemails.com")) await vote(email);
    // xoemails.com is somebody else's domain, not a subdomain.
    expect((await vote(addresses(1, "xoemails.com")[0])).held).toBe(false);
  });

  it("answers vote_id, held and auto_blocked, and leaves a counted vote without a reason", async () => {
    const [email] = addresses(1, "oemails.com");
    const verdict = await vote(email);
    expect(Object.keys(verdict).sort()).toEqual(["auto_blocked", "held", "vote_id"]);
    expect(verdict.held).toBe(false);
    expect(verdict.auto_blocked).toBe(false);
    expect(await stored(email)).toEqual({ held: false, held_reason: null });
  });
});

describe("a key the engine does not trust", () => {
  it("falls back to the host when the key is somebody else's domain", async () => {
    // Ten gmail.com votes counted. Judged under gmail.com, the next
    // oemails.com vote would be held; judged under its own host, it counts.
    for (const email of addresses(10, "gmail.com")) {
      await cast(email);
      await db.query(
        `SELECT * FROM verify_vote('monica-money-story', $1::uuid, $2, $3, 10, true, 'gmail.com')`,
        [roundId, email, hashCode(email, CODE)],
      );
    }
    expect((await vote("x@oemails.com", "gmail.com")).held).toBe(false);

    // And the other way round: oemails.com full, the untrusted key does not
    // let x2 slip out from under it.
    for (const email of addresses(9, "oemails.com")) await vote(email);
    expect((await vote("x2@oemails.com", "gmail.com")).held).toBe(true);
  });

  it("falls back to the host, not the parent, so the old per-host rule is the floor", async () => {
    for (const email of addresses(10, "a.oemails.com")) await vote(email);
    expect((await vote(addresses(1, "b.oemails.com")[0], "gmail.com")).held).toBe(false);
    expect((await vote(addresses(1, "b.oemails.com")[0], "oemails.com")).held).toBe(true);
  });

  it("falls back to the host for a missing key or a bare top-level label", async () => {
    for (const email of addresses(10, "a.oemails.com")) await vote(email);
    // "com" is a parent of every .com host; taken on trust it would pool
    // every .com voter into one allowance.
    expect((await vote(addresses(1, "b.oemails.com")[0], "com")).held).toBe(false);
    expect((await vote(addresses(1, "b.oemails.com")[0], null)).held).toBe(false);
    expect((await vote(addresses(1, "b.oemails.com")[0], "")).held).toBe(false);
  });
});

describe("the six-argument call the old code makes", () => {
  it("still caps, judges its own host, and answers only vote_id and held", async () => {
    const six = async (email: string) => {
      await cast(email);
      return one<{ vote_id: string; held: boolean }>(
        `SELECT * FROM verify_vote('monica-money-story', $1::uuid, $2, $3, 10, false)`,
        [roundId, email, hashCode(email, CODE)],
      );
    };
    for (const email of addresses(10, "farm.test")) expect((await six(email)).held).toBe(false);
    const [eleventh] = addresses(1, "farm.test");
    const verdict = await six(eleventh);
    expect(Object.keys(verdict).sort()).toEqual(["held", "vote_id"]);
    expect(verdict.held).toBe(true);
    expect(await stored(eleventh)).toEqual({ held: true, held_reason: "cap" });
    // Its key is the host, so a subdomain is still its own allowance there,
    // exactly as before this migration.
    expect((await six(addresses(1, "a.farm.test")[0])).held).toBe(false);
  });
});

describe("the schema behind the key", () => {
  it("refuses a held reason nothing sets", async () => {
    const [email] = addresses(1, "oemails.com");
    await vote(email);
    await expect(
      db.query(`UPDATE votes SET held_reason = 'hunch' WHERE voter_email_canonical = $1`, [email]),
    ).rejects.toThrow(/vote_held_reason_known/);
  });

  it("matches a host to its key by whole labels only", async () => {
    const cases: [string, string, boolean][] = [
      ["oemails.com", "oemails.com", true],
      ["a.oemails.com", "oemails.com", true],
      ["a.b.oemails.com", "oemails.com", true],
      ["xoemails.com", "oemails.com", false],
      ["oemails.com", "a.oemails.com", false],
      ["oemails_com", "oemails%com", false],
    ];
    for (const [host, key, expected] of cases) {
      const { m } = await one<{ m: boolean }>(`SELECT vote_domain_matches($1, $2) AS m`, [host, key]);
      expect(m, `${host} under ${key}`).toBe(expected);
    }
  });

  it("never lets a block land on a provider the cap exempts", async () => {
    for (const domain of ALLOWLISTED_DOMAINS) {
      const { n } = await one<{ n: boolean }>(`SELECT vote_domain_never_block($1) AS n`, [domain]);
      expect(n, domain).toBe(true);
    }
    const { n } = await one<{ n: boolean }>(`SELECT vote_domain_never_block('oemails.com') AS n`);
    expect(n).toBe(false);
  });

  it("marks every helper IMMUTABLE, so an index or a CHECK may use it", async () => {
    const rows = await db.query<{ proname: string; provolatile: string }>(
      `SELECT proname, provolatile FROM pg_proc
        WHERE proname IN ('vote_domain_matches', 'vote_domain_protected',
                          'vote_domain_never_block', 'vote_local_looks_generated')`,
    );
    expect(rows.rows.map((r) => r.proname).sort()).toEqual([
      "vote_domain_matches",
      "vote_domain_never_block",
      "vote_domain_protected",
      "vote_local_looks_generated",
    ]);
    expect(rows.rows.every((r) => r.provolatile === "i")).toBe(true);
  });
});

describe("the lock", () => {
  /** The last verify_vote definition in the migrations, comments removed. */
  function latestVerifyVote(): string {
    let latest = "";
    for (const file of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      for (const match of sql.matchAll(/CREATE OR REPLACE FUNCTION verify_vote\s*\(/g)) {
        const from = match.index ?? 0;
        const bodyAt = sql.indexOf("$$", sql.indexOf("LANGUAGE", from));
        latest = sql.slice(from, sql.indexOf("$$;", bodyAt) + 3);
      }
    }
    return latest.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
  }

  it("is taken before the domain's votes are counted", () => {
    const body = latestVerifyVote();
    expect(body).toMatch(/p_domain_key\s+text/);
    const lock = body.indexOf("pg_advisory_xact_lock");
    const tally = body.indexOf("count(*)");
    expect(lock).toBeGreaterThan(-1);
    expect(tally).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(tally);
    // After this vote's own row lock and the code check, so a wrong code
    // never queues behind a domain.
    expect(body.indexOf("FOR UPDATE")).toBeLessThan(lock);
    expect(body.lastIndexOf("code_invalid")).toBeLessThan(lock);
  });
});
