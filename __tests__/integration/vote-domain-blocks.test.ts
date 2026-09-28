import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { SQL } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { NEVER_BLOCK_DOMAINS } from "@/lib/campaign-vote";
import { UNUSABLE_EMAIL } from "@/lib/vote-domain";
import { MIGRATIONS_DIR, applyMigrations, latestDefinition } from "../helpers/migrations";

/*
 * Blocked domains, through the real routes (0069).
 *
 * The owner's ask after the first farm: a domain he has judged should be
 * turned away, and "Remove all as fraud" should leave it that way. These pin
 * each promise the console makes about a block: new casts are refused with
 * the neutral line and cost nothing (no bucket, no row, no mail), codes
 * already sent verify as held behind the same "Your vote is in.", the block
 * holds what the domain has counted in rounds nobody has reviewed and nothing
 * else, an unblock releases exactly what the block held, and no block can
 * land on a provider thousands of real voters share.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  failBlockRead: false,
  /** A SQLSTATE every block, unblock or remove call throws, as Postgres would. */
  failDomainActs: null as string | null,
  mails: [] as { to: string; subject: string; text: string }[],
  afters: [] as (() => Promise<void>)[],
}));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  return {
    ...tables,
    /*
     * The real database, except that with failBlockRead set any statement
     * that names the block table throws, the way a dropped connection would.
     * Only the cast route's own read names it: verify_vote and the admin
     * functions read it inside SQL, where this cannot reach.
     */
    getDb: () => {
      const real = state.db as { execute: (q: SQL) => Promise<unknown> };
      if (state.failDomainActs) {
        const code = state.failDomainActs;
        return new Proxy(real, {
          get(target, prop) {
            if (prop === "execute") {
              return async (q: SQL) => {
                if (/(block|unblock|remove)_vote_domain\(/.test(dialect.sqlToQuery(q).sql)) {
                  throw Object.assign(new Error("deadlock detected"), { code });
                }
                return target.execute(q);
              };
            }
            const value = Reflect.get(target, prop);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      }
      if (!state.failBlockRead) return real;
      return new Proxy(real, {
        get(target, prop) {
          if (prop === "execute") {
            return async (q: SQL) => {
              if (dialect.sqlToQuery(q).sql.includes("vote_blocked_domains")) {
                const error = new Error("socket closed reading x@oemails.com");
                error.name = "NeonDbError";
                throw error;
              }
              return target.execute(q);
            };
          }
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  };
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
  sendEmailQuietly: async (email: { to: string; subject: string; text: string }) => {
    state.mails.push({ to: email.to, subject: email.subject, text: email.text });
  },
  sendEmail: async () => ({ sent: true }),
}));
vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  return { ...real, after: (fn: () => Promise<void>) => void state.afters.push(fn) };
});

const { POST: cast } = await import("@/app/api/campaigns/monica/vote/route");
const { POST: verify } = await import("@/app/api/campaigns/monica/vote/verify/route");
const { POST: admin } = await import("@/app/api/admin/vote-round/route");

let db: PGlite;
let campaignId: string;
let roundId: string;
let nominee: string;
let entryId: string;
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) =>
  (await db.query<T>(q, params)).rows[0];

const count = async (q: string, params: unknown[] = []) =>
  Number((await one<{ n: number }>(q, params)).n);

function request(path: string, body: unknown) {
  return new NextRequest(`https://blockfestafrica.com${path}`, {
    method: "POST",
    headers: {
      origin: "https://blockfestafrica.com",
      "x-forwarded-host": "blockfestafrica.com",
      "content-type": "application/json",
      // A fresh connection per call, so the per-connection throttle never
      // decides a test about domains.
      "x-nf-client-connection-ip": `198.51.100.${++seq % 250}`,
    },
    body: JSON.stringify(body),
  });
}

/** Status, raw body and headers: "the same answer" means the same bytes. */
async function read(response: Response) {
  const raw = await response.text();
  return {
    status: response.status,
    raw,
    headers: [...response.headers.entries()].sort(),
    body: JSON.parse(raw) as Record<string, unknown>,
  };
}

const sameAnswer = (a: Awaited<ReturnType<typeof read>>, b: Awaited<ReturnType<typeof read>>) => {
  expect(a.status).toBe(b.status);
  expect(a.raw).toBe(b.raw);
  expect(a.headers).toEqual(b.headers);
};

const castAs = async (email: string) =>
  read(await cast(request("/api/campaigns/monica/vote", { roundId, nomineeId: nominee, email })));

const verifyAs = async (email: string, code: string) =>
  read(await verify(request("/api/campaigns/monica/vote/verify", { roundId, email, code })));

const console_ = async (body: Record<string, unknown>) =>
  read(await admin(request("/api/admin/vote-round", body)));

const block = (domain: string, reason = "Catch-all farm") =>
  console_({ action: "block_domain", domain, reason });

async function flush() {
  for (const fn of state.afters.splice(0)) await fn();
}

/** The code in the latest mail; the template puts it in the subject. */
const lastCode = () => {
  const mail = state.mails[state.mails.length - 1];
  return /\b(\d{6})\b/.exec(mail.subject + " " + mail.text)![1];
};

/** A round of its own, for the tests that need several. */
async function round(weekNo: number, status: string, reviewed: boolean) {
  const id = (
    await one<{ id: string }>(
      `INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at, reviewed_at)
       VALUES ($1, $2, $3::vote_round_status, now() - interval '3 days', now() - interval '1 day',
               CASE WHEN $4::boolean THEN now() ELSE NULL END)
       RETURNING id`,
      [campaignId, weekNo, status, reviewed],
    )
  ).id;
  const n = (
    await one<{ id: string }>(
      `INSERT INTO vote_round_nominees (round_id, entry_id, display_order) VALUES ($1, $2, 1) RETURNING id`,
      [id, entryId],
    )
  ).id;
  return { id, nominee: n };
}

/** A verified vote written straight in, optionally held with a reason. */
async function stored(
  email: string,
  opts: { round?: string; nominee?: string; held?: "cap" | "blocked" | "forwarder" } = {},
) {
  return (
    await one<{ id: string }>(
      `INSERT INTO votes (round_id, nominee_id, voter_email_canonical, verified_at, held_at, held_reason)
       VALUES ($1, $2, $3, now() - interval '1 hour',
               CASE WHEN $4::text IS NULL THEN NULL ELSE now() END, $4::text)
       RETURNING id`,
      [opts.round ?? roundId, opts.nominee ?? nominee, email, opts.held ?? null],
    )
  ).id;
}

const voteState = (id: string) =>
  one<{ status: string; held: boolean; held_reason: string | null }>(
    `SELECT status::text AS status, held_at IS NOT NULL AS held, held_reason FROM votes WHERE id = $1`,
    [id],
  );

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
  const person = await one<{ id: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
     VALUES ('Ada Obi', 'ada@e.com', 'ada@e.com', '0801', '+2348010000029', 'finance') RETURNING id`,
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, 'BLOCK1') RETURNING id`,
    [campaignId, person.id],
  );
  const challenge = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = $1 AND week_no = 1`,
    [campaignId],
  );
  entryId = (
    await one<{ id: string }>(
      `INSERT INTO challenge_entries (campaign_creator_id, challenge_id, base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
       VALUES ($1, $2, 100, 50, 100) RETURNING id`,
      [enrolment.id, challenge.id],
    )
  ).id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM request_throttle; DELETE FROM votes; DELETE FROM audit_log;
    DELETE FROM vote_blocked_domains; DELETE FROM vote_round_nominees; DELETE FROM vote_rounds;
    UPDATE campaigns SET paused_at = NULL, paused_reason = NULL;
  `);
  state.mails = [];
  state.afters = [];
  state.failBlockRead = false;
  state.failDomainActs = null;
  roundId = (
    await one<{ id: string }>(
      `INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at)
       VALUES ($1, 1, 'open', now() - interval '1 hour', now() + interval '1 day') RETURNING id`,
      [campaignId],
    )
  ).id;
  nominee = (
    await one<{ id: string }>(
      `INSERT INTO vote_round_nominees (round_id, entry_id, display_order) VALUES ($1, $2, 1) RETURNING id`,
      [roundId, entryId],
    )
  ).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a cast from a refused domain", () => {
  const REFUSED = JSON.stringify({ ok: false, message: UNUSABLE_EMAIL });

  it("gets the neutral line for a blocked domain and its subdomains, and costs nothing", async () => {
    expect((await block("oemails.com")).status).toBe(200);

    const bare = await castAs("hkltkjtzfm@oemails.com");
    const sub = await castAs("abc@x.oemails.com");
    expect(bare.status).toBe(400);
    expect(bare.raw).toBe(REFUSED);
    sameAnswer(sub, bare);

    // No bucket spent, no row written, no mail queued.
    expect(await count(`SELECT count(*)::int AS n FROM request_throttle`)).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM votes`)).toBe(0);
    expect(state.afters).toHaveLength(0);
    expect(state.mails).toHaveLength(0);
  });

  it("gets the same line while voting is paused, when everybody else is told to wait", async () => {
    await block("oemails.com");
    const refused = await castAs("abc@oemails.com");
    await db.query(
      `UPDATE campaigns SET paused_at = now(), paused_reason = 'Back shortly' WHERE id = $1`,
      [campaignId],
    );
    sameAnswer(await castAs("abc@oemails.com"), refused);
    expect((await castAs("someone@gmail.com")).status).toBe(503);
  });

  it("gets the same bytes for a disposable service, a subdomain of one, and an alias relay", async () => {
    await block("oemails.com");
    const blocked = await castAs("abc@oemails.com");
    for (const email of ["x@mailinator.com", "x@inbox.mailinator.com", "x@duck.com", "x@mozmail.com"]) {
      sameAnswer(await castAs(email), blocked);
    }
    expect(await count(`SELECT count(*)::int AS n FROM votes`)).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM request_throttle`)).toBe(0);
  });

  it("leaves an unblocked domain, and a lookalike of a blocked one, casting as before", async () => {
    await block("oemails.com");
    for (const email of ["a@xoemails.com", "b@acme.ng", "c@gmail.com"]) {
      const answer = await castAs(email);
      expect(answer.status, email).toBe(200);
      expect(answer.body.ok).toBe(true);
    }
  });

  it("still casts when the block read fails, and verify holds the vote", async () => {
    await block("oemails.com");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    state.failBlockRead = true;
    const answer = await castAs("abc@oemails.com");
    state.failBlockRead = false;

    expect(answer.status).toBe(200);
    expect(answer.body.ok).toBe(true);
    // The error's name only: its message carried an address.
    const logged = warn.mock.calls.map((c) => c.join(" "));
    expect(logged.some((l) => l.includes("blocked-domain read failed, casting anyway: NeonDbError"))).toBe(true);
    expect(logged.some((l) => l.includes("oemails"))).toBe(false);

    await flush();
    const verified = await verifyAs("abc@oemails.com", lastCode());
    expect(verified.body).toMatchObject({ ok: true, message: "Your vote is in." });
    expect(
      await one(`SELECT held_at IS NOT NULL AS held, held_reason FROM votes WHERE voter_email_canonical = 'abc@oemails.com'`),
    ).toEqual({ held: true, held_reason: "blocked" });
  });
});

describe("a code mailed before the block", () => {
  it("verifies with the same bytes as a counted vote, and waits as 'blocked'", async () => {
    await castAs("farmed@oemails.com");
    await flush();
    const farmedCode = lastCode();
    await castAs("real.voter@gmail.com");
    await flush();
    const realCode = lastCode();

    expect((await block("oemails.com")).body).toEqual({ ok: true, domain: "oemails.com", held: 0, already: false });

    const farmed = await verifyAs("farmed@oemails.com", farmedCode);
    const real = await verifyAs("real.voter@gmail.com", realCode);
    sameAnswer(farmed, real);
    expect(farmed.body.message).toBe("Your vote is in.");

    const rows = await db.query<{ email: string; held: boolean; held_reason: string | null }>(
      `SELECT voter_email_canonical AS email, held_at IS NOT NULL AS held, held_reason
         FROM votes ORDER BY voter_email_canonical`,
    );
    expect(rows.rows).toEqual([
      { email: "farmed@oemails.com", held: true, held_reason: "blocked" },
      { email: "realvoter@gmail.com", held: false, held_reason: null },
    ]);
    // The public tally moved for the real voter only.
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes WHERE round_id = $1`, [roundId])).toBe(1);
  });
});

describe("blocking", () => {
  it("holds the domain's counted votes in the open round and leaves reviewed and published rounds alone", async () => {
    const reviewed = await round(2, "closed", true);
    const published = await round(3, "published", true);
    const open = [await stored("a@oemails.com"), await stored("b@x.oemails.com")];
    const alreadyHeld = await stored("c@oemails.com", { held: "cap" });
    const bystander = await stored("d@acme.ng");
    const certified = await stored("e@oemails.com", { round: reviewed.id, nominee: reviewed.nominee });
    const paid = await stored("f@oemails.com", { round: published.id, nominee: published.nominee });

    const answer = await block("oemails.com", "Eleven random addresses in fourteen minutes");
    expect(answer).toMatchObject({ status: 200, body: { ok: true, domain: "oemails.com", held: 2, already: false } });

    for (const id of open) expect(await voteState(id)).toEqual({ status: "counted", held: true, held_reason: "blocked" });
    // A cap hold keeps its reason: the block did not decide it.
    expect(await voteState(alreadyHeld)).toEqual({ status: "counted", held: true, held_reason: "cap" });
    expect(await voteState(bystander)).toEqual({ status: "counted", held: false, held_reason: null });
    expect(await voteState(certified)).toEqual({ status: "counted", held: false, held_reason: null });
    expect(await voteState(paid)).toEqual({ status: "counted", held: false, held_reason: null });

    const audit = await one<{ actor: string; entity_type: string; after: { domain: string; held: number }; note: string }>(
      `SELECT actor_admin_id AS actor, entity_type, after, note FROM audit_log WHERE action = 'vote_domain.blocked'`,
    );
    expect(audit).toEqual({
      actor: state.adminId,
      entity_type: "vote_domain",
      after: { domain: "oemails.com", held: 2 },
      note: "Eleven random addresses in fourteen minutes",
    });
  });

  it("lands on the registrable domain, and refuses a public suffix or a consumer provider", async () => {
    expect((await block("x.oemails.com")).body).toEqual({ ok: true, domain: "oemails.com", held: 0, already: false });
    expect(
      await one(`SELECT domain, source FROM vote_blocked_domains WHERE lifted_at IS NULL`),
    ).toEqual({ domain: "oemails.com", source: "admin" });

    for (const suffix of ["edu.ng", "com.ng"]) {
      expect(await block(suffix)).toMatchObject({
        status: 400,
        body: { ok: false, message: "That is not a domain you can block." },
      });
    }
    for (const [typed, provider] of [
      ["gmail.com", "gmail.com"],
      ["mail.ymail.com", "ymail.com"],
      ["me.com", "me.com"],
    ]) {
      expect(await block(typed)).toMatchObject({
        status: 400,
        body: {
          ok: false,
          message: `${provider} is a big consumer provider shared by real voters, so it cannot be blocked.`,
        },
      });
    }
    expect(await count(`SELECT count(*)::int AS n FROM vote_blocked_domains`)).toBe(1);
  });

  it("needs a reason", async () => {
    expect((await block("oemails.com", "   ")).status).toBe(400);
    expect(await count(`SELECT count(*)::int AS n FROM vote_blocked_domains`)).toBe(0);
  });

  it("does nothing the second time, says it was already blocked, and does not take back a release made since", async () => {
    await stored("a@oemails.com");
    expect((await block("oemails.com")).body).toMatchObject({ held: 1, already: false });
    const { id } = await one<{ id: string }>(`SELECT id FROM votes WHERE voter_email_canonical = 'a@oemails.com'`);
    await db.query(`SELECT release_vote($1::uuid, $2::uuid)`, [state.adminId, id]);

    // The engine inserted nothing, and says so with null rather than 0, so
    // the console can say "already blocked" instead of "Blocked".
    expect((await block("oemails.com", "Again")).body).toEqual({
      ok: true,
      domain: "oemails.com",
      held: 0,
      already: true,
    });
    expect(
      await one(`SELECT block_vote_domain($1::uuid, $2::uuid, 'oemails.com', 'Third') AS held`, [
        state.adminId,
        campaignId,
      ]),
    ).toEqual({ held: null });
    expect((await voteState(id)).held).toBe(false);
    expect(await count(`SELECT count(*)::int AS n FROM vote_blocked_domains`)).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'vote_domain.blocked'`)).toBe(1);
  });
});

describe("the engine's own refusals", () => {
  it("rejects every never-block provider at the table, whoever inserts it", async () => {
    for (const domain of NEVER_BLOCK_DOMAINS) {
      await expect(
        db.query(
          `INSERT INTO vote_blocked_domains (campaign_id, domain, source, reason) VALUES ($1, $2, 'admin', 'x')`,
          [campaignId, domain],
        ),
        domain,
      ).rejects.toThrow(/vote_blocked_domain_shape/);
    }
    // And a malformed or capitalised domain.
    for (const domain of ["OEMAILS.COM", "oemails", "oemails.com.", "a b.com"]) {
      await expect(
        db.query(
          `INSERT INTO vote_blocked_domains (campaign_id, domain, source, reason) VALUES ($1, $2, 'admin', 'x')`,
          [campaignId, domain],
        ),
        domain,
      ).rejects.toThrow(/vote_blocked_domain_shape/);
    }
  });

  it("keeps the SQL never-block list and lib/campaign-vote's the same list", () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, "0069_vote_domain_hardening.sql"), "utf8");
    const body = sql.slice(sql.indexOf("FUNCTION vote_domain_never_block"));
    const array = body.slice(body.indexOf("ARRAY["), body.indexOf("])"));
    const inSql = [...array.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect([...inSql].sort()).toEqual([...NEVER_BLOCK_DOMAINS].sort());
  });

  it("refuses to block a never-block provider by name, before touching anything", async () => {
    await expect(
      db.query(`SELECT block_vote_domain($1::uuid, $2::uuid, 'gmail.com', 'x')`, [state.adminId, campaignId]),
    ).rejects.toThrow(/domain_not_blockable/);
  });
});

describe("unblocking", () => {
  it("releases the block's holds and the forwarding holds, and nothing else", async () => {
    const reviewed = await round(2, "closed", true);
    await block("oemails.com");
    const blocked = await stored("a@oemails.com", { held: "blocked" });
    const forwarded = await stored("b@x.oemails.com", { held: "forwarder" });
    const capped = await stored("c@oemails.com", { held: "cap" });
    const certified = await stored("d@oemails.com", {
      round: reviewed.id,
      nominee: reviewed.nominee,
      held: "blocked",
    });

    const answer = await console_({
      action: "unblock_domain",
      domain: "oemails.com",
      reason: "A real school club, confirmed with the nominee",
    });
    expect(answer).toMatchObject({ status: 200, body: { ok: true, domain: "oemails.com", released: 2 } });

    expect((await voteState(blocked)).held).toBe(false);
    expect((await voteState(forwarded)).held).toBe(false);
    expect(await voteState(capped)).toEqual({ status: "counted", held: true, held_reason: "cap" });
    expect((await voteState(certified)).held).toBe(true);

    // The row stays, as the record of who lifted it and why.
    expect(
      await one(
        `SELECT lifted_at IS NOT NULL AS lifted, lifted_by_admin_id AS by, lifted_reason FROM vote_blocked_domains`,
      ),
    ).toEqual({ lifted: true, by: state.adminId, lifted_reason: "A real school club, confirmed with the nominee" });
    // Audited once for the unblock, and once for each vote it released.
    expect(await count(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'vote_domain.unblocked'`)).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'vote.released'`)).toBe(2);

    // And the domain casts again.
    const later = await castAs("new.voter@oemails.com");
    expect(later.status).toBe(200);
    expect(later.body.ok).toBe(true);
  });

  it("releases only up to the domain's allowance of ten, oldest first, and keeps the rest held as over it", async () => {
    // Fifteen verified while blocked: the block held them before the cap
    // was ever counted, so none of them is a 'cap' hold.
    await block("oemails.com");
    const held: string[] = [];
    for (let i = 0; i < 15; i++) {
      held.push(
        (
          await one<{ id: string }>(
            `INSERT INTO votes (round_id, nominee_id, voter_email_canonical, verified_at, held_at, held_reason, created_at)
             VALUES ($1, $2, $3, now() - interval '1 hour', now(), 'blocked', now() - ($4::int * interval '1 minute'))
             RETURNING id`,
            [roundId, nominee, `v${i}@oemails.com`, 15 - i],
          )
        ).id,
      );
    }

    const answer = await console_({ action: "unblock_domain", domain: "oemails.com", reason: "Real club" });
    expect(answer).toMatchObject({ status: 200, body: { ok: true, domain: "oemails.com", released: 10 } });

    // The ten oldest count; the five after them wait as over the ten.
    for (const id of held.slice(0, 10)) {
      expect(await voteState(id)).toEqual({ status: "counted", held: false, held_reason: "blocked" });
    }
    for (const id of held.slice(10)) {
      expect(await voteState(id)).toEqual({ status: "counted", held: true, held_reason: "cap" });
    }
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes WHERE round_id = $1`, [roundId])).toBe(10);
    expect(await count(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'vote.released'`)).toBe(10);
    expect(
      await one(`SELECT after FROM audit_log WHERE action = 'vote_domain.unblocked'`),
    ).toEqual({ after: { domain: "oemails.com", released: 10, over_cap: 5 } });
  });

  it("counts what the domain already used in each round, fraud removals included, round by round", async () => {
    const week2 = await round(2, "open", false);
    await block("oemails.com");
    // This round: four still counting and three removed as fraud use seven
    // of the ten, so three of the five held come back.
    for (let i = 0; i < 4; i++) await stored(`c${i}@oemails.com`);
    for (let i = 0; i < 3; i++) {
      const id = await stored(`f${i}@oemails.com`);
      await db.query(`SELECT remove_vote($1::uuid, $2::uuid, 'farm', 'fraud')`, [state.adminId, id]);
    }
    for (let i = 0; i < 5; i++) await stored(`h${i}@x.oemails.com`, { held: "blocked" });
    // Another round has its own ten: both of its holds come back.
    for (let i = 0; i < 2; i++) {
      await stored(`w${i}@oemails.com`, { round: week2.id, nominee: week2.nominee, held: "forwarder" });
    }

    const answer = await console_({ action: "unblock_domain", domain: "oemails.com", reason: "Real club" });
    expect(answer.body.released).toBe(5);
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes WHERE round_id = $1`, [roundId])).toBe(7);
    expect(
      await count(`SELECT count(*)::int AS n FROM votes WHERE round_id = $1 AND held_reason = 'cap' AND held_at IS NOT NULL`, [roundId]),
    ).toBe(2);
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes WHERE round_id = $1`, [week2.id])).toBe(2);
  });

  it("says a domain is not blocked any more, instead of pretending to lift it", async () => {
    const answer = await console_({ action: "unblock_domain", domain: "oemails.com", reason: "x" });
    expect(answer).toMatchObject({
      status: 400,
      body: { ok: false, message: "That domain is not blocked any more. Reload to see the current list." },
    });
  });

  it("lets the same domain be blocked again later, as a new row", async () => {
    await block("oemails.com");
    await console_({ action: "unblock_domain", domain: "oemails.com", reason: "Mistake" });
    expect((await block("oemails.com", "It was a farm after all")).status).toBe(200);
    expect(await count(`SELECT count(*)::int AS n FROM vote_blocked_domains`)).toBe(2);
    expect(await count(`SELECT count(*)::int AS n FROM vote_blocked_domains WHERE lifted_at IS NULL`)).toBe(1);
  });
});

describe("remove all as fraud", () => {
  const removeAll = (domain: string, voteIds: string[], reason = "Catch-all farm") =>
    console_({ action: "remove_domain", roundId, domain, reason, voteIds });

  it("removes only the listed votes, bars each address, and blocks the domain", async () => {
    const listed = [await stored("a@oemails.com"), await stored("b@x.oemails.com")];
    const unlisted = await stored("c@oemails.com");
    const elsewhere = await stored("d@acme.ng");

    // An id from another domain is ignored, not removed.
    const answer = await removeAll("oemails.com", [...listed, elsewhere]);
    expect(answer).toMatchObject({ status: 200, body: { ok: true, domain: "oemails.com", removed: 2 } });

    for (const id of listed) expect((await voteState(id)).status).toBe("removed");
    expect(await voteState(unlisted)).toEqual({ status: "counted", held: true, held_reason: "blocked" });
    expect(await voteState(elsewhere)).toEqual({ status: "counted", held: false, held_reason: null });
    expect(await count(`SELECT count(*)::int AS n FROM vote_blocked_domains WHERE domain = 'oemails.com'`)).toBe(1);

    // Barred: the engine refuses a fresh cast from a removed address.
    await expect(
      db.query(
        `SELECT * FROM cast_vote('monica-money-story', $1::uuid, $2::uuid, 'a@oemails.com', 'code', 'ip', 'ua')`,
        [roundId, nominee],
      ),
    ).rejects.toThrow(/already_voted/);
  });

  it("changes nothing at all for a never-block provider", async () => {
    const ids = [await stored("a@ymail.com"), await stored("b@ymail.com"), await stored("c@ymail.com")];

    // The route says why.
    expect(await removeAll("ymail.com", ids)).toMatchObject({
      status: 400,
      body: { ok: false, message: "ymail.com is a big consumer provider shared by real voters. Remove its votes one at a time." },
    });
    // And the engine refuses on its own, before removing any of them.
    await expect(
      db.query(
        `SELECT remove_vote_domain($1::uuid, $2::uuid, 'ymail.com', 'x', $3::uuid[])`,
        [state.adminId, roundId, ids],
      ),
    ).rejects.toThrow(/domain_not_blockable/);
    for (const id of ids) expect((await voteState(id)).status).toBe("counted");
    expect(await count(`SELECT count(*)::int AS n FROM vote_blocked_domains`)).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM audit_log`)).toBe(0);
  });

  it("undoes its removals when the block at the end is refused", async () => {
    // A direct call with a malformed domain gets past the never-block check
    // and fails at the table's CHECK, after the removals ran: they roll back.
    const id = await stored("a@bad_domain.test");
    await expect(
      db.query(
        `SELECT remove_vote_domain($1::uuid, $2::uuid, 'bad_domain.test', 'x', $3::uuid[])`,
        [state.adminId, roundId, [id]],
      ),
    ).rejects.toThrow(/vote_blocked_domain_shape/);
    expect((await voteState(id)).status).toBe("counted");
  });
});

describe("the console's answers when an act cannot go through", () => {
  it("says another owner is acting on the domain when Postgres breaks a deadlock, and leaves a trace", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    state.failDomainActs = "40P01";
    for (const body of [
      { action: "block_domain", domain: "oemails.com", reason: "x" },
      { action: "unblock_domain", domain: "oemails.com", reason: "x" },
      {
        action: "remove_domain",
        roundId,
        domain: "oemails.com",
        reason: "x",
        voteIds: ["11111111-1111-4111-8111-111111111111"],
      },
    ]) {
      expect(await console_(body), body.action).toMatchObject({
        status: 409,
        body: { ok: false, message: "Another owner is acting on this domain right now. Reload and try again." },
      });
    }
    // A deadlock means a lock-order bug somewhere; it must reach the logs.
    expect(warn).toHaveBeenCalled();
  });

  it("takes a cluster of five hundred in one removal, which the shared four-kilobyte limit refused", async () => {
    const listed = [await stored("a@oemails.com"), await stored("b@oemails.com")];
    const voteIds = [
      ...listed,
      ...Array.from({ length: 498 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`),
    ];
    expect(
      await console_({ action: "remove_domain", roundId, domain: "oemails.com", reason: "Farm", voteIds }),
    ).toMatchObject({ status: 200, body: { ok: true, domain: "oemails.com", removed: 2 } });
  });

  it("tells an owner with a cluster over five hundred that it is too many, not to reload", async () => {
    const voteIds = Array.from(
      { length: 501 },
      (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
    );
    expect(
      await console_({ action: "remove_domain", roundId, domain: "oemails.com", reason: "Farm", voteIds }),
    ).toMatchObject({
      status: 400,
      body: { ok: false, message: "That is more than five hundred votes, too many to remove in one go." },
    });
    expect(await count(`SELECT count(*)::int AS n FROM vote_blocked_domains`)).toBe(0);
  });
});

/*
 * The lock order, read off the SQL.
 *
 * PGlite has one connection, so two owners acting at once cannot be staged
 * here. The races were run on a throwaway local Postgres 15 with every
 * migration applied: before these orders, Unblock against Block deadlocked
 * in 46 of 50 simultaneous trials and against Remove all in 25 of 50, a
 * release racing an Unblock failed it with P0819, a review committing while
 * a Block or Unblock waited let the certified tally move, and a verify
 * waiting on its lock across the grace landed in a reviewed round. After
 * them: 0 of 50 and 0 of 50, the Unblock skipped the released vote, the
 * review waited for the act, and the verify was refused P0814. What can be
 * pinned here is the order itself, in the definitions that ship.
 */
describe("the locks, in the order that keeps two owners from deadlocking", () => {
  // The live definition, whichever migration holds it.
  const body = (name: string) => latestDefinition(name);

  it("has Unblock take every round's lock before it touches the block's row, as Block does", () => {
    const unblock = body("unblock_vote_domain");
    const lock = unblock.indexOf("pg_advisory_xact_lock");
    const row = unblock.indexOf("UPDATE vote_blocked_domains");
    expect(lock).toBeGreaterThan(0);
    expect(row).toBeGreaterThan(lock);
    // The same key as Block's, so the two queue on the same locks.
    const key = "hashtextextended('vote-domain:' || v_round::text || ':' || v_domain, 0)";
    expect(unblock).toContain(key);
    expect(body("block_vote_domain")).toContain(key);
    // And no lock taken per round inside the release loop, after the row.
    expect(unblock.indexOf("pg_advisory_xact_lock", row)).toBe(-1);
  });

  it("has Unblock lock its candidates and read them again, rather than fail on one already released", () => {
    const unblock = body("unblock_vote_domain");
    const candidates = unblock.slice(unblock.indexOf("v_votes := ARRAY("), unblock.indexOf("PERFORM release_vote"));
    expect(candidates).toMatch(/held_at IS NOT NULL/);
    expect(candidates).toMatch(/FOR UPDATE OF v/);
  });

  it("has Block, Unblock and Remove all hold the rounds FOR SHARE before any lock, and read them again", () => {
    for (const name of ["block_vote_domain", "unblock_vote_domain", "remove_vote_domain"]) {
      const fn = body(name);
      const share = fn.indexOf("FOR SHARE");
      const lock = fn.indexOf("pg_advisory_xact_lock");
      expect(share, name).toBeGreaterThan(0);
      expect(lock, name).toBeGreaterThan(share);
      // Read again between the two, once the rows are held.
      const between = fn.slice(share, lock);
      expect(between, name).toMatch(/reviewed_at IS NULL/);
      expect(between, name).toMatch(/status <> 'published'/);
    }
  });

  it("has verify_vote read its round's state again once it holds the domain's lock", () => {
    const verify = body("verify_vote");
    const lock = verify.indexOf("pg_advisory_xact_lock");
    const recheck = verify.indexOf("SELECT * INTO r FROM vote_rounds", lock);
    expect(recheck).toBeGreaterThan(lock);
    const after = verify.slice(recheck, verify.indexOf("END IF;", recheck));
    expect(after).toMatch(/r\.reviewed_at IS NOT NULL OR r\.status = 'published'/);
    expect(after).toMatch(/RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814'/);
  });
});
