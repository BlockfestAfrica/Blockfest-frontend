import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * Monica's Creator Challenge email (0076), against the real schema: who it
 * goes to (only the creators who said yes to future campaigns, and not the
 * disqualified), the owner's copy and the test carrying a link that stops
 * nobody, every creator getting their own stop link, nobody getting it twice
 * across presses, a failed send retried by the next press, and the stop
 * link withdrawing exactly one person's consent.
 *
 * The mailer and the owner's copy are recorded, not sent.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  role: "owner" as "owner" | "reviewer",
  mails: [] as { to: string; subject: string; text: string; html: string }[],
  copies: [] as { to: string; sentTo: number; context: string; text: string }[],
  /** In order: "copy" for the owner's copy, the address for each send. */
  events: [] as string[],
  failFor: new Set<string>(),
}));

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
      admin: { adminId: state.adminId, role: state.role, email: `${state.role}@example.test` },
    }),
  };
});
vi.mock("@/lib/email/client", () => ({
  sendEmail: async (email: { to: string; subject: string; text: string; html: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    state.events.push(email.to);
    state.mails.push(email);
    return state.failFor.has(email.to) ? { sent: false, reason: "test" } : { sent: true };
  },
  sendEmailQuietly: async () => undefined,
}));
vi.mock("@/lib/email/copy", () => ({
  sendBulkCopy: async (sample: { to: string; text: string } | null, sentTo: number, context: string) => {
    state.events.push("copy");
    state.copies.push({ to: sample?.to ?? "", sentTo, context, text: sample?.text ?? "" });
  },
}));

const broadcastRoute = await import("@/app/api/admin/broadcast/route");
const stopRoute = await import("@/app/api/campaigns/monica/stop-emails/route");
const { broadcastCounts, CREATOR_CHALLENGE } = await import("@/lib/admin/broadcast");
const { creatorChallengeEmail } = await import("@/lib/email/templates");

let db: PGlite;
let campaignId: string;
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) => (await db.query<T>(q, params)).rows[0];

const SITE = "https://blockfestafrica.com";

function post(path: string, body: unknown, origin = SITE) {
  return new NextRequest(`${SITE}${path}`, {
    method: "POST",
    headers: { origin, "x-forwarded-host": "blockfestafrica.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const send = (origin = SITE) => broadcastRoute.POST(post("/api/admin/broadcast", { mode: "send" }, origin));
const test = () => broadcastRoute.POST(post("/api/admin/broadcast", { mode: "test" }));
const stop = (t: string) => stopRoute.POST(post("/api/campaigns/monica/stop-emails", { t }));

/** A Monica creator, opted in to future campaigns unless told otherwise. */
async function creator(o: { optIn?: boolean; status?: "active" | "disqualified"; name?: string } = {}) {
  seq += 1;
  const optIn = o.optIn ?? true;
  const row = await one<{ id: string; email: string }>(
    `INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, marketing_opt_in, marketing_opt_in_at)
     VALUES ($1, $2, $2, $3, $4, $5::boolean, CASE WHEN $5::boolean THEN now() END) RETURNING id, email`,
    [o.name ?? `Creator ${seq}`, `c${seq}@example.test`, `07${seq}`, `+23471${String(seq).padStart(8, "0")}`, optIn],
  );
  await db.query(
    `INSERT INTO campaign_creators (campaign_id, creator_id, referral_code, status) VALUES ($1, $2, $3, $4)`,
    [campaignId, row.id, `BC${seq}`, o.status ?? "active"],
  );
  return row;
}

const stopTokenIn = (text: string) => {
  const match = text.match(/stop-emails\?s=([^\s"&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};
const owner = { adminId: "", role: "owner" as const, email: "owner@example.test" };

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)).id;
  state.adminId = (
    await one<{ id: string }>(
      `INSERT INTO admin_users (email, email_canonical, password_hash, role)
       VALUES ('owner@example.test', 'owner@example.test', 'x', 'owner') RETURNING id`,
    )
  ).id;
  owner.adminId = state.adminId;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM broadcast_sends; DELETE FROM campaign_creators; DELETE FROM creators; DELETE FROM audit_log; DELETE FROM request_throttle;`);
  state.role = "owner";
  state.mails = [];
  state.copies = [];
  state.events = [];
  state.failFor = new Set();
});

describe("who it goes to", () => {
  it("is the creators who said yes to future campaigns, leaving out the unticked and the disqualified", async () => {
    const yes = await creator();
    const alsoYes = await creator();
    await creator({ optIn: false });
    await creator({ optIn: false });
    await creator({ status: "disqualified" });

    expect(await broadcastCounts(owner, CREATOR_CHALLENGE)).toEqual({ registered: 5, audience: 2, sent: 0, left: 2 });

    const answer = await send();
    expect(await answer.json()).toEqual({ ok: true, sent: 2, failed: 0, left: 0 });
    expect(state.mails.map((m) => m.to).sort()).toEqual([yes.email, alsoYes.email].sort());
  });
});

describe("sending", () => {
  it("copies the owner once, first, with a stop link that stops nobody", async () => {
    await creator({ name: "Ada Obi" });
    await creator();
    await send();

    expect(state.events[0]).toBe("copy");
    expect(state.copies).toHaveLength(1);
    expect(state.copies[0]).toMatchObject({ sentTo: 2, context: "creator challenge" });
    const sampleToken = stopTokenIn(state.copies[0].text);
    expect(sampleToken).toBe("sample");
    expect(await (await stop(sampleToken)).json()).toEqual({ ok: true, outcome: "unknown" });
  });

  it("gives every creator their own stop link, and nobody the email twice", async () => {
    for (let i = 0; i < 6; i += 1) await creator();
    await send();
    const second = await send();

    expect(second.status).toBe(409);
    expect((await second.json()).message).toMatch(/already/);
    expect(state.mails).toHaveLength(6);
    expect(new Set(state.mails.map((m) => m.to)).size).toBe(6);
    const tokens = state.mails.map((m) => stopTokenIn(m.text));
    expect(new Set(tokens).size).toBe(6);
    // Only hashes are kept.
    const stored = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM broadcast_sends WHERE stop_token_hash = ANY($1::text[])`,
      [tokens],
    );
    expect(stored.n).toBe(0);
    expect(state.copies).toHaveLength(1);
  });

  it("leaves a failed send for the next press, which retries it without copying the owner again", async () => {
    const ok = await creator();
    const bounced = await creator();
    state.failFor.add(bounced.email);

    expect(await (await send()).json()).toEqual({ ok: true, sent: 1, failed: 1, left: 1 });

    state.failFor.clear();
    expect(await (await send()).json()).toEqual({ ok: true, sent: 1, failed: 0, left: 0 });
    expect(state.mails.map((m) => m.to)).toEqual([ok.email, bounced.email, bounced.email]);
    expect(state.copies).toHaveLength(1);
    expect(await broadcastCounts(owner, CREATOR_CHALLENGE)).toMatchObject({ sent: 2, left: 0 });
  });

  it("records each press in the audit log", async () => {
    await creator();
    await send();
    const row = await one<{ after: { broadcast: string; sent: number } }>(
      `SELECT after FROM audit_log WHERE action = 'broadcast.sent'`,
    );
    expect(row.after).toMatchObject({ broadcast: CREATOR_CHALLENGE, sent: 1 });
  });

  it("is refused to a reviewer and to another site", async () => {
    await creator();
    state.role = "reviewer";
    expect((await send()).status).toBe(403);
    expect((await test()).status).toBe(403);
    state.role = "owner";
    expect((await send("https://evil.example")).status).toBe(403);
    expect(state.mails).toHaveLength(0);
  });
});

describe("the test", () => {
  it("goes to the signed-in owner only, marked as a test, and records nobody as sent", async () => {
    await creator();
    const answer = await test();
    expect(await answer.json()).toEqual({ ok: true, sentTo: "owner@example.test" });
    expect(state.mails).toHaveLength(1);
    expect(state.mails[0].to).toBe("owner@example.test");
    expect(state.mails[0].subject).toMatch(/^\[Test\] /);
    expect(stopTokenIn(state.mails[0].text)).toBe("sample");
    expect(await broadcastCounts(owner, CREATOR_CHALLENGE)).toMatchObject({ sent: 0, left: 1 });
  });
});

describe("the stop link", () => {
  it("withdraws exactly that creator's consent, once, and they drop out of the audience", async () => {
    const leaving = await creator();
    const staying = await creator();
    await send();
    const token = stopTokenIn(state.mails.find((m) => m.to === leaving.email)!.text);

    expect(await (await stop(token)).json()).toEqual({ ok: true, outcome: "stopped" });
    expect(await (await stop(token)).json()).toEqual({ ok: true, outcome: "already" });

    const rows = await db.query<{ id: string; marketing_opt_in: boolean; marketing_opt_in_at: Date | null }>(
      `SELECT id, marketing_opt_in, marketing_opt_in_at FROM creators WHERE id = ANY($1::uuid[])`,
      [[leaving.id, staying.id]],
    );
    const byId = new Map(rows.rows.map((r) => [r.id, r]));
    expect(byId.get(leaving.id)).toMatchObject({ marketing_opt_in: false, marketing_opt_in_at: null });
    expect(byId.get(staying.id)?.marketing_opt_in).toBe(true);

    const audit = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log WHERE action = 'creator.marketing_stopped' AND entity_id = $1`,
      [leaving.id],
    );
    expect(audit.n).toBe(1);
    // Still counted as sent: it did go. No longer in the audience.
    expect(await broadcastCounts(owner, CREATOR_CHALLENGE)).toMatchObject({ audience: 1, sent: 2, left: 0 });
  });

  it("does not know a made-up token, and refuses another site", async () => {
    expect(await (await stop("not-a-real-token")).json()).toEqual({ ok: true, outcome: "unknown" });
    const foreign = await stopRoute.POST(post("/api/campaigns/monica/stop-emails", { t: "x" }, "https://evil.example"));
    expect(foreign.status).toBe(403);
  });
});

describe("the email", () => {
  const mail = creatorChallengeEmail({
    to: "ada@example.test",
    fullName: "Tom & Jerry",
    stopUrl: "https://blockfestafrica.com/campaigns/monica-money-story/stop-emails?s=abc",
  });

  it("is Monica's draft, greeting the creator by first name", () => {
    expect(mail.subject).toBe("Remember the ₦5M? There's something bigger from Monica");
    expect(mail.text).toMatch(/^Hi Tom,/);
    for (const line of [
      "Monica is back with a ₦50 million Creator Challenge",
      "Season 1: The Art of the Unexpected launches November 16!",
      "Three seasons. Three creative worlds. ₦50 million in total rewards.",
      "Team Blockfest Africa",
    ]) {
      expect(mail.text).toContain(line);
    }
    expect(mail.html).toContain('href="https://monica.cash/creator-challenge/"');
  });

  it("carries the stop link in both versions, and escapes the name exactly once", () => {
    expect(mail.html).toContain("stop-emails?s=abc");
    expect(mail.text).toContain("stop-emails?s=abc");
    const named = creatorChallengeEmail({ to: "x@example.test", fullName: "<b>Ada", stopUrl: "https://x.test" });
    expect(named.html).toContain("Hi &lt;b&gt;Ada,");
    expect(named.html).not.toContain("&amp;lt;");
  });
});
