import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { voteDomainKey } from "@/lib/vote-domain";
import { applyMigrations } from "../helpers/migrations";

/*
 * A catch-all farm, swept, stays swept.
 *
 * The first Sunday of the vote: eleven verified votes from one catch-all
 * domain (no website, every address routed to one inbox), random ten-letter
 * addresses, fourteen minutes. The cap held the eleventh. But it counted
 * only votes still counted, so removing the farm as fraud reset the domain
 * to zero and let the same person land another full cap. These pin the
 * fixes: fraud removals keep a domain capped (0068), and one console action
 * removes the votes on screen as fraud and blocks the domain (0069), so the
 * same farm cannot come straight back with fresh addresses.
 */

const state = vi.hoisted(() => ({ db: null as unknown, adminId: "" }));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
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
  sendEmail: async () => ({ sent: true }),
  sendEmailQuietly: async () => undefined,
}));

const { POST } = await import("@/app/api/admin/vote-round/route");

let db: PGlite;
let campaignId: string;
let roundId: string;
let nomineeId: string;
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) =>
  (await db.query<T>(q, params)).rows[0];

/** Cast and verify through the engine, as the public routes do. */
async function vote(email: string, allowlisted = false) {
  await db.query(
    `SELECT * FROM cast_vote('monica-money-story', $1::uuid, $2::uuid, $3, 'code', 'ip', 'ua')`,
    [roundId, nomineeId, email],
  );
  return one<{ held: boolean }>(
    `SELECT held FROM verify_vote('monica-money-story', $1::uuid, $2, 'code', 10, $3::boolean)`,
    [roundId, email, allowlisted],
  );
}

/** The same, judged under the registrable domain as the verify route does (0069). */
async function keyedVote(email: string) {
  await db.query(
    `SELECT * FROM cast_vote('monica-money-story', $1::uuid, $2::uuid, $3, 'code', 'ip', 'ua')`,
    [roundId, nomineeId, email],
  );
  return one<{ held: boolean }>(
    `SELECT held FROM verify_vote('monica-money-story', $1::uuid, $2, 'code', 10, false, $3::text)`,
    [roundId, email, voteDomainKey(email)],
  );
}

const farm = (n: number, domain = "farm.test") =>
  Array.from({ length: n }, (_, i) => `v${++seq}x${i}@${domain}`);

/**
 * The ids the console would have on screen for a domain's cluster: every
 * verified, counted vote in the round from the domain or a subdomain of it.
 */
async function onScreen(domain: string) {
  const key = voteDomainKey(domain);
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM votes
      WHERE round_id = $1 AND status = 'counted' AND verified_at IS NOT NULL
        AND vote_domain_matches(split_part(voter_email_canonical, '@', 2), $2)`,
    [roundId, key],
  );
  return rows.rows.map((r) => r.id);
}

type Answer = { ok: boolean; removed?: number; domain?: string; message?: string };

async function removeDomain(
  domain: string,
  reason = "Catch-all farm",
  voteIds?: string[],
  round = roundId,
) {
  const ids = voteIds ?? (await onScreen(domain));
  const response = await POST(
    new NextRequest("https://blockfestafrica.com/api/admin/vote-round", {
      method: "POST",
      headers: {
        origin: "https://blockfestafrica.com",
        "x-forwarded-host": "blockfestafrica.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "remove_domain",
        roundId: round,
        domain,
        reason,
        // The schema wants at least one id; a cluster with none is never shown.
        voteIds: ids.length > 0 ? ids : ["00000000-0000-4000-8000-000000000000"],
      }),
    }),
  );
  return { status: response.status, body: (await response.json()) as Answer };
}

/** What the engine stored for one address. */
const heldReason = async (email: string) =>
  (
    await one<{ held_reason: string | null }>(
      `SELECT held_reason FROM votes WHERE round_id = $1 AND voter_email_canonical = $2`,
      [roundId, email],
    )
  ).held_reason;

const counted = async (domain: string) =>
  Number(
    (
      await one<{ n: number }>(
        `SELECT count(*)::int AS n FROM countable_votes WHERE round_id = $1 AND split_part(voter_email_canonical, '@', 2) = $2`,
        [roundId, domain],
      )
    ).n,
  );

/** Counted votes from a domain and everything under it. */
const countedUnder = async (domain: string) =>
  Number(
    (
      await one<{ n: number }>(
        `SELECT count(*)::int AS n FROM countable_votes
          WHERE round_id = $1
            AND vote_domain_matches(split_part(voter_email_canonical, '@', 2), $2)`,
        [roundId, domain],
      )
    ).n,
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
     VALUES ('Ada Obi', 'ada@e.com', 'ada@e.com', '0801', '+2348010000009', 'finance') RETURNING id`,
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, 'FARM1') RETURNING id`,
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
  // Blocks are campaign-wide and outlive a round, so each test starts clean.
  await db.exec(`DELETE FROM votes; DELETE FROM audit_log; DELETE FROM vote_blocked_domains;`);
  await db.query(`UPDATE vote_rounds SET status = 'open' WHERE id = $1`, [roundId]);
});

describe("the domain cap after a sweep", () => {
  it("holds the eleventh vote from one domain, as before", async () => {
    for (const email of farm(10)) expect((await vote(email)).held).toBe(false);
    expect((await vote(farm(1)[0])).held).toBe(true);
    expect(await counted("farm.test")).toBe(10);
  });

  it("keeps a domain capped once its votes are removed as fraud", async () => {
    for (const email of farm(11)) await vote(email);
    const swept = await removeDomain("farm.test");
    expect(swept).toEqual({ status: 200, body: { ok: true, domain: "farm.test", removed: 11 } });
    expect(await counted("farm.test")).toBe(0);

    // The same person comes back with fresh addresses: every one is held,
    // first by the block the sweep left behind.
    const returning = farm(3);
    for (const email of returning) {
      expect((await vote(email)).held).toBe(true);
      expect(await heldReason(email)).toBe("blocked");
    }
    expect(await counted("farm.test")).toBe(0);

    // An owner lifts the block. The eleven removed as fraud still fill the
    // allowance of ten this round (0068), so none of the three it held is
    // released: each stays held as over the ten, which is what verify_vote
    // would have said without the block, and the unblock dialog says so. A
    // new vote is held by the cap as well.
    const { released } = await one<{ released: number }>(
      `SELECT unblock_vote_domain($1::uuid, $2::uuid, 'farm.test', 'Checked with the nominee', 10) AS released`,
      [state.adminId, campaignId],
    );
    expect(released).toBe(0);
    for (const email of returning) expect(await heldReason(email)).toBe("cap");
    const [later] = farm(1);
    expect((await vote(later)).held).toBe(true);
    expect(await heldReason(later)).toBe("cap");
    expect(await counted("farm.test")).toBe(0);
  });

  it("does not count unswept removals: those people may vote again", async () => {
    const people = farm(10, "corp.test");
    for (const email of people) await vote(email);
    for (const email of people) {
      const { id } = await one<{ id: string }>(
        `SELECT id FROM votes WHERE voter_email_canonical = $1`,
        [email],
      );
      await db.query(`SELECT remove_vote($1::uuid, $2::uuid, 'duplicate', 'unsweep')`, [state.adminId, id]);
    }
    expect((await vote(farm(1, "corp.test")[0])).held).toBe(false);
  });

  it("still leaves the big consumer providers uncapped", async () => {
    for (const email of farm(12, "gmail.com")) expect((await vote(email, true)).held).toBe(false);
  });
});

describe("removing a whole domain as fraud", () => {
  it("removes every verified vote from it, held ones included, and bars each address", async () => {
    const emails = farm(11);
    for (const email of emails) await vote(email);
    // An unverified cast from the same domain is left alone: it counts
    // nothing, and the console does not show it in the cluster.
    await db.query(
      `SELECT * FROM cast_vote('monica-money-story', $1::uuid, $2::uuid, 'pending@farm.test', 'code', 'ip', 'ua')`,
      [roundId, nomineeId],
    );

    expect((await removeDomain("farm.test")).body.removed).toBe(11);

    // And blocked, in the same act.
    const block = await one<{ source: string; reason: string }>(
      `SELECT source, reason FROM vote_blocked_domains WHERE domain = 'farm.test' AND lifted_at IS NULL`,
    );
    expect(block).toEqual({ source: "admin", reason: "Catch-all farm" });

    const rows = await db.query<{ status: string; removed_mode: string | null; removed_reason: string | null }>(
      `SELECT status::text AS status, removed_mode, removed_reason FROM votes
        WHERE voter_email_canonical LIKE '%@farm.test' AND verified_at IS NOT NULL`,
    );
    expect(rows.rows).toHaveLength(11);
    expect(rows.rows.every((r) => r.status === "removed" && r.removed_mode === "fraud" && r.removed_reason === "Catch-all farm")).toBe(true);
    const pending = await one<{ status: string }>(
      `SELECT status::text AS status FROM votes WHERE voter_email_canonical = 'pending@farm.test'`,
    );
    expect(pending.status).toBe("counted");

    // Barred: casting again from a removed address is refused as already voted.
    await expect(
      db.query(
        `SELECT * FROM cast_vote('monica-money-story', $1::uuid, $2::uuid, $3, 'code2', 'ip', 'ua')`,
        [roundId, nomineeId, emails[0]],
      ),
    ).rejects.toThrow(/already_voted/);

    // Audited once per vote, with the reason, like a single removal.
    const audit = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log WHERE action = 'vote.removed' AND note = 'Catch-all farm'`,
    );
    expect(audit.n).toBe(11);
  });

  it("touches only that domain", async () => {
    for (const email of farm(3)) await vote(email);
    for (const email of farm(2, "other.test")) await vote(email);
    expect((await removeDomain("farm.test")).body.removed).toBe(3);
    expect(await counted("other.test")).toBe(2);
  });

  it("refuses a big consumer provider", async () => {
    for (const email of farm(3, "gmail.com")) await vote(email, true);
    const answer = await removeDomain("gmail.com");
    expect(answer.status).toBe(400);
    expect(answer.body.message).toMatch(/big consumer provider/);
    expect(await counted("gmail.com")).toBe(3);
  });

  it("needs a reason and a real domain", async () => {
    expect((await removeDomain("farm.test", "   ")).status).toBe(400);
    expect((await removeDomain("not a domain")).status).toBe(400);
  });

  it("takes the subdomains with it, and nothing that only ends in the same letters", async () => {
    // The console clusters these under farm.test and the cap judges them
    // as one (0069), so the sweep has to take all of them.
    for (const email of farm(3)) await vote(email);
    for (const email of farm(2, "a.farm.test")) await vote(email);
    for (const email of farm(1, "b.c.farm.test")) await vote(email);
    for (const email of farm(2, "xfarm.test")) await vote(email);
    for (const email of farm(2, "other.test")) await vote(email);

    expect(await removeDomain("farm.test")).toEqual({
      status: 200,
      body: { ok: true, domain: "farm.test", removed: 6 },
    });
    expect(await countedUnder("farm.test")).toBe(0);
    expect(await counted("xfarm.test")).toBe(2);
    expect(await counted("other.test")).toBe(2);
  });

  it("reads a subdomain as the domain it belongs to", async () => {
    for (const email of farm(2)) await vote(email);
    for (const email of farm(2, "a.farm.test")) await vote(email);
    const answer = await removeDomain("a.farm.test", "Catch-all farm", await onScreen("farm.test"));
    expect(answer.body).toEqual({ ok: true, domain: "farm.test", removed: 4 });
    expect(await countedUnder("farm.test")).toBe(0);
  });

  it("keeps every subdomain held after the domain is swept", async () => {
    for (const email of [...farm(6), ...farm(5, "a.farm.test")]) await keyedVote(email);
    expect((await removeDomain("farm.test")).body.removed).toBe(11);
    // A new subdomain is no longer a new allowance: the block covers it.
    for (const email of farm(2, "fresh.farm.test")) {
      expect((await keyedVote(email)).held).toBe(true);
      expect(await heldReason(email)).toBe("blocked");
    }
    expect(await countedUnder("farm.test")).toBe(0);
  });

  it("refuses a public suffix, which would be every domain under it", async () => {
    for (const email of farm(2, "unilag.edu.ng")) await vote(email);
    for (const email of farm(2, "acme.com.ng")) await vote(email);
    for (const suffix of ["edu.ng", "com.ng"]) {
      const answer = await removeDomain(suffix);
      expect(answer.status).toBe(400);
      expect(answer.body.message).toBe(
        `${suffix} is a suffix many domains share, not one domain. Remove its votes one at a time.`,
      );
    }
    expect(await counted("unilag.edu.ng")).toBe(2);
    expect(await counted("acme.com.ng")).toBe(2);
  });

  it("refuses a consumer provider named by one of its subdomains", async () => {
    for (const email of farm(2, "gmail.com")) await vote(email, true);
    const answer = await removeDomain("mail.gmail.com");
    expect(answer.status).toBe(400);
    expect(answer.body.message).toMatch(/^gmail\.com is a big consumer provider/);
    expect(await counted("gmail.com")).toBe(2);
  });

  it("refuses a published round instead of answering that it removed nothing", async () => {
    for (const email of farm(3)) await vote(email);
    const ids = await onScreen("farm.test");
    await db.query(`UPDATE vote_rounds SET status = 'published' WHERE id = $1`, [roundId]);
    const answer = await removeDomain("farm.test", "Catch-all farm", ids);
    expect(answer.status).toBe(400);
    expect(answer.body).toEqual({
      ok: false,
      message: "That round's winner is announced, so its votes stay as they are.",
    });
    expect(await counted("farm.test")).toBe(3);
    // All or nothing: no block either.
    expect(
      (await one<{ n: number }>(`SELECT count(*)::int AS n FROM vote_blocked_domains`)).n,
    ).toBe(0);
  });

  it("refuses a round that does not exist", async () => {
    for (const email of farm(3)) await vote(email);
    const answer = await removeDomain(
      "farm.test",
      "Catch-all farm",
      await onScreen("farm.test"),
      "00000000-0000-4000-8000-00000000aaaa",
    );
    expect(answer).toEqual({ status: 400, body: { ok: false, message: "That round does not exist." } });
    expect(await counted("farm.test")).toBe(3);
  });

  it("removes only the votes that were on screen; one that arrived since is held by the block", async () => {
    for (const email of farm(3)) await vote(email);
    const seen = await onScreen("farm.test");
    // A vote that verified after the owner's page loaded.
    const [late] = farm(1);
    await vote(late);

    expect((await removeDomain("farm.test", "Catch-all farm", seen)).body.removed).toBe(3);
    const stored = await one<{ status: string; held: boolean; held_reason: string | null }>(
      `SELECT status::text AS status, held_at IS NOT NULL AS held, held_reason FROM votes WHERE voter_email_canonical = $1`,
      [late],
    );
    expect(stored).toEqual({ status: "counted", held: true, held_reason: "blocked" });
  });
});
