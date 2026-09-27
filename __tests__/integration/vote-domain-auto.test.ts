import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { SQL } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import type { AdminIdentity } from "@/lib/admin/session";
import { UNUSABLE_EMAIL, classifyVoteDomain, mxKind, primaryMx, type MxRecord } from "@/lib/vote-domain";
import { isProtectedDomain } from "@/lib/vote-domain-copy";
import { MIGRATIONS_DIR, applyMigrations } from "../helpers/migrations";

/*
 * Automatic action on a vote farm's domain, through the real routes (0069).
 *
 * The incident: eleven random addresses at one catch-all domain, verified in
 * fourteen minutes, with nobody watching. These pin what now happens without
 * a person: the domain's mail host is classified when a code is cast and
 * stored before the code is mailed; a forwarding service's votes are held
 * from the first; the third verified vote from a forwarding service, or
 * three machine-made addresses making up most of an ordinary domain's votes,
 * blocks the domain and tells the owners; and the voter hears the same bytes
 * throughout. And what does not happen: no school or government domain, no
 * consumer provider, no domain the owner vouched for, and no lookup that
 * failed ever moves a vote.
 *
 * DNS is injected. The resolver the cast route uses is replaced below, and
 * the suite's setup file refuses every real lookup besides.
 */

type Fake = MxRecord[] | { code: string };

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  failMxTable: false,
  mx: {} as Record<string, MxRecord[] | { code: string }>,
  dnsCalls: [] as string[],
  mails: [] as { to: string; subject: string; text: string; html: string; context: string }[],
  afters: [] as (() => Promise<void>)[],
  onCodeMail: null as null | ((to: string) => Promise<void>),
}));

/** The injected resolver: the answers a test set, and ENOTFOUND for anything else. */
async function fakeResolve(domain: string): Promise<MxRecord[]> {
  state.dnsCalls.push(domain);
  const answer = state.mx[domain];
  if (!answer) throw Object.assign(new Error(`queryMx ENOTFOUND ${domain}`), { code: "ENOTFOUND" });
  if (!Array.isArray(answer)) throw Object.assign(new Error(`queryMx ${answer.code}`), { code: answer.code });
  return answer;
}

vi.mock("@/lib/vote-domain", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/vote-domain")>();
  return { ...real, systemResolveMx: (domain: string) => fakeResolve(domain) };
});
vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  return {
    ...tables,
    /*
     * The real database, except that with failMxTable set any statement that
     * names the mail-host cache throws, the way a dropped connection would.
     * Only the classifier's own reads and writes name it from Node.
     */
    getDb: () => {
      const real = state.db as { execute: (q: SQL) => Promise<unknown> };
      if (!state.failMxTable) return real;
      return new Proxy(real, {
        get(target, prop) {
          if (prop === "execute") {
            return async (q: SQL) => {
              if (dialect.sqlToQuery(q).sql.includes("vote_domain_mx")) {
                const error = new Error("socket closed reading oemails.com");
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
  sendEmailQuietly: async (
    email: { to: string; subject: string; text: string; html: string },
    context: string,
  ) => {
    if (context === "vote code" && state.onCodeMail) await state.onCodeMail(email.to);
    state.mails.push({ to: email.to, subject: email.subject, text: email.text, html: email.html, context });
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
const { blockedDomains, roundTally } = await import("@/lib/admin/vote-round");

/** Seven of the eight incident local parts look machine-made; this one does not. */
const INCIDENT = ["hkltkjtzfm", "ofpdliyxth", "dbfudkndvt", "ufnttqzyqk", "xzrmhsixpz", "aljlpyqkic", "lxdmsjcmye"];
const CLOUDFLARE: MxRecord[] = [
  { exchange: "route2.mx.cloudflare.net.", priority: 43 },
  { exchange: "route1.mx.cloudflare.net.", priority: 12 },
  { exchange: "route3.mx.cloudflare.net.", priority: 90 },
];
const GOOGLE: MxRecord[] = [
  { exchange: "alt1.aspmx.l.google.com.", priority: 5 },
  { exchange: "aspmx.l.google.com.", priority: 1 },
];
const SELF_HOSTED: MxRecord[] = [{ exchange: "mail.farmhouse.com.", priority: 10 }];

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

async function flush() {
  while (state.afters.length > 0) {
    for (const fn of state.afters.splice(0)) await fn();
  }
}

/** The code in the latest code mail to this address; the template puts it in the subject. */
function codeFor(email: string) {
  const mail = state.mails.filter((m) => m.context === "vote code" && m.to === email).at(-1);
  if (!mail) throw new Error(`no code mail to ${email}`);
  return /\b(\d{6})\b/.exec(mail.subject)![1];
}

/** Cast, run what the cast left for after the response (lookup, then mail), and verify. */
async function vote(email: string) {
  await castAs(email);
  await flush();
  const answer = await verifyAs(email, codeFor(email));
  await flush();
  return answer;
}

const mxRow = (domain: string) =>
  one<{ kind: string; primary_mx: string | null }>(
    `SELECT kind, primary_mx FROM vote_domain_mx WHERE domain = $1`,
    [domain],
  );

const held = (domain: string) =>
  db
    .query<{ local: string; held: boolean; held_reason: string | null }>(
      `SELECT split_part(voter_email_canonical, '@', 1) AS local,
              held_at IS NOT NULL AS held, held_reason
         FROM votes
        WHERE split_part(voter_email_canonical, '@', 2) = $1
        ORDER BY created_at`,
      [domain],
    )
    .then((r) => r.rows);

const tally = () =>
  count(`SELECT count(*)::int AS n FROM countable_votes WHERE round_id = $1`, [roundId]);

const blocks = () =>
  db
    .query<{ domain: string; source: string; lifted: boolean }>(
      `SELECT domain, source, lifted_at IS NOT NULL AS lifted FROM vote_blocked_domains ORDER BY created_at`,
    )
    .then((r) => r.rows);

const ownerMails = () => state.mails.filter((m) => m.context === "domain auto-block alert");

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
  await db.query(
    `INSERT INTO admin_users (email, email_canonical, password_hash, role)
     VALUES ('reviewer@example.test', 'reviewer@example.test', 'x', 'reviewer')`,
  );
  const person = await one<{ id: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
     VALUES ('Ada Obi', 'ada@e.com', 'ada@e.com', '0801', '+2348010000031', 'finance') RETURNING id`,
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, 'AUTO01') RETURNING id`,
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
    DELETE FROM vote_blocked_domains; DELETE FROM vote_domain_mx;
    DELETE FROM vote_round_nominees; DELETE FROM vote_rounds;
    UPDATE campaigns SET paused_at = NULL, paused_reason = NULL;
  `);
  state.mails = [];
  state.afters = [];
  state.dnsCalls = [];
  state.failMxTable = false;
  state.onCodeMail = null;
  state.mx = {
    "oemails.com": CLOUDFLARE,
    "workspace-farm.com": GOOGLE,
    "farmhouse.com": SELF_HOSTED,
    "slowns.com": { code: "ETIMEOUT" },
  };
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

describe("classifying a voting domain's mail host", () => {
  it("stores the answer before the code is mailed", async () => {
    let atMail: unknown = "the code mail never went";
    state.onCodeMail = async () => {
      atMail = await mxRow("oemails.com");
    };

    const answer = await castAs("hkltkjtzfm@oemails.com");
    // Nothing is looked up while the voter waits.
    expect(state.dnsCalls).toEqual([]);
    expect(answer.body.ok).toBe(true);

    await flush();
    expect(state.dnsCalls).toEqual(["oemails.com"]);
    expect(atMail).toEqual({ kind: "forwarder", primary_mx: "route1.mx.cloudflare.net" });
  });

  it("looks up the registrable domain, once, for every subdomain under it", async () => {
    await castAs("a@x.oemails.com");
    await castAs("b@y.oemails.com");
    await flush();
    expect(state.dnsCalls).toEqual(["oemails.com"]);
  });

  it("names the kind from the host mail actually goes to", async () => {
    const cases: [string, Fake, string, string | null][] = [
      ["a1.com", CLOUDFLARE, "forwarder", "route1.mx.cloudflare.net"],
      ["a2.com", [{ exchange: "mx1.improvmx.com.", priority: 10 }], "forwarder", "mx1.improvmx.com"],
      ["a3.com", [{ exchange: "eforward3.registrar-servers.com", priority: 10 }], "forwarder", "eforward3.registrar-servers.com"],
      ["a4.com", [{ exchange: "fwd1.porkbun.com", priority: 10 }], "forwarder", "fwd1.porkbun.com"],
      // Mail hosted by a temp-mail service the public list names.
      ["a5.com", [{ exchange: "mail.generator.email.", priority: 10 }], "forwarder", "mail.generator.email"],
      // The lowest preference wins, whatever order DNS answers in.
      ["a6.com", GOOGLE, "major", "aspmx.l.google.com"],
      ["a7.com", [{ exchange: "acme-ng.mail.protection.outlook.com", priority: 0 }], "major", "acme-ng.mail.protection.outlook.com"],
      ["a8.com", [{ exchange: "mail.x.com", priority: 10 }], "other", "mail.x.com"],
      // Cloudflare's other hosts are not its forwarding service.
      ["a9.com", [{ exchange: "isaac.mx.cloudflare.net", priority: 10 }], "other", "isaac.mx.cloudflare.net"],
      // A domain that takes no mail, or does not exist, is an answer.
      ["b1.com", { code: "ENOTFOUND" }, "other", null],
      ["b2.com", { code: "ENODATA" }, "other", null],
      // A lookup that failed is not.
      ["b3.com", { code: "ETIMEOUT" }, "unknown", null],
      ["b4.com", { code: "ESERVFAIL" }, "unknown", null],
      ["b5.com", { code: "EREFUSED" }, "unknown", null],
    ];
    for (const [domain, answer, kind, primary] of cases) {
      state.mx[domain] = answer;
      expect(await classifyVoteDomain(domain, { resolveMx: fakeResolve }), domain).toEqual({
        kind,
        primaryMx: primary,
      });
      expect(await mxRow(domain), domain).toEqual({ kind, primary_mx: primary });
    }
  });

  it("asks again after five minutes for an unknown answer, and after a day for a known one", async () => {
    await classifyVoteDomain("slowns.com", { resolveMx: fakeResolve });
    await classifyVoteDomain("slowns.com", { resolveMx: fakeResolve });
    expect(state.dnsCalls).toEqual(["slowns.com"]);

    await db.query(`UPDATE vote_domain_mx SET checked_at = now() - interval '6 minutes'`);
    state.mx["slowns.com"] = SELF_HOSTED;
    expect(await classifyVoteDomain("slowns.com", { resolveMx: fakeResolve })).toEqual({
      kind: "other",
      primaryMx: "mail.farmhouse.com",
    });
    expect(state.dnsCalls).toEqual(["slowns.com", "slowns.com"]);

    await db.query(`UPDATE vote_domain_mx SET checked_at = now() - interval '23 hours'`);
    await classifyVoteDomain("slowns.com", { resolveMx: fakeResolve });
    expect(state.dnsCalls).toHaveLength(2);
    await db.query(`UPDATE vote_domain_mx SET checked_at = now() - interval '25 hours'`);
    await classifyVoteDomain("slowns.com", { resolveMx: fakeResolve });
    expect(state.dnsCalls).toHaveLength(3);
  });

  it("asks nothing about a consumer provider or a school or government domain", async () => {
    for (const email of [
      "someone@gmail.com",
      "someone@ymail.com",
      "student@unilag.edu.ng",
      "student@live.unilag.edu.ng",
      "officer@nysc.gov.ng",
    ]) {
      expect((await castAs(email)).status, email).toBe(200);
    }
    await flush();
    expect(state.dnsCalls).toEqual([]);
    expect(await count(`SELECT count(*)::int AS n FROM vote_domain_mx`)).toBe(0);
    expect(state.mails.filter((m) => m.context === "vote code")).toHaveLength(5);
  });

  it("never throws or names the domain when the cache cannot be reached, and the code still goes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    state.failMxTable = true;
    await castAs("hkltkjtzfm@oemails.com");
    await flush();
    state.failMxTable = false;

    expect(codeFor("hkltkjtzfm@oemails.com")).toMatch(/^\d{6}$/);
    const logged = warn.mock.calls.map((c) => c.join(" "));
    expect(logged.some((l) => l.includes("mail host lookup failed, leaving the domain to the cap: NeonDbError"))).toBe(true);
    expect(logged.some((l) => l.includes("oemails"))).toBe(false);
  });

  it("cannot reach real DNS from this suite, even through the unmocked resolver", async () => {
    const actual = await vi.importActual<typeof import("@/lib/vote-domain")>("@/lib/vote-domain");
    await expect(actual.systemResolveMx("oemails.com")).rejects.toMatchObject({ code: "EREFUSED" });
  });
});

describe("a forwarding service", () => {
  it("has its first vote held quietly, and the public count does not move", async () => {
    const counted = await vote("real.voter@gmail.com");
    const farmed = await vote("hkltkjtzfm@oemails.com");

    sameAnswer(farmed, counted);
    expect(farmed.body.message).toBe("Your vote is in.");
    expect(await held("oemails.com")).toEqual([
      { local: "hkltkjtzfm", held: true, held_reason: "forwarder" },
    ]);
    expect(await tally()).toBe(1);
    expect(await blocks()).toEqual([]);
  });

  it("is blocked at its third verified vote, with no address in the evidence, and the fourth cast is refused", async () => {
    await vote(`${INCIDENT[0]}@oemails.com`);
    await vote(`${INCIDENT[1]}@a.oemails.com`);
    expect(await blocks()).toEqual([]);
    await vote(`${INCIDENT[2]}@oemails.com`);

    expect(await blocks()).toEqual([{ domain: "oemails.com", source: "auto", lifted: false }]);
    const row = await one<{ reason: string; evidence: Record<string, unknown>; created_by_admin_id: string | null }>(
      `SELECT reason, evidence, created_by_admin_id FROM vote_blocked_domains`,
    );
    expect(row.created_by_admin_id).toBeNull();
    expect(row.reason).toBe("Forwarding service (route1.mx.cloudflare.net), 3 verified votes this round");
    expect(Object.keys(row.evidence).sort()).toEqual(
      ["first_at", "kind", "last_at", "machine_made", "primary_mx", "round_id", "verified"],
    );
    expect(row.evidence).toMatchObject({
      round_id: roundId,
      kind: "forwarder",
      primary_mx: "route1.mx.cloudflare.net",
      verified: 3,
      machine_made: 3,
    });
    const text = JSON.stringify(row.evidence) + row.reason;
    expect(text).not.toContain("@");
    for (const local of INCIDENT) expect(text).not.toContain(local);

    // Held from the first, so nothing ever counted.
    expect((await held("oemails.com")).every((v) => v.held)).toBe(true);
    expect(await tally()).toBe(0);

    const fourth = await castAs(`${INCIDENT[3]}@oemails.com`);
    expect(fourth.status).toBe(400);
    expect(fourth.raw).toBe(JSON.stringify({ ok: false, message: UNUSABLE_EMAIL }));
  });

  it("counts a fraud removal toward the three, so a sweep does not reset the evidence", async () => {
    await vote(`${INCIDENT[0]}@oemails.com`);
    await vote(`${INCIDENT[1]}@oemails.com`);
    const ids = (await db.query<{ id: string }>(`SELECT id FROM votes`)).rows.map((r) => r.id);
    for (const id of ids) {
      await db.query(`SELECT remove_vote($1, $2, 'Farm', 'fraud')`, [state.adminId, id]);
    }
    await vote(`${INCIDENT[2]}@oemails.com`);
    expect(await blocks()).toEqual([{ domain: "oemails.com", source: "auto", lifted: false }]);
  });

  it("is not held on a school domain, even with a forwarding host on record", async () => {
    // Never looked up (the classifier skips school domains), so the row is
    // planted to prove the engine refuses it on its own.
    await db.query(
      `INSERT INTO vote_domain_mx (domain, kind, primary_mx) VALUES ('unilag.edu.ng', 'forwarder', 'route1.mx.cloudflare.net')`,
    );
    for (const local of INCIDENT.slice(0, 4)) await vote(`${local}@live.unilag.edu.ng`);

    expect((await held("live.unilag.edu.ng")).some((v) => v.held)).toBe(false);
    expect(await blocks()).toEqual([]);
    expect(await tally()).toBe(4);
  });

  it("is neither held nor blocked again once the owner has unblocked it", async () => {
    expect(
      (await console_({ action: "block_domain", domain: "oemails.com", reason: "Looked like a farm" })).status,
    ).toBe(200);
    expect(
      (await console_({ action: "unblock_domain", domain: "oemails.com", reason: "A real team, on Cloudflare" })).status,
    ).toBe(200);

    for (const local of INCIDENT.slice(0, 4)) await vote(`${local}@oemails.com`);

    expect((await held("oemails.com")).some((v) => v.held)).toBe(false);
    expect(await blocks()).toEqual([{ domain: "oemails.com", source: "admin", lifted: true }]);
    expect(await tally()).toBe(4);
    expect(ownerMails()).toEqual([]);
  });
});

describe("machine-made addresses on an ordinary mail host", () => {
  it("block the domain at the third, holding all three; two do not", async () => {
    await vote(`${INCIDENT[0]}@farmhouse.com`);
    await vote(`${INCIDENT[1]}@farmhouse.com`);
    expect(await blocks()).toEqual([]);
    expect(await tally()).toBe(2);

    await vote(`${INCIDENT[2]}@farmhouse.com`);
    expect(await blocks()).toEqual([{ domain: "farmhouse.com", source: "auto", lifted: false }]);
    expect(await held("farmhouse.com")).toEqual(
      INCIDENT.slice(0, 3).map((local) => ({ local, held: true, held_reason: "blocked" })),
    );
    expect(await tally()).toBe(0);
    expect(
      (await one<{ reason: string }>(`SELECT reason FROM vote_blocked_domains`)).reason,
    ).toBe("3 of 3 verified addresses look machine-made");
  });

  it("do not block a domain where they are under 60% of the votes", async () => {
    for (const local of ["adaobi", "chidinma.okafor", "tunde2024"]) await vote(`${local}@farmhouse.com`);
    for (const local of INCIDENT.slice(0, 3)) await vote(`${local}@farmhouse.com`);

    expect(await blocks()).toEqual([]);
    expect(await tally()).toBe(6);
  });

  it("do nothing on Google or Microsoft hosting, where the cap still applies", async () => {
    for (const local of INCIDENT.slice(0, 5)) await vote(`${local}@workspace-farm.com`);
    expect(await blocks()).toEqual([]);
    expect(await tally()).toBe(5);
  });

  it("do nothing when the lookup failed", async () => {
    for (const local of INCIDENT.slice(0, 4)) await vote(`${local}@slowns.com`);
    expect(await mxRow("slowns.com")).toEqual({ kind: "unknown", primary_mx: null });
    expect(await blocks()).toEqual([]);
    expect(await tally()).toBe(4);
  });
});

describe("telling the owners", () => {
  it("writes the audit row with no actor, and mails every active owner once with no voter address in it", async () => {
    // Four codes out before the block: the fourth verifies after it.
    for (const local of INCIDENT.slice(0, 4)) await castAs(`${local}@oemails.com`);
    await flush();
    for (const local of INCIDENT.slice(0, 4)) {
      await verifyAs(`${local}@oemails.com`, codeFor(`${local}@oemails.com`));
      await flush();
    }

    const audit = await db.query<{ actor: string | null; after: Record<string, unknown>; note: string }>(
      `SELECT actor_admin_id AS actor, after, note FROM audit_log WHERE action = 'vote_domain.auto_blocked'`,
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].actor).toBeNull();
    expect(audit.rows[0].after).toMatchObject({ domain: "oemails.com", kind: "forwarder", verified: 3 });

    const owners = (
      await db.query<{ email: string }>(
        `SELECT email FROM admin_users WHERE is_active AND role = 'owner' ORDER BY email`,
      )
    ).rows.map((r) => r.email);
    expect(owners).toContain("owner@example.test");
    const mails = ownerMails();
    expect(mails.map((m) => m.to).sort()).toEqual(owners);
    expect(mails.map((m) => m.to)).not.toContain("reviewer@example.test");

    for (const mail of mails) {
      expect(mail.subject).toBe("A voting domain was blocked automatically: oemails.com");
      expect(mail.text).toContain("Forwarding service (route1.mx.cloudflare.net), 3 verified votes this round.");
      expect(mail.text).toContain("3 votes from it are held for you to review this round.");
      expect(mail.text).toMatch(/They were verified between .+ and .+, Lagos time\./);
      expect(mail.text).toContain("https://blockfestafrica.com/admin/winners#blocked-domains");
      const everything = `${mail.subject} ${mail.text} ${mail.html}`;
      expect(everything).not.toContain("@oemails.com");
      for (const local of INCIDENT) expect(everything).not.toContain(local);
    }

    // The fourth code verified after the block: held, and no second mail.
    expect(await held("oemails.com")).toContainEqual({
      local: INCIDENT[3],
      held: true,
      held_reason: "blocked",
    });
    expect(ownerMails()).toHaveLength(owners.length);
  });

  it("answers the verify that fired with the same bytes as the one before it", async () => {
    await vote(`${INCIDENT[0]}@oemails.com`);
    const second = await vote(`${INCIDENT[1]}@oemails.com`);
    const third = await vote(`${INCIDENT[2]}@oemails.com`);
    const plain = await vote("real.voter@gmail.com");

    expect(ownerMails().length).toBeGreaterThan(0);
    sameAnswer(third, second);
    sameAnswer(third, plain);
  });
});

describe("the console", () => {
  const identity = { adminId: "", role: "owner", email: "owner@example.test" } as unknown as AdminIdentity;

  it("shows an automatic block with its evidence, and tags the forwarding service on its cluster", async () => {
    for (const local of INCIDENT.slice(0, 3)) await vote(`${local}@oemails.com`);
    await vote(`${INCIDENT[0]}@farmhouse.com`);

    const [card] = await blockedDomains(identity);
    expect(card).toMatchObject({
      domain: "oemails.com",
      source: "auto",
      evidence: "Forwarding service (route1.mx.cloudflare.net), 3 verified votes this round",
      createdByAdminId: null,
      held: 3,
    });

    const { domains } = await roundTally(identity, roundId);
    expect(domains.map((d) => [d.domain, d.block, d.mxKind])).toEqual([
      ["oemails.com", "auto", "forwarder"],
      ["farmhouse.com", null, "other"],
    ]);
  });
});

describe("the engine", () => {
  const body = (name: string) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, "0069_vote_domain_hardening.sql"), "utf8");
    const at = sql.lastIndexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
    return sql.slice(at, sql.indexOf("END $$;", at));
  };

  it("decides the automatic block after this vote is written and under its lock", () => {
    const verify = body("verify_vote");
    const lock = verify.indexOf("pg_advisory_xact_lock");
    const write = verify.indexOf("UPDATE votes");
    const decide = verify.indexOf("vote_domain_auto_block(");
    expect(lock).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(lock);
    expect(decide).toBeGreaterThan(write);
  });

  it("has an owner's block take the round locks before it writes the block row", () => {
    // Row first would deadlock with a verify holding a round lock while it
    // blocks the same domain automatically.
    const block = body("block_vote_domain");
    expect(block.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(0);
    expect(block.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      block.indexOf("INSERT INTO vote_blocked_domains"),
    );
  });

  it("knows a school or government domain exactly as the console does", async () => {
    for (const domain of [
      "unilag.edu.ng", "uniben.edu", "nysc.gov.ng", "ox.ac.uk", "abc.sch.ng", "army.mil",
      "cbn.gov.ng", "live.unilag.edu.ng", "oemails.com", "education.ng", "edu.com",
      "gov.farm.test", "edu.ng", "sch.ng.com", "ac.uk", "mygov.com",
    ]) {
      const { p } = await one<{ p: boolean }>(`SELECT vote_domain_protected($1) AS p`, [domain]);
      expect(p, domain).toBe(isProtectedDomain(domain));
    }
  });

  it("tests the whole local part for a machine-made look", async () => {
    const cases: [string, boolean][] = [
      ...INCIDENT.map((l) => [l, true] as [string, boolean]),
      ["cuacftsitm", false], // the one incident address with vowels enough
      ["johnsmith", true], // a real name can pass; the 60% share is what spares it
      ["chidinmaokafor", false],
      ["adebayo", false], // under eight letters
      ["190805123", false],
      ["jdoe19", false],
      ["olamide.b", false],
      ["hkltkjtzfm1", false], // digits never pass
      ["hkltk.jtzfm", false], // nor dots
      ["", false],
    ];
    for (const [local, expected] of cases) {
      const { g } = await one<{ g: boolean }>(`SELECT vote_local_looks_generated($1) AS g`, [local]);
      expect(g, local).toBe(expected);
    }
  });
});

describe("the mail-host rules in Node", () => {
  it("takes the lowest preference, lowercased and without its dot", () => {
    expect(primaryMx(CLOUDFLARE)).toBe("route1.mx.cloudflare.net");
    expect(primaryMx([{ exchange: "ASPMX.L.GOOGLE.COM.", priority: 1 }])).toBe("aspmx.l.google.com");
    expect(primaryMx([])).toBeNull();
    // A null MX ("0 .") takes no mail.
    expect(primaryMx([{ exchange: "", priority: 0 }])).toBeNull();
  });

  it("knows each forwarding service and big mailbox host, and nothing looser", () => {
    for (const host of [
      "route1.mx.cloudflare.net", "route87.mx.cloudflare.net", "mx1.improvmx.com", "mx.forwardemail.net",
      "eforward1.registrar-servers.com", "fwd2.porkbun.com", "mx1.simplelogin.co", "mx2.addy.io",
      "mx.generator.email",
    ]) {
      expect(mxKind(host), host).toBe("forwarder");
    }
    for (const host of [
      "aspmx.l.google.com", "alt3.aspmx.l.google.com", "aspmx2.googlemail.com", "smtp.google.com",
      "acme.mail.protection.outlook.com", "mta7.am0.yahoodns.net", "mx01.mail.icloud.com",
      "mail.protonmail.ch", "mailsec.protonmail.ch",
    ]) {
      expect(mxKind(host), host).toBe("major");
    }
    for (const host of [
      "mx.cloudflare.net", "isaac.mx.cloudflare.net", "route.mx.cloudflare.net.evil.com",
      "aspmx.l.google.com.evil.com", "smtp.dnsexit.com", "mail.oemails.com",
    ]) {
      expect(mxKind(host), host).toBe("other");
    }
    expect(mxKind(null)).toBe("other");
  });
});
