import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * Rovv's console routes against the real schema (0073): the winner email,
 * the rulings, the picks and the export.
 *
 * The winner email is the one that matters most. notified_at is its ledger,
 * stamped only for a mail that reports sent, so a re-press reaches the
 * failures and nobody twice; two presses at once split the winners rather
 * than both mailing all of them; and the owner's copy goes before the batch.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  role: "owner" as "owner" | "reviewer",
  /** In order: "copy" for the owner's copy, the address for each send. */
  events: [] as string[],
  copies: [] as { to: string; sentTo: number; context: string }[],
  failFor: new Set<string>(),
  /** Run while a mail to this address is "in flight", before it reports. */
  during: null as null | ((to: string) => Promise<void>),
  /** Entrant emails from a ruling: subject and address. */
  quiet: [] as { subject: string; to: string; text: string }[],
  /** The full winner emails sent, for what they carry. */
  mails: [] as { to: string; subject: string; text: string; html: string }[],
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
  sendEmail: async (email: { to: string; subject: string; text: string; html?: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    if (state.during) await state.during(email.to);
    state.events.push(email.to);
    state.mails.push({ to: email.to, subject: email.subject, text: email.text, html: (email as { html?: string }).html ?? "" });
    return state.failFor.has(email.to) ? { sent: false, reason: "test" } : { sent: true };
  },
  sendEmailQuietly: async (email: { to: string; subject: string; text: string }) => {
    state.quiet.push({ to: email.to, subject: email.subject, text: email.text });
  },
}));
vi.mock("@/lib/email/copy", () => ({
  sendBulkCopy: async (sample: { to: string } | null, sentTo: number, context: string) => {
    state.events.push("copy");
    state.copies.push({ to: sample?.to ?? "", sentTo, context });
  },
}));

const notify = await import("@/app/api/admin/rovv/notify/route");
const decision = await import("@/app/api/admin/rovv/decision/route");
const winner = await import("@/app/api/admin/rovv/winner/route");
const exporter = await import("@/app/api/admin/rovv/export/route");
const coder = await import("@/app/api/admin/rovv/code/route");
const testClear = await import("@/app/api/admin/rovv/test-clear/route");
const testNotify = await import("@/app/api/admin/rovv/test-notify/route");
const codesRoute = await import("@/app/api/admin/rovv/codes/route");
const adminLib = await import("@/lib/admin/rovv");
const correctRoute = await import("@/app/api/admin/rovv/correct/route");
const resultsRoute = await import("@/app/api/admin/rovv/results/route");

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

const press = () => notify.POST(post("/api/admin/rovv/notify", {}));
/** A ruling on the entry as it stands now, unless told which revision the reviewer saw. */
const rule = async (entryId: string, status: string, note?: string, revision?: number) =>
  decision.POST(
    post("/api/admin/rovv/decision", {
      entryId,
      status,
      note,
      revision:
        revision ??
        (await db.query<{ revision: number }>(`SELECT revision FROM rovv_entries WHERE id = $1`, [entryId])).rows[0]
          ?.revision ??
        1,
    }),
  );
const pick = (entryId: string, pickIt = true) =>
  winner.POST(post("/api/admin/rovv/winner", { entryId, pick: pickIt }));
const download = (of: string, headers: Record<string, string> = {}) =>
  exporter.GET(
    new NextRequest(`${SITE}/api/admin/rovv/export?of=${of}`, {
      headers: { "x-forwarded-host": "blockfestafrica.com", ...headers },
    }),
  );

/** An entry in a given state, written directly so the window does not matter. */
async function entry(
  o: {
    status?: "pending" | "eligible" | "ineligible";
    winner?: boolean;
    notified?: boolean;
    name?: string;
    postKey?: string;
    /** A winner's ticket code. Winners get CODE-<n> unless told null. */
    code?: string | null;
    test?: boolean;
  } = {},
) {
  seq += 1;
  const status = o.status ?? (o.winner ? "eligible" : "pending");
  const email = `entrant${seq}@example.test`;
  const row = await one<{ id: string; email: string }>(
    `INSERT INTO rovv_entries (
       campaign_id, full_name, email, email_canonical, tiktok_handle, tiktok_url, post_key,
       referral_code, rules_version, privacy_version, status, review_note,
       reviewed_at, reviewed_by_admin_id, winner_at, winner_by_admin_id, notified_at,
       ticket_code, is_test)
     VALUES ($1, $2, $3, $3, $4, $5, $6, $7, '1.0', '1.0', $8::text,
       CASE WHEN $8::text = 'ineligible' THEN 'Seeded' END,
       CASE WHEN $8::text = 'pending' THEN NULL ELSE now() END,
       CASE WHEN $8::text = 'pending' THEN NULL ELSE $9::uuid END,
       CASE WHEN $10::boolean THEN now() END,
       CASE WHEN $10::boolean THEN $9::uuid END,
       CASE WHEN $11::boolean THEN now() END,
       $12::text, $13::boolean)
     RETURNING id, email`,
    [
      campaignId,
      o.name ?? `Entrant ${seq}`,
      email,
      `entrant${seq}`,
      `https://tiktok.com/@entrant${seq}/video/73000000000000${String(seq).padStart(5, "0")}`,
      o.postKey ?? `tiktok:73000000000000${String(seq).padStart(5, "0")}`,
      `CODE${seq}`,
      status,
      state.adminId,
      Boolean(o.winner),
      Boolean(o.notified),
      o.winner ? (o.code === undefined ? `CODE-${seq}` : o.code) : null,
      Boolean(o.test),
    ],
  );
  return row;
}

const notifiedAt = async (id: string) =>
  (await one<{ notified_at: Date | null }>(`SELECT notified_at FROM rovv_entries WHERE id = $1`, [id])).notified_at;

const sends = () => state.events.filter((e) => e !== "copy");

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  state.db = drizzle(db, { schema });
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'rovv'`)).id;
  state.adminId = (
    await one<{ id: string }>(
      `INSERT INTO admin_users (email, email_canonical, password_hash, role)
       VALUES ('owner@example.test', 'owner@example.test', 'x', 'owner') RETURNING id`,
    )
  ).id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  // After entries close, when winners may be emailed; a test about the
  // window sets its own time.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T09:00:00+01:00"));
  await db.exec(`DELETE FROM rovv_entries; DELETE FROM audit_log; DELETE FROM request_throttle;`);
  state.role = "owner";
  state.events = [];
  state.copies = [];
  state.failFor = new Set();
  state.during = null;
  state.quiet = [];
  state.mails = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("emailing the winners", () => {
  it("mails only winners not yet told, stamps only the mails that left, and copies the owner first", async () => {
    const told = await entry({ winner: true, notified: true });
    const first = await entry({ winner: true });
    const bounced = await entry({ winner: true });
    await entry({ status: "eligible" });
    await entry({ status: "pending" });
    await entry({ status: "ineligible" });
    const toldAt = await notifiedAt(told.id);
    state.failFor.add(bounced.email);

    const answer = await press();
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ ok: true, sent: 1, failed: 1 });

    expect(sends().sort()).toEqual([first.email, bounced.email].sort());
    expect(state.events[0], "the owner's copy goes before the batch").toBe("copy");
    // The sample is one of this batch's mails. Which one is not pinned: two
    // rows seeded in the same clock tick share a winner_at.
    expect(state.copies).toHaveLength(1);
    expect(state.copies[0]).toMatchObject({ sentTo: 2, context: "rovv winner notice" });
    expect([first.email, bounced.email]).toContain(state.copies[0].to);

    expect(await notifiedAt(first.id)).not.toBeNull();
    expect(await notifiedAt(bounced.id), "a mail that did not leave is not stamped").toBeNull();
    expect(await notifiedAt(told.id)).toEqual(toldAt);

    const audit = await one<{ after: { sent: number; failed: number }; campaign_id: string; actor_admin_id: string }>(
      `SELECT after, campaign_id, actor_admin_id FROM audit_log WHERE action = 'rovv.winners_notified'`,
    );
    expect(audit).toEqual({ after: { sent: 1, failed: 1 }, campaign_id: campaignId, actor_admin_id: state.adminId });
  });

  it("reaches only the failure on a second press, and nobody on a third", async () => {
    const first = await entry({ winner: true });
    const bounced = await entry({ winner: true });
    state.failFor.add(bounced.email);
    expect((await press()).status).toBe(200);

    state.failFor.clear();
    state.events = [];
    const again = await press();
    expect(await again.json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(sends()).toEqual([bounced.email]);
    expect(await notifiedAt(bounced.id)).not.toBeNull();
    expect(await notifiedAt(first.id)).not.toBeNull();

    state.events = [];
    const third = await press();
    expect(third.status).toBe(409);
    expect(((await third.json()) as { message: string }).message).toMatch(/already been emailed/);
    expect(state.events, "no copy and no mail when nobody is left").toEqual([]);
  });

  it("mails each winner once when two presses land together", async () => {
    const people = [];
    for (let i = 0; i < 6; i += 1) people.push(await entry({ winner: true }));

    const answers = await Promise.all([press(), press()]);
    const bodies = (await Promise.all(answers.map((a) => a.json()))) as { ok: boolean; sent?: number }[];

    expect(sends().sort()).toEqual(people.map((p) => p.email).sort());
    expect(bodies.reduce((sum, b) => sum + (b.sent ?? 0), 0)).toBe(6);
    for (const person of people) expect(await notifiedAt(person.id)).not.toBeNull();
  });

  it("skips, on a press made while another is still sending, every winner that one holds", async () => {
    const a = await entry({ winner: true });
    const b = await entry({ winner: true });
    let second: Response | null = null;
    state.during = async (to) => {
      if (to === a.email && !second) second = await press();
    };
    const first = await press();
    expect(await first.json()).toEqual({ ok: true, sent: 2, failed: 0 });
    expect(second!.status).toBe(409);
    expect(((await second!.json()) as { message: string }).message).toMatch(/being emailed by another press/);
    expect(sends().sort()).toEqual([a.email, b.email].sort());
  });

  it("refuses to unpick a winner whose email is leaving, so nobody is told they won after an unpick", async () => {
    const a = await entry({ winner: true });
    let unpick: Response | null = null;
    state.during = async (to) => {
      if (to === a.email) unpick = await pick(a.id, false);
    };
    expect(await (await press()).json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(unpick!.status).toBe(409);
    expect(((await unpick!.json()) as { message: string }).message).toMatch(/being sent right now/);
    const row = await one<{ winner_at: Date | null; notified_at: Date | null }>(
      `SELECT winner_at, notified_at FROM rovv_entries WHERE id = $1`,
      [a.id],
    );
    expect(row.winner_at).not.toBeNull();
    expect(row.notified_at).not.toBeNull();
  });

  it("lets a failed send go, so the winner can be retried or unpicked at once", async () => {
    const a = await entry({ winner: true });
    state.failFor.add(a.email);
    expect(await (await press()).json()).toEqual({ ok: true, sent: 0, failed: 1 });
    expect((await one<{ c: Date | null }>(`SELECT notice_claimed_at AS c FROM rovv_entries WHERE id = $1`, [a.id])).c).toBeNull();
    expect((await pick(a.id, false)).status).toBe(200);
  });

  it("takes over a claim left by a press that died, once it has run out", async () => {
    const a = await entry({ winner: true });
    await db.query(`UPDATE rovv_entries SET notice_claimed_at = now() - interval '5 minutes' WHERE id = $1`, [a.id]);
    expect((await press()).status, "a five-minute-old claim may still be sending").toBe(409);
    await db.query(`UPDATE rovv_entries SET notice_claimed_at = now() - interval '7 minutes' WHERE id = $1`, [a.id]);
    expect(await (await press()).json()).toEqual({ ok: true, sent: 1, failed: 0 });
  });

  it("waits until entries close, without spending the throttle", async () => {
    await entry({ winner: true });
    vi.setSystemTime(new Date("2026-10-18T23:59:59+01:00"));
    const early = await press();
    expect(early.status).toBe(409);
    expect((await early.json()).message).toMatch(/email them once entries close/);
    expect(state.events).toEqual([]);
    expect((await db.query(`SELECT 1 FROM request_throttle`)).rows).toHaveLength(0);
    vi.setSystemTime(new Date("2026-10-19T00:00:00+01:00"));
    expect((await press()).status).toBe(200);
  });

  it("says to pick winners first when nobody is picked", async () => {
    await entry({ status: "eligible" });
    const answer = await press();
    expect(answer.status).toBe(409);
    expect(((await answer.json()) as { message: string }).message).toMatch(/Pick the winners first/);
    expect(state.events).toEqual([]);
  });

  it("refuses a reviewer, and a press from another site, before anything is sent", async () => {
    const person = await entry({ winner: true });

    state.role = "reviewer";
    expect((await press()).status).toBe(403);

    state.role = "owner";
    expect((await notify.POST(post("/api/admin/rovv/notify", {}, "https://evil.example"))).status).toBe(403);

    expect(state.events).toEqual([]);
    expect(await notifiedAt(person.id)).toBeNull();
  });
});

describe("ruling on an entry", () => {
  it("refuses a ruling on a version the entrant has since replaced", async () => {
    const e = await entry();
    await db.query(`UPDATE rovv_entries SET revision = 2, tiktok_url = 'https://tiktok.com/@x/video/7399999999999999999' WHERE id = $1`, [e.id]);
    const stale = await rule(e.id, "eligible", undefined, 1);
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { message: string }).message).toMatch(/replaced this entry since you loaded it/);
    expect((await one<{ status: string }>(`SELECT status FROM rovv_entries WHERE id = $1`, [e.id])).status).toBe("pending");
    expect((await rule(e.id, "eligible", undefined, 2)).status).toBe(200);
  });

  it("lets a reviewer rule, and needs a reason to rule an entry out", async () => {
    state.role = "reviewer";
    const e = await entry();

    const noReason = await rule(e.id, "ineligible", "   ");
    expect(noReason.status).toBe(400);
    expect(((await noReason.json()) as { message: string }).message).toMatch(/needs a reason/);

    const out = await rule(e.id, "ineligible", "No ROVV account with this code");
    expect(out.status).toBe(200);
    expect(await out.json()).toEqual({ ok: true, status: "ineligible", winner: false, emailed: true });

    const back = await rule(e.id, "eligible");
    expect(await back.json()).toEqual({ ok: true, status: "eligible", winner: false, emailed: true });

    // The same ruling again changes nothing, so it tells nobody anything.
    const same = await rule(e.id, "eligible");
    expect(await same.json()).toEqual({ ok: true, status: "eligible", winner: false, emailed: false });

    const actions = (await db.query<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY created_at`,
      [e.id],
    )).rows.map((r) => r.action);
    expect(actions).toEqual(["rovv_entry.ineligible", "rovv_entry.eligible", "rovv_entry.eligible"]);
    expect(state.copies, "one entrant at a time, never a bulk send").toEqual([]);
    expect(state.mails.map((m) => [m.to, m.subject])).toEqual([
      [e.email, "About your ROVV entry"],
      [e.email, "Your ROVV entry is in the running"],
    ]);
    expect(state.mails[0].text).toContain("No ROVV account with this code");
  });

  it("does not email the same ruling twice, even with a back-to-waiting between", async () => {
    const e = await entry();
    await rule(e.id, "eligible");
    await rule(e.id, "pending");
    expect(await (await rule(e.id, "eligible")).json()).toMatchObject({ ok: true, emailed: false });
    expect(state.mails.map((m) => m.subject)).toEqual(["Your ROVV entry is in the running"]);
    // A different ruling is news, and is emailed.
    await rule(e.id, "ineligible", "Not public");
    expect(state.mails.map((m) => m.subject)).toEqual(["Your ROVV entry is in the running", "About your ROVV entry"]);
  });

  it("makes the ruling even when its email cannot be sent, and tries again next time", async () => {
    const e = await entry();
    state.failFor.add(e.email);
    expect(await (await rule(e.id, "eligible")).json()).toMatchObject({ ok: true, status: "eligible", emailed: false });
    state.failFor.clear();
    await rule(e.id, "pending");
    expect(await (await rule(e.id, "eligible")).json()).toMatchObject({ emailed: true });
  });

  it("links a test entry's fix to the form in test mode", async () => {
    const e = await entry({ test: true });
    await rule(e.id, "ineligible", "Testing the fix email");
    expect(state.mails[0].subject).toBe("Your ROVV entry needs a fix");
    expect(state.mails[0].html).toContain("/campaigns/rovv?test=1#enter");
  });

  it("tells an entrant ruled out while entries are open how to fix it and send it again", async () => {
    vi.setSystemTime(new Date("2026-10-15T12:00:00+01:00"));
    const e = await entry();
    await rule(e.id, "ineligible", "Not tagging @rovvafrica");
    expect(state.mails.map((m) => m.subject)).toEqual(["Your ROVV entry needs a fix"]);
    expect(state.mails[0].text).toMatch(/fix it and send it again before 11:59 PM on Sunday 18 October/);
  });

  it("emails nobody when an entry goes back to waiting", async () => {
    const e = await entry({ status: "eligible" });
    expect(await (await rule(e.id, "pending")).json()).toMatchObject({ ok: true, emailed: false });
    expect(state.mails).toEqual([]);
  });

  it("keeps a winner eligible, and says why", async () => {
    const e = await entry({ winner: true });
    const answer = await rule(e.id, "ineligible", "Changed my mind");
    expect(answer.status).toBe(409);
    expect(((await answer.json()) as { message: string }).message).toMatch(/winner, so it stays eligible/);
  });

  it("lets only one entry for a video be eligible", async () => {
    const gaveUp = await entry({ status: "ineligible", postKey: "tiktok:7399999999999999999" });
    await entry({ status: "eligible", postKey: "tiktok:7399999999999999999" });
    const answer = await rule(gaveUp.id, "eligible");
    expect(answer.status).toBe(409);
    expect(((await answer.json()) as { message: string }).message).toMatch(/same video is already eligible/);
  });

  it("refuses a decision from another site", async () => {
    const e = await entry();
    const answer = await decision.POST(post("/api/admin/rovv/decision", { entryId: e.id, status: "eligible" }, "https://evil.example"));
    expect(answer.status).toBe(403);
    expect((await one<{ status: string }>(`SELECT status FROM rovv_entries WHERE id = $1`, [e.id])).status).toBe("pending");
  });
});

describe("picking winners", () => {
  it("is owner work", async () => {
    const e = await entry({ status: "eligible" });
    state.role = "reviewer";
    expect((await pick(e.id)).status).toBe(403);
    expect((await one<{ winner_at: Date | null }>(`SELECT winner_at FROM rovv_entries WHERE id = $1`, [e.id])).winner_at).toBeNull();
  });

  it("picks an eligible entry, refuses one that is not, and says how many are picked", async () => {
    const good = await entry({ status: "eligible" });
    const waiting = await entry();
    expect(await (await pick(good.id)).json()).toEqual({ ok: true, winners: 1, freedCode: null });
    const refused = await pick(waiting.id);
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { message: string }).message).toMatch(/Only an eligible entry can win/);
  });

  it("stops at twenty, and keeps a winner who has been emailed", async () => {
    for (let i = 0; i < 20; i += 1) await entry({ winner: true });
    const twentyFirst = await entry({ status: "eligible" });
    const full = await pick(twentyFirst.id);
    expect(full.status).toBe(409);
    expect(((await full.json()) as { message: string }).message).toMatch(/All 20 winners are picked/);

    const told = await entry({ winner: true, notified: true });
    const unpick = await pick(told.id, false);
    expect(unpick.status).toBe(409);
    expect(((await unpick.json()) as { message: string }).message).toMatch(/already been emailed/);
  });
});

describe("the export", () => {
  it("hands an owner every entry as a dated CSV, defused, and records who took it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T09:00:00+01:00"));

    await entry({ name: "=HYPERLINK(\"https://evil.example\")" });
    await entry({ winner: true, notified: true, name: "Ada Obi" });

    const answer = await download("all");
    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-disposition")).toBe('attachment; filename="rovv-entries-2026-10-19.csv"');
    expect(answer.headers.get("cache-control")).toContain("no-store");

    const lines = (await answer.text()).trim().split("\r\n");
    expect(lines[0]).toBe(
      "submitted_at_lagos,full_name,email,tiktok_handle,tiktok_url,referral_code,status,review_note,winner,ticket_code,notified_at_lagos",
    );
    expect(lines).toHaveLength(3);
    expect(lines.join("\n")).toContain(`"'=HYPERLINK(""https://evil.example"")"`);
    expect(lines.some((l) => l.includes("Ada Obi") && /,eligible,,yes,CODE-\d+,\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(l))).toBe(true);

    const audit = await one<{ after: { of: string; rows: number }; campaign_id: string }>(
      `SELECT after, campaign_id FROM audit_log WHERE action = 'rovv.exported'`,
    );
    expect(audit).toEqual({ after: { of: "all", rows: 2 }, campaign_id: campaignId });
  });

  it("gives only the winners on ?of=winners", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T00:30:00+01:00"));
    await entry({ status: "eligible" });
    await entry({ winner: true, name: "Bola Ade" });

    const answer = await download("winners");
    // The Lagos day, not the UTC one: 00:30 in Lagos is still the 19th in UTC.
    expect(answer.headers.get("content-disposition")).toBe('attachment; filename="rovv-winners-2026-10-20.csv"');
    const lines = (await answer.text()).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Bola Ade");
  });

  it("gives ROVV only the four fields the privacy notice names, for every entry", async () => {
    await entry({ status: "ineligible", name: "Chidi Eze" });
    await entry({ winner: true, notified: true, name: "Ada Obi" });
    const answer = await download("rovv");
    expect(answer.headers.get("content-disposition")).toBe('attachment; filename="rovv-referral-check-2026-10-19.csv"');
    const lines = (await answer.text()).trim().split("\r\n");
    expect(lines[0]).toBe("full_name,email,tiktok_handle,referral_code");
    expect(lines).toHaveLength(3);
    expect(lines.join("\n")).not.toMatch(/Seeded|eligible|tiktok\.com|yes/);
    const audit = await one<{ after: { of: string; rows: number } }>(
      `SELECT after FROM audit_log WHERE action = 'rovv.exported'`,
    );
    expect(audit.after).toEqual({ of: "rovv", rows: 2 });
  });

  it("refuses a reviewer and a cross-site request", async () => {
    state.role = "reviewer";
    expect((await download("all")).status).toBe(403);
    state.role = "owner";
    expect((await download("all", { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await db.query(`SELECT 1 FROM audit_log WHERE action = 'rovv.exported'`)).rows).toHaveLength(0);
  });
});

describe("ticket codes and the winner email (0074)", () => {
  const setCode = (entryId: string, code: string) => coder.POST(post("/api/admin/rovv/code", { entryId, code }));

  it("carries each winner's own code and the ticket link, and skips a winner with none", async () => {
    const coded = await entry({ winner: true, code: "BUIDL-ADA" });
    const bare = await entry({ winner: true, code: null });
    const answer = await press();
    expect(await answer.json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(sends()).toEqual([coded.email]);
    expect(state.mails[0].text).toContain("Your code: BUIDL-ADA");
    expect(state.mails[0].text).toMatch(/Register with your code: https:\/\/meetumo\.ai\/e\/blockfest-africa-2026\?/);
    expect(state.mails[0].subject).toBe("Your BUIDL PASS code: ROVV x Blockfest, Friday 23 October");
    expect(await notifiedAt(bare.id)).toBeNull();

    const again = await press();
    expect(again.status).toBe(409);
    expect(((await again.json()) as { message: string }).message).toMatch(/1 winner has no ticket code yet/);
  });

  it("lets an owner set, change and clear a code, never a reviewer, and never once emailed", async () => {
    const w = await entry({ winner: true, code: null });
    expect(await (await setCode(w.id, " BUIDL-1 ")).json()).toEqual({ ok: true, code: "BUIDL-1" });
    expect(await (await setCode(w.id, "")).json()).toEqual({ ok: true, code: null });
    expect((await setCode(w.id, "no spaces please")).status).toBe(400);

    const other = await entry({ winner: true, code: "TAKEN-1" });
    void other;
    const taken = await setCode(w.id, "TAKEN-1");
    expect(taken.status).toBe(409);
    expect(((await taken.json()) as { message: string }).message).toMatch(/already has that code/);

    const told = await entry({ winner: true, notified: true, code: "SENT-1" });
    expect((await setCode(told.id, "NEW-1")).status).toBe(409);

    state.role = "reviewer";
    expect((await setCode(w.id, "BUIDL-2")).status).toBe(403);
    state.role = "owner";
    expect((await coder.POST(post("/api/admin/rovv/code", { entryId: w.id, code: "X-1" }, "https://evil.example"))).status).toBe(403);
  });
});

describe("test entries in the console (0074)", () => {
  it("never reach the real winner email or any export", async () => {
    await entry({ winner: true, test: true, code: "TEST-1", name: "Test Person" });
    const real = await entry({ winner: true, code: "REAL-1", name: "Real Person" });
    expect(await (await press()).json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(sends()).toEqual([real.email]);
    for (const of of ["all", "winners", "rovv"]) {
      const text = await (await download(of)).text();
      expect(text, of).not.toContain("Test Person");
      expect(text, of).toContain("Real Person");
    }
  });

  it("can send one test winner their email before entries close, and only a test winner", async () => {
    vi.setSystemTime(new Date("2026-10-12T20:00:00+01:00"));
    const t = await entry({ winner: true, test: true, code: "TEST-9" });
    const real = await entry({ winner: true, code: "REAL-9" });

    const refused = await testNotify.POST(post("/api/admin/rovv/test-notify", { entryId: real.id }));
    expect(refused.status).toBe(409);

    const sent = await testNotify.POST(post("/api/admin/rovv/test-notify", { entryId: t.id }));
    expect(await sent.json()).toEqual({ ok: true, sentTo: t.email });
    expect(state.mails.map((m) => m.to)).toEqual([t.email]);
    expect(state.mails[0].text).toContain("Your code: TEST-9");
    expect(state.copies, "a single test send is not a bulk send").toEqual([]);
    expect(await notifiedAt(t.id)).not.toBeNull();
    expect((await testNotify.POST(post("/api/admin/rovv/test-notify", { entryId: t.id }))).status).toBe(409);

    state.role = "reviewer";
    expect((await testNotify.POST(post("/api/admin/rovv/test-notify", { entryId: t.id }))).status).toBe(403);
  });

  it("are deleted in one go by an owner, and nothing real with them", async () => {
    await entry({ test: true });
    await entry({ test: true, status: "eligible" });
    const real = await entry();
    state.role = "reviewer";
    expect((await testClear.POST(post("/api/admin/rovv/test-clear", {}))).status).toBe(403);
    state.role = "owner";
    expect((await testClear.POST(post("/api/admin/rovv/test-clear", {}, "https://evil.example"))).status).toBe(403);
    expect(await (await testClear.POST(post("/api/admin/rovv/test-clear", {}))).json()).toEqual({ ok: true, deleted: 2 });
    const left = (await db.query<{ id: string }>(`SELECT id FROM rovv_entries`)).rows.map((r) => r.id);
    expect(left).toEqual([real.id]);
  });
});

describe("pasting every code at once (0074)", () => {
  const paste = (text: string, test = false) => codesRoute.POST(post("/api/admin/rovv/codes", { text, test }));

  it("hands one code to each winner without one, in the order they were picked, and says what was left", async () => {
    const a = await entry({ winner: true, code: null });
    const b = await entry({ winner: true, code: null });
    // Picked a minute apart, as real picks are; a frozen clock would tie them.
    await db.query(`UPDATE rovv_entries SET winner_at = now() - interval '2 minutes' WHERE id = $1`, [a.id]);
    await db.query(`UPDATE rovv_entries SET winner_at = now() - interval '1 minute' WHERE id = $1`, [b.id]);
    const answer = await paste("BUIDL-001\nBUIDL-002\nBUIDL-003");
    const body = (await answer.json()) as { ok: boolean; assigned: { entryId: string; code: string }[]; unused: number };
    expect(body.ok).toBe(true);
    expect(body.assigned.map((x) => [x.entryId, x.code])).toEqual([[a.id, "BUIDL-001"], [b.id, "BUIDL-002"]]);
    expect(body.unused).toBe(1);
    expect(state.mails, "handing out codes emails nobody").toEqual([]);
  });

  it("refuses a list with a repeat, a non-code, or a code a winner holds, and names them", async () => {
    await entry({ winner: true, code: "HELD-1" });
    await entry({ winner: true, code: null });
    const twice = await paste("A-1\nB-2\na-1");
    expect(twice.status).toBe(400);
    expect(((await twice.json()) as { message: string }).message).toMatch(/twice: a-1/);
    const junk = await paste("A-1 not!a!code");
    expect(((await junk.json()) as { message: string }).message).toMatch(/not ticket codes: not!a!code/);
    // A code a winner already holds is skipped and named, not a reason to refuse the rest.
    const held = await paste("NEW-1\nheld-1");
    const body = (await held.json()) as { ok: boolean; skipped: string[]; assigned: { code: string }[] };
    expect(body.ok).toBe(true);
    expect(body.skipped).toEqual(["held-1"]);
    expect(body.assigned.map((a) => a.code)).toEqual(["NEW-1"]);
  });

  it("is owner work, and refused from another site", async () => {
    await entry({ winner: true, code: null });
    state.role = "reviewer";
    expect((await paste("X-1")).status).toBe(403);
    state.role = "owner";
    expect((await codesRoute.POST(post("/api/admin/rovv/codes", { text: "X-1" }, "https://evil.example"))).status).toBe(403);
  });

  it("gives test codes to test winners only", async () => {
    const real = await entry({ winner: true, code: null });
    const t = await entry({ winner: true, code: null, test: true });
    const body = (await (await paste("T-1", true)).json()) as { assigned: { entryId: string }[] };
    expect(body.assigned.map((x) => x.entryId)).toEqual([t.id]);
    expect((await db.query<{ ticket_code: string | null }>(`SELECT ticket_code FROM rovv_entries WHERE id = $1`, [real.id])).rows[0].ticket_code).toBeNull();
  });
});

describe("the claim on a winner's notice (0074)", () => {
  it("returns the code as it stands under the claim, not as it was listed", async () => {
    const w = await entry({ winner: true, code: "OLD-TYPO" });
    const admin = { adminId: state.adminId, role: "owner", email: "owner@example.test" } as never;
    const [listed] = await adminLib.rovvWinnersToNotify(admin);
    expect(listed.ticketCode).toBe("OLD-TYPO");
    await db.query(`UPDATE rovv_entries SET ticket_code = 'NEW-RIGHT' WHERE id = $1`, [w.id]);
    const held = await adminLib.claimRovvNotice(admin, listed);
    expect(held?.ticketCode).toBe("NEW-RIGHT");
  });
});

describe("the end-to-end walk's console fixes", () => {
  it("refuses a ruling from a card that is out of date, and leaves the other reviewer's ruling alone", async () => {
    const e = await entry();
    await rule(e.id, "ineligible", "Not public");
    // A second reviewer's card still says Waiting.
    const stale = await decision.POST(
      post("/api/admin/rovv/decision", { entryId: e.id, status: "eligible", revision: 1, from: "pending" }),
    );
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { message: string }).message).toMatch(/Another reviewer has just ruled/);
    expect((await one<{ status: string }>(`SELECT status FROM rovv_entries WHERE id = $1`, [e.id])).status).toBe("ineligible");
    expect(state.mails.map((m) => m.subject)).toEqual(["About your ROVV entry"]);
  });

  it("stops sending 'in the running' once the winners are announced", async () => {
    await entry({ winner: true, notified: true });
    const late = await entry();
    expect(await (await rule(late.id, "eligible")).json()).toMatchObject({ ok: true, emailed: false });
    expect(state.mails).toEqual([]);
  });

  it("lets each person win once, and says which code an unpick frees", async () => {
    const first = await entry({ winner: true, code: "FREE-ME" });
    await db.query(`UPDATE rovv_entries SET tiktok_handle = 'samehand' WHERE id = $1`, [first.id]);
    const second = await entry({ status: "eligible" });
    await db.query(`UPDATE rovv_entries SET tiktok_handle = 'samehand' WHERE id = $1`, [second.id]);
    const twice = await pick(second.id);
    expect(twice.status).toBe(409);
    expect(((await twice.json()) as { message: string }).message).toMatch(/already a winner from another entry/);
    expect(await (await pick(first.id, false)).json()).toMatchObject({ ok: true, freedCode: "FREE-ME" });
  });

  it("lets an owner correct a username or email, never a reviewer, never once emailed as a winner", async () => {
    const e = await entry();
    const fix = (body: object) => correctRoute.POST(post("/api/admin/rovv/correct", { entryId: e.id, ...body }));
    expect(await (await fix({ tiktokHandle: "@Right.Name" })).json()).toEqual({ ok: true });
    expect((await one<{ tiktok_handle: string }>(`SELECT tiktok_handle FROM rovv_entries WHERE id = $1`, [e.id])).tiktok_handle).toBe("right.name");
    expect(await (await fix({ email: "Fixed.Address@Gmail.com" })).json()).toEqual({ ok: true });
    const row = await one<{ email: string; email_canonical: string }>(`SELECT email, email_canonical FROM rovv_entries WHERE id = $1`, [e.id]);
    expect(row).toEqual({ email: "fixed.address@gmail.com", email_canonical: "fixedaddress@gmail.com" });
    const other = await entry();
    expect((await correctRoute.POST(post("/api/admin/rovv/correct", { entryId: other.id, email: "fixed.address@gmail.com" }))).status).toBe(409);
    state.role = "reviewer";
    expect((await fix({ tiktokHandle: "nope" })).status).toBe(403);
    state.role = "owner";
    const told = await entry({ winner: true, notified: true });
    expect((await correctRoute.POST(post("/api/admin/rovv/correct", { entryId: told.id, tiktokHandle: "late" }))).status).toBe(409);
  });

  it("puts leftover pasted codes back, by value", async () => {
    await entry({ winner: true, code: null });
    const body = (await (await codesRoute.POST(post("/api/admin/rovv/codes", { text: "L-1\nL-2\nL-3" }))).json()) as { unusedCodes: string[] };
    expect(body.unusedCodes).toEqual(["L-2", "L-3"]);
  });
});

describe("the results email (0075)", () => {
  const press = () => resultsRoute.POST(post("/api/admin/rovv/results", {}));

  it("waits until every picked winner has been emailed", async () => {
    await entry({ winner: true, notified: true });
    await entry({ winner: true });
    await entry({ status: "eligible" });
    const early = await press();
    expect(early.status).toBe(409);
    expect(((await early.json()) as { message: string }).message).toMatch(/Email every picked winner first/);
    expect(state.events).toEqual([]);
  });

  it("goes once to everyone who did not win and was not ruled out, with the owner's copy first", async () => {
    await entry({ winner: true, notified: true });
    const waiting = await entry();
    const accepted = await entry({ status: "eligible" });
    await entry({ status: "ineligible" });
    await entry({ status: "eligible", test: true });
    expect(await (await press()).json()).toEqual({ ok: true, sent: 2, failed: 0, left: 0 });
    expect(state.events[0]).toBe("copy");
    expect(sends().sort()).toEqual([waiting.email, accepted.email].sort());
    expect(state.mails.every((m) => m.subject === "The ROVV campaign winners are announced")).toBe(true);
    state.events = [];
    expect((await press()).status).toBe(409);
    expect(state.events, "nobody twice").toEqual([]);
  });

  it("retries only the mail that failed", async () => {
    await entry({ winner: true, notified: true });
    const a = await entry();
    const b = await entry();
    state.failFor.add(b.email);
    expect(await (await press()).json()).toMatchObject({ sent: 1, failed: 1 });
    state.failFor.clear();
    state.events = [];
    expect(await (await press()).json()).toMatchObject({ sent: 1, failed: 0 });
    expect(sends()).toEqual([b.email]);
    void a;
  });

  it("is owner work, and refused from another site", async () => {
    state.role = "reviewer";
    expect((await press()).status).toBe(403);
    state.role = "owner";
    expect((await resultsRoute.POST(post("/api/admin/rovv/results", {}, "https://evil.example"))).status).toBe(403);
  });
});

describe("the second review's fixes (0075)", () => {
  it("never picks somebody already emailed that they did not win", async () => {
    const e = await entry({ status: "eligible" });
    await db.query(`UPDATE rovv_entries SET results_emailed_at = now() WHERE id = $1`, [e.id]);
    const answer = await pick(e.id);
    expect(answer.status).toBe(409);
    expect(((await answer.json()) as { message: string }).message).toMatch(/emailed that they did not win/);
  });

  it("takes over a results claim left by a press that died, and never strands anyone as sent", async () => {
    await entry({ winner: true, notified: true });
    const a = await entry();
    await db.query(`UPDATE rovv_entries SET results_claimed_at = now() - interval '5 minutes' WHERE id = $1`, [a.id]);
    expect((await resultsRoute.POST(post("/api/admin/rovv/results", {}))).status, "a fresh claim may still be sending").toBe(409);
    await db.query(`UPDATE rovv_entries SET results_claimed_at = now() - interval '7 minutes' WHERE id = $1`, [a.id]);
    expect(await (await resultsRoute.POST(post("/api/admin/rovv/results", {}))).json()).toMatchObject({ sent: 1 });
    const row = await one<{ results_emailed_at: Date | null; results_claimed_at: Date | null }>(
      `SELECT results_emailed_at, results_claimed_at FROM rovv_entries WHERE id = $1`,
      [a.id],
    );
    expect(row.results_emailed_at).not.toBeNull();
    expect(row.results_claimed_at).toBeNull();
  });

  it("refuses to correct a winner whose email is being sent, or to make a username win twice", async () => {
    const sending = await entry({ winner: true, code: "C-77" });
    await db.query(`UPDATE rovv_entries SET notice_claimed_at = now() WHERE id = $1`, [sending.id]);
    expect((await correctRoute.POST(post("/api/admin/rovv/correct", { entryId: sending.id, email: "new@example.test" }))).status).toBe(409);
    const champ = await entry({ winner: true });
    const other = await entry();
    const handle = (await one<{ tiktok_handle: string }>(`SELECT tiktok_handle FROM rovv_entries WHERE id = $1`, [champ.id])).tiktok_handle;
    const twice = await correctRoute.POST(post("/api/admin/rovv/correct", { entryId: other.id, tiktokHandle: handle }));
    expect(twice.status).toBe(409);
    expect(((await twice.json()) as { message: string }).message).toMatch(/already a winner/);
  });

  it("lets a ruling go again to a corrected address", async () => {
    const e = await entry();
    await rule(e.id, "eligible");
    await correctRoute.POST(post("/api/admin/rovv/correct", { entryId: e.id, email: "right@example.test" }));
    await rule(e.id, "eligible");
    expect(state.mails.map((m) => m.to)).toEqual([e.email, "right@example.test"]);
  });

  it("does not offer a reply deadline in an 'in the running' email sent after the close", async () => {
    const e = await entry();
    await rule(e.id, "eligible");
    expect(state.mails[0].text).not.toMatch(/before 11:59 PM on Sunday 18 October/);
  });
});
