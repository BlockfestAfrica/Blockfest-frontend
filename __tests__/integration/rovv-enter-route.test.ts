import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * The Rovv entry route against the real schema and the real SQL function:
 * the guards, the three outcomes and which of them email, every refusal
 * landing on the field it is about, the bot trap writing nothing, and the
 * window and the pause.
 *
 * The database's window is set relative to its own now(), and the route's
 * clock is pinned only where the route reads it (the wording of a closed
 * window), so nothing here depends on today's date.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  sent: [] as { subject: string; to: string }[],
  /** Whether the request carries a console session (for test entries). */
  admin: false,
  /** What the route handed to after(), run by the test when it wants. */
  later: [] as (() => unknown)[],
  alerts: [] as { kind: string; who: string }[],
}));

vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  return { ...real, after: (fn: () => unknown) => state.later.push(fn) };
});
vi.mock("@/lib/admin/session", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/session")>();
  return {
    ...real,
    requireAdmin: async () =>
      state.admin
        ? { ok: true, admin: { adminId: "00000000-0000-0000-0000-000000000001", role: "owner", email: "o@example.test" } }
        : { ok: false },
  };
});
vi.mock("@/lib/notify/admin-activity", () => ({
  notifyAdminsOfActivity: async (params: { kind: string; who: string }) => {
    state.alerts.push(params);
  },
}));

vi.mock("@/lib/db/client", async () => {
  const tables = await import("@/lib/db/schema");
  return { ...tables, getDb: () => state.db };
});
vi.mock("@/lib/email/client", () => ({
  sendEmailQuietly: vi.fn(async (mail: { subject: string; to: string }) => {
    state.sent.push({ subject: mail.subject, to: mail.to });
  }),
  sendEmail: vi.fn(),
}));

const { POST } = await import("@/app/api/campaigns/rovv/enter/route");
const { ROVV_RULES_VERSION } = await import("@/lib/rovv-rules");
const { ROVV_PRIVACY_VERSION } = await import("@/lib/rovv-privacy");

let db: PGlite;

const ENTRY = {
  fullName: "Ada Obi",
  email: "ada@example.test",
  tiktokHandle: "adaobi",
  tiktokUrl: "https://www.tiktok.com/@adaobi/video/7300000000000000001",
  referralCode: "ADA123",
  acceptedRules: true,
  rulesVersion: ROVV_RULES_VERSION,
  privacyVersion: ROVV_PRIVACY_VERSION,
  elapsedMs: 30_000,
};

function enter(body: object, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("https://blockfestafrica.com/api/campaigns/rovv/enter", {
      method: "POST",
      headers: {
        "x-forwarded-host": "blockfestafrica.com",
        origin: "https://blockfestafrica.com",
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.9",
        "user-agent": "test-browser",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

const rows = async () =>
  (
    await db.query<{ email: string; tiktok_url: string; referral_code: string; ip_address: string; user_agent: string; rules_version: string; privacy_version: string }>(
      `SELECT email, tiktok_url, referral_code, ip_address::text AS ip_address, user_agent, rules_version, privacy_version FROM rovv_entries ORDER BY created_at`,
    )
  ).rows;

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
}, 60_000);
afterAll(() => db?.close());
beforeEach(async () => {
  state.sent = [];
  state.admin = false;
  state.later = [];
  state.alerts = [];
  await db.exec(`DELETE FROM rovv_entries; DELETE FROM request_throttle;
    UPDATE campaigns SET starts_at = now() - interval '1 day', ends_at = now() + interval '1 day', paused_at = NULL, paused_reason = NULL WHERE slug = 'rovv';`);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the guards", () => {
  it("refuses a foreign origin, a missing origin and a text/plain post, writing nothing", async () => {
    expect((await enter(ENTRY, { origin: "https://evil.example" })).status).toBe(403);
    const noOrigin = new NextRequest("https://blockfestafrica.com/api/campaigns/rovv/enter", {
      method: "POST",
      headers: { "x-forwarded-host": "blockfestafrica.com", "content-type": "application/json" },
      body: JSON.stringify(ENTRY),
    });
    expect((await POST(noOrigin)).status).toBe(403);
    expect((await enter(ENTRY, { "content-type": "text/plain;charset=UTF-8" })).status).toBe(415);
    expect(await rows()).toEqual([]);
  });

  it("refuses an oversized body", async () => {
    expect((await enter({ ...ENTRY, fullName: "x".repeat(9000) })).status).toBe(413);
  });
});

describe("an entry", () => {
  it("is taken, stored as typed and tidied, and receipted once", async () => {
    const response = await enter(ENTRY);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, outcome: "created", test: false });
    expect(await rows()).toEqual([
      {
        email: "ada@example.test",
        tiktok_url: "https://tiktok.com/@adaobi/video/7300000000000000001",
        referral_code: "ADA123",
        ip_address: "198.51.100.9",
        user_agent: "test-browser",
        rules_version: ROVV_RULES_VERSION,
        privacy_version: ROVV_PRIVACY_VERSION,
      },
    ]);
    expect(state.sent).toEqual([{ subject: "We got your ROVV entry", to: "ada@example.test" }]);
  });

  it("sent again unchanged sends no second email, and changed replaces the first", async () => {
    await enter(ENTRY);
    expect(await (await enter(ENTRY)).json()).toEqual({ ok: true, outcome: "unchanged", test: false });
    const changed = await enter({ ...ENTRY, tiktokUrl: "https://vt.tiktok.com/ZSqxCpWFD", referralCode: "ada999" });
    expect(await changed.json()).toEqual({ ok: true, outcome: "updated", test: false });
    expect((await rows()).map((r) => [r.tiktok_url, r.referral_code])).toEqual([["https://vt.tiktok.com/ZSqxCpWFD", "ADA999"]]);
    expect(state.sent.map((m) => m.subject)).toEqual(["We got your ROVV entry", "Your ROVV entry is updated"]);
  });

  it("from the same email with another username is refused on the email", async () => {
    await enter(ENTRY);
    const response = await enter({ ...ENTRY, tiktokHandle: "other", tiktokUrl: "https://tiktok.com/@other/video/7300000000000000002" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, field: "email" });
  });

  it("of a video someone else entered is taken while theirs is pending, and refused on the link once it is eligible", async () => {
    await enter(ENTRY);
    expect((await enter({ ...ENTRY, email: "bee@example.test", fullName: "Bee Bee" })).status).toBe(200);
    await db.exec(`UPDATE rovv_entries SET status = 'eligible', reviewed_at = now() WHERE email = 'ada@example.test'`);
    const response = await enter({ ...ENTRY, email: "cee@example.test", fullName: "Cee Cee" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, field: "tiktokUrl" });
  });

  it("mails one address at most three receipts an hour, and still saves every change", async () => {
    for (const code of ["AAA111", "BBB222", "CCC333", "DDD444", "EEE555"]) {
      expect(await (await enter({ ...ENTRY, referralCode: code })).json()).toMatchObject({ ok: true });
    }
    expect(state.sent).toHaveLength(3);
    expect((await rows()).map((r) => r.referral_code)).toEqual(["EEE555"]);
  });

  it("refuses a name that is a link, since it heads the receipt", async () => {
    const response = await enter({ ...ENTRY, fullName: "Win big at www.example.test/prize" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: "fullName" });
  });

  it("against rules or a notice this server no longer publishes is refused, and nothing written", async () => {
    const rules = await enter({ ...ENTRY, rulesVersion: "0.9" });
    expect(rules.status).toBe(409);
    expect(await rules.json()).toMatchObject({ field: "rulesVersion" });
    const notice = await enter({ ...ENTRY, privacyVersion: "0.9" });
    expect(notice.status).toBe(409);
    expect(await notice.json()).toMatchObject({ field: "privacyVersion" });
    expect(await rows()).toEqual([]);
  });

  it("that fails the form's checks is refused on the field", async () => {
    const response = await enter({ ...ENTRY, tiktokUrl: "https://tiktok.com/@someoneelse/video/7300000000000000003" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: "tiktokUrl" });
  });

  it("from a bot is answered as success, and nothing is written or sent", async () => {
    for (const trap of [{ hp_contact: "filled" }, { elapsedMs: 400 }]) {
      const response = await enter({ ...ENTRY, ...trap });
      expect(await response.json()).toEqual({ ok: true, outcome: "created", test: false });
    }
    expect(await rows()).toEqual([]);
    expect(state.sent).toEqual([]);
  });
});

describe("the team's alert", () => {
  it("goes after the response, for a new entry only, naming the username", async () => {
    await enter(ENTRY);
    await enter({ ...ENTRY, referralCode: "OTHER1" });
    expect(state.later).toHaveLength(1);
    await Promise.all(state.later.map((fn) => fn()));
    expect(state.alerts).toEqual([{ kind: "rovv_entry", who: "@adaobi", test: false }]);
  });
});

describe("test entries (0074)", () => {
  const closeTheWindow = () =>
    db.exec(`UPDATE campaigns SET starts_at = now() + interval '1 day', ends_at = now() + interval '2 days' WHERE slug = 'rovv'`);

  it("are refused without a console session, whatever the form says", async () => {
    await closeTheWindow();
    const response = await enter({ ...ENTRY, test: true });
    expect(response.status).toBe(403);
    expect((await response.json()).message).toMatch(/signed-in admins/);
    expect(await rows()).toEqual([]);
  });

  it("are taken from an admin before entries open, marked, receipted, and alerted as tests", async () => {
    await closeTheWindow();
    state.admin = true;
    // A quick tester trips no bot check: the session is the check.
    const response = await enter({ ...ENTRY, test: true, elapsedMs: 300 });
    expect(await response.json()).toEqual({ ok: true, outcome: "created", test: true });
    const flagged = (await db.query<{ is_test: boolean }>(`SELECT is_test FROM rovv_entries`)).rows;
    expect(flagged).toEqual([{ is_test: true }]);
    expect(state.sent).toEqual([{ subject: "We got your ROVV entry", to: "ada@example.test" }]);
    await Promise.all(state.later.map((fn) => fn()));
    expect(state.alerts).toEqual([{ kind: "rovv_entry", who: "@adaobi (test)", test: true }]);
  });

  it("leave a real entry from the same address free to be made", async () => {
    state.admin = true;
    await enter({ ...ENTRY, test: true });
    state.admin = false;
    expect(await (await enter(ENTRY)).json()).toEqual({ ok: true, outcome: "created", test: false });
  });
});

describe("the window and the pause", () => {
  it("says not yet before the start, and closed after the end", async () => {
    // PGlite's now() is JavaScript's clock, so the clock is set first and the
    // window placed around it.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-12T20:00:00+01:00") });
    await db.exec(`UPDATE campaigns SET starts_at = now() + interval '1 hour', ends_at = now() + interval '2 days' WHERE slug = 'rovv'`);
    const early = await enter(ENTRY);
    expect(early.status).toBe(403);
    expect((await early.json()).message).toMatch(/open at midnight on Tuesday 13 October/);

    vi.setSystemTime(new Date("2026-10-19T08:00:00+01:00"));
    await db.exec(`UPDATE campaigns SET starts_at = now() - interval '2 days', ends_at = now() - interval '1 second' WHERE slug = 'rovv'`);
    const late = await enter(ENTRY);
    expect(late.status).toBe(403);
    expect((await late.json()).message).toMatch(/closed at 11:59 PM on Sunday 18 October/);
    expect(await rows()).toEqual([]);
  });

  it("gives the pause's own reason", async () => {
    await db.exec(`UPDATE campaigns SET paused_at = now(), paused_reason = 'Back at 3pm.' WHERE slug = 'rovv'`);
    const response = await enter(ENTRY);
    expect(response.status).toBe(503);
    expect((await response.json()).message).toBe("Back at 3pm.");
  });

  it("is Rovv's alone: pausing Monica does not stop Rovv", async () => {
    await db.exec(`UPDATE campaigns SET paused_at = now(), paused_reason = 'Monica only' WHERE slug = 'monica-money-story'`);
    try {
      expect((await enter(ENTRY)).status).toBe(200);
    } finally {
      await db.exec(`UPDATE campaigns SET paused_at = NULL, paused_reason = NULL WHERE slug = 'monica-money-story'`);
    }
  });
});
