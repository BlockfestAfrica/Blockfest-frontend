import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * A second vote from the same address, through the real routes.
 *
 * Owner report: voted, got the code, confirmed; tried again and the page
 * said a code was on its way, and none ever came. That silence is the
 * design (a distinct answer would let anybody with a list of addresses ask
 * who has voted), but the page never said so, so a person who had already
 * voted sat waiting for a mail and then typed codes that could only fail.
 *
 * The fix is words, not a new branch: the one answer everybody gets now
 * says plainly that an address that already voted gets no new code. These
 * pin both halves. The words are there, and the answer is still byte for
 * byte the same for a new voter, a confirmed voter, a held vote and a
 * barred address, with no mail for any of the last three.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  mails: [] as { to: string; subject: string; text: string }[],
  afters: [] as (() => Promise<void>)[],
}));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
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

let db: PGlite;
let campaignId: string;
let roundId: string;
let nominees: string[];
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) =>
  (await db.query<T>(q, params)).rows[0];

function request(path: string, body: unknown, ip: string) {
  return new NextRequest(`https://blockfestafrica.com${path}`, {
    method: "POST",
    headers: {
      origin: "https://blockfestafrica.com",
      "x-forwarded-host": "blockfestafrica.com",
      "content-type": "application/json",
      // A fresh connection per call, so the per-address-and-connection
      // throttle never decides a test about wording.
      "x-nf-client-connection-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

const ip = () => `198.51.100.${++seq % 250}`;

async function castAs(email: string, nominee = nominees[0]) {
  const response = await cast(
    request("/api/campaigns/monica/vote", { roundId, nomineeId: nominee, email }, ip()),
  );
  return { status: response.status, body: await response.json() };
}

async function verifyAs(email: string, code: string) {
  const response = await verify(
    request("/api/campaigns/monica/vote/verify", { roundId, email, code }, ip()),
  );
  return { status: response.status, body: await response.json() };
}

async function flush() {
  for (const fn of state.afters.splice(0)) await fn();
}

async function entry() {
  const tag = ++seq;
  const person = await one<{ id: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
     VALUES ($1, $2, $2, $3, $4, 'finance') RETURNING id`,
    [`Nominee ${tag}`, `nominee${tag}@e.com`, `08${tag}`, `+2347${String(tag).padStart(9, "0")}`],
  );
  const enrolment = await one<{ id: string }>(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code) VALUES ($1, $2, $3) RETURNING id`,
    [campaignId, person.id, `AV${tag}`],
  );
  const challenge = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = $1 AND week_no = 1`,
    [campaignId],
  );
  return (
    await one<{ id: string }>(
      `INSERT INTO challenge_entries (campaign_creator_id, challenge_id, base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
       VALUES ($1, $2, 100, 50, 100) RETURNING id`,
      [enrolment.id, challenge.id],
    )
  ).id;
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  campaignId = (
    await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)
  ).id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(
    `DELETE FROM request_throttle; DELETE FROM votes; DELETE FROM vote_round_nominees; DELETE FROM vote_rounds;`,
  );
  state.mails = [];
  state.afters = [];
  roundId = (
    await one<{ id: string }>(
      `INSERT INTO vote_rounds (campaign_id, week_no, status, opens_at, closes_at)
       VALUES ($1, 1, 'open', now() - interval '1 hour', now() + interval '1 day') RETURNING id`,
      [campaignId],
    )
  ).id;
  nominees = [];
  for (const order of [1, 2]) {
    nominees.push(
      (
        await one<{ id: string }>(
          `INSERT INTO vote_round_nominees (round_id, entry_id, display_order) VALUES ($1, $2, $3) RETURNING id`,
          [roundId, await entry(), order],
        )
      ).id,
    );
  }
});

describe("the answer to a cast", () => {
  it("tells everybody that an address which already voted gets no new code", async () => {
    const first = await castAs("new.voter@gmail.com");
    expect(first.status).toBe(200);
    expect(first.body.message).toMatch(/a six digit code is on its way/);
    expect(first.body.message).toMatch(
      /If it has already voted, no new code will come and there is nothing more to do/,
    );
    expect(first.body.message).toMatch(/a confirmed vote cannot be changed/);
  });

  it("is the same answer, with no mail, once the address has confirmed a vote", async () => {
    const fresh = await castAs("ada.obi@gmail.com");
    await flush();
    expect(state.mails).toHaveLength(1);
    const code = /\b(\d{6})\b/.exec(state.mails[0].subject + " " + state.mails[0].text)![1];
    expect((await verifyAs("ada.obi@gmail.com", code)).body.ok).toBe(true);
    state.mails = [];
    await flush();

    // The same nominee, another nominee, and another spelling of the address.
    for (const [email, nominee] of [
      ["ada.obi@gmail.com", nominees[0]],
      ["ada.obi@gmail.com", nominees[1]],
      ["AdaObi+again@gmail.com", nominees[1]],
    ] as const) {
      const again = await castAs(email, nominee);
      expect(again.status).toBe(fresh.status);
      expect(again.body).toEqual(fresh.body);
    }
    expect(state.afters).toHaveLength(0);
    expect(state.mails).toHaveLength(0);
  });

  it("is the same answer for a held vote and a barred address, so neither is told which it is", async () => {
    const fresh = await castAs("someone.new@gmail.com");
    await flush();
    state.mails = [];

    await db.query(
      `INSERT INTO votes (round_id, nominee_id, voter_email_canonical, verified_at, held_at)
       VALUES ($1, $2, 'held@corp.test', now(), now())`,
      [roundId, nominees[0]],
    );
    await db.query(
      `INSERT INTO votes (round_id, nominee_id, voter_email_canonical, verified_at, status, removed_reason, removed_mode)
       VALUES ($1, $2, 'barred@corp.test', now(), 'removed', 'test', 'fraud')`,
      [roundId, nominees[0]],
    );

    for (const email of ["held@corp.test", "barred@corp.test"]) {
      const again = await castAs(email, nominees[1]);
      expect(again.status).toBe(fresh.status);
      expect(again.body).toEqual(fresh.body);
    }
    expect(state.afters).toHaveLength(0);
    expect(state.mails).toHaveLength(0);
  });
});

describe("a code typed after that", () => {
  it("fails with words that tell a person who already voted to stop, and the same words for a wrong code", async () => {
    await castAs("ben.eze@gmail.com");
    await flush();
    const code = /\b(\d{6})\b/.exec(state.mails[0].subject + " " + state.mails[0].text)![1];
    await verifyAs("ben.eze@gmail.com", code);

    // Already voted: the old code, then any code.
    const reused = await verifyAs("ben.eze@gmail.com", code);
    const guessed = await verifyAs("ben.eze@gmail.com", "123456");
    // A pending voter with a typo, and an address that never cast at all.
    await castAs("cy.ade@gmail.com");
    const typo = await verifyAs("cy.ade@gmail.com", "000001");
    const stranger = await verifyAs("never.cast@gmail.com", "123456");

    for (const answer of [reused, guessed, typo, stranger]) {
      expect(answer.status).toBe(400);
      expect(answer.body).toEqual(reused.body);
    }
    expect(reused.body.message).toMatch(/did not match or has expired/);
    expect(reused.body.message).toMatch(
      /If this address has already voted in this round, no new code will come and there is nothing more to do\./,
    );
  });
});
