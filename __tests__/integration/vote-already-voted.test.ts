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
 * says plainly that an address that already confirmed a vote gets no new
 * code. These pin both halves. The words are there, and the answer is still
 * byte for byte the same, body and headers, for a new voter, a confirmed
 * voter, a held vote and a barred address, with no mail for any of the last
 * three. And the words must not strand the person they are not for: a voter
 * whose code expired is told to start again, and doing so mails a code.
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

/** Status, raw body and headers: "the same answer" means the same bytes. */
async function read(response: Response) {
  const raw = await response.text();
  return {
    status: response.status,
    raw,
    headers: [...response.headers.entries()].sort(),
    body: JSON.parse(raw) as { ok: boolean; message: string },
  };
}

async function castAs(email: string, nominee = nominees[0]) {
  return read(
    await cast(request("/api/campaigns/monica/vote", { roundId, nomineeId: nominee, email }, ip())),
  );
}

async function verifyAs(email: string, code: string) {
  return read(
    await verify(request("/api/campaigns/monica/vote/verify", { roundId, email, code }, ip())),
  );
}

/** The code in the latest mail; the template puts it in the subject. */
const lastCode = () => {
  const mail = state.mails[state.mails.length - 1];
  return /\b(\d{6})\b/.exec(mail.subject + " " + mail.text)![1];
};

const sameAnswer = (a: Awaited<ReturnType<typeof read>>, b: Awaited<ReturnType<typeof read>>) => {
  expect(a.status).toBe(b.status);
  expect(a.raw).toBe(b.raw);
  expect(a.headers).toEqual(b.headers);
};

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
  it("tells everybody that an address which already confirmed a vote gets no new code", async () => {
    const first = await castAs("new.voter@gmail.com");
    expect(first.status).toBe(200);
    expect(first.body.message).toMatch(
      /^If this address has not confirmed a vote in this round yet, a six digit code is on its way/,
    );
    expect(first.body.message).toMatch(
      /If it has, no new code will come and there is nothing more to do: a confirmed vote cannot be changed\.$/,
    );
    // "Voted" would catch the person who pressed Vote but never confirmed.
    expect(first.body.message).not.toMatch(/\bvoted\b/);
  });

  it("is the same answer, with no mail, once the address has confirmed a vote", async () => {
    const fresh = await castAs("ada.obi@gmail.com");
    await flush();
    expect(state.mails).toHaveLength(1);
    expect((await verifyAs("ada.obi@gmail.com", lastCode())).body.ok).toBe(true);
    state.mails = [];
    await flush();

    // The same nominee, another nominee, and another spelling of the address.
    for (const [email, nominee] of [
      ["ada.obi@gmail.com", nominees[0]],
      ["ada.obi@gmail.com", nominees[1]],
      ["AdaObi+again@gmail.com", nominees[1]],
    ] as const) {
      sameAnswer(await castAs(email, nominee), fresh);
    }
    expect(state.afters).toHaveLength(0);
    expect(state.mails).toHaveLength(0);

    // What the page now promises: the confirmed vote did not change.
    const stored = await db.query(
      `SELECT nominee_id, verified_at IS NOT NULL AS verified, status::text AS status
         FROM votes WHERE voter_email_canonical = 'adaobi@gmail.com'`,
    );
    expect(stored.rows).toEqual([{ nominee_id: nominees[0], verified: true, status: "counted" }]);
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
      sameAnswer(await castAs(email, nominees[1]), fresh);
    }
    expect(state.afters).toHaveLength(0);
    expect(state.mails).toHaveLength(0);
  });
});

describe("a code typed after that", () => {
  it("fails with words that tell a person who already voted to stop, and the same words for a wrong code", async () => {
    await castAs("ben.eze@gmail.com");
    await flush();
    const code = lastCode();
    // The precondition: without it every answer below is a plain wrong code
    // and this would pass having proved nothing.
    expect((await verifyAs("ben.eze@gmail.com", code)).body.ok).toBe(true);

    // Already voted: the old code, then any code.
    const reused = await verifyAs("ben.eze@gmail.com", code);
    const guessed = await verifyAs("ben.eze@gmail.com", "123456");
    // A pending voter with a typo, and an address that never cast at all.
    await castAs("cy.ade@gmail.com");
    const typo = await verifyAs("cy.ade@gmail.com", "000001");
    const stranger = await verifyAs("never.cast@gmail.com", "123456");

    for (const answer of [reused, guessed, typo, stranger]) {
      expect(answer.status).toBe(400);
      sameAnswer(answer, reused);
    }
    expect(reused.body.message).toBe(
      "That code did not match or has expired. If this address has already confirmed a vote in this round, no new code will come and there is nothing more to do. Otherwise, choose Start again for a fresh code.",
    );
  });

  it("does not strand a voter whose code expired: starting again mails a fresh one", async () => {
    await castAs("dayo.ade@gmail.com");
    await flush();
    const stale = lastCode();
    await db.exec(
      `UPDATE votes SET code_expires_at = now() - interval '1 minute' WHERE voter_email_canonical = 'dayoade@gmail.com'`,
    );
    const expired = await verifyAs("dayo.ade@gmail.com", stale);
    expect(expired.status).toBe(400);
    expect(expired.body.message).toMatch(/Otherwise, choose Start again for a fresh code\.$/);

    state.mails = [];
    await castAs("dayo.ade@gmail.com");
    await flush();
    expect(state.mails).toHaveLength(1);
    expect((await verifyAs("dayo.ade@gmail.com", lastCode())).body.ok).toBe(true);
  });
});
