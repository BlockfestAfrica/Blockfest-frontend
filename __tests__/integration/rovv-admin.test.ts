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
  sendEmail: async (email: { to: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    if (state.during) await state.during(email.to);
    state.events.push(email.to);
    return state.failFor.has(email.to) ? { sent: false, reason: "test" } : { sent: true };
  },
  sendEmailQuietly: async () => undefined,
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
  o: { status?: "pending" | "eligible" | "ineligible"; winner?: boolean; notified?: boolean; name?: string; postKey?: string } = {},
) {
  seq += 1;
  const status = o.status ?? (o.winner ? "eligible" : "pending");
  const email = `entrant${seq}@example.test`;
  const row = await one<{ id: string; email: string }>(
    `INSERT INTO rovv_entries (
       campaign_id, full_name, email, email_canonical, tiktok_handle, tiktok_url, post_key,
       referral_code, rules_version, privacy_version, status, review_note,
       reviewed_at, reviewed_by_admin_id, winner_at, winner_by_admin_id, notified_at)
     VALUES ($1, $2, $3, $3, $4, $5, $6, $7, '1.0', '1.0', $8::text,
       CASE WHEN $8::text = 'ineligible' THEN 'Seeded' END,
       CASE WHEN $8::text = 'pending' THEN NULL ELSE now() END,
       CASE WHEN $8::text = 'pending' THEN NULL ELSE $9::uuid END,
       CASE WHEN $10::boolean THEN now() END,
       CASE WHEN $10::boolean THEN $9::uuid END,
       CASE WHEN $11::boolean THEN now() END)
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
    expect(await out.json()).toEqual({ ok: true, status: "ineligible", winner: false });

    const back = await rule(e.id, "eligible");
    expect(await back.json()).toEqual({ ok: true, status: "eligible", winner: false });

    const actions = (await db.query<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY created_at`,
      [e.id],
    )).rows.map((r) => r.action);
    expect(actions).toEqual(["rovv_entry.ineligible", "rovv_entry.eligible"]);
    expect(state.events, "a ruling emails nobody").toEqual([]);
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
    expect(await (await pick(good.id)).json()).toEqual({ ok: true, winners: 1 });
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
      "submitted_at_lagos,full_name,email,tiktok_handle,tiktok_url,referral_code,status,review_note,winner,notified_at_lagos",
    );
    expect(lines).toHaveLength(3);
    expect(lines.join("\n")).toContain(`"'=HYPERLINK(""https://evil.example"")"`);
    expect(lines.some((l) => l.includes("Ada Obi") && /,eligible,,yes,\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(l))).toBe(true);

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
