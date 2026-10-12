import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { applyMigrations } from "../helpers/migrations";

/*
 * The console's tools for ROVV's answer, against the real schema: ruling out
 * a pasted list of the emails ROVV could not confirm, the picked winners file
 * for ROVV's last check, the referral file leaving out what is already ruled
 * out, a ruling email that did not send being said, and a judge's note that
 * never reaches the entrant.
 *
 * The same harness as rovv-admin.test.ts: the database is PGlite with every
 * migration, the mailer and the owner's copy are recorded, not sent.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: "",
  role: "owner" as "owner" | "reviewer",
  /** In order: "copy" for the owner's copy, the address for each send. */
  events: [] as string[],
  copies: [] as { to: string; sentTo: number; context: string; subject: string }[],
  failFor: new Set<string>(),
  /** Run while a mail is "in flight", before it reports. */
  during: null as null | (() => void),
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
    state.during?.();
    state.events.push(email.to);
    state.mails.push({ to: email.to, subject: email.subject, text: email.text, html: email.html ?? "" });
    return state.failFor.has(email.to) ? { sent: false, reason: "test" } : { sent: true };
  },
  sendEmailQuietly: async () => undefined,
}));
vi.mock("@/lib/email/copy", () => ({
  sendBulkCopy: async (sample: { to: string; subject: string } | null, sentTo: number, context: string) => {
    state.events.push("copy");
    state.copies.push({ to: sample?.to ?? "", sentTo, context, subject: sample?.subject ?? "" });
  },
}));

const ruleOutRoute = await import("@/app/api/admin/rovv/rule-out/route");
const decision = await import("@/app/api/admin/rovv/decision/route");
const exporter = await import("@/app/api/admin/rovv/export/route");
const adminLib = await import("@/lib/admin/rovv");

let db: PGlite;
let campaignId: string;
let seq = 0;

const one = async <T,>(q: string, params: unknown[] = []) => (await db.query<T>(q, params)).rows[0];

const SITE = "https://blockfestafrica.com";
const REASON = "ROVV could not confirm your referral code.";

function post(path: string, body: unknown, origin = SITE) {
  return new NextRequest(`${SITE}${path}`, {
    method: "POST",
    headers: { origin, "x-forwarded-host": "blockfestafrica.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ruleOut = (emails: string, extra: Record<string, unknown> = {}, origin = SITE) =>
  ruleOutRoute.POST(post("/api/admin/rovv/rule-out", { emails, ...extra }, origin));
const rule = async (entryId: string, status: string, note?: string) =>
  decision.POST(
    post("/api/admin/rovv/decision", {
      entryId,
      status,
      note,
      revision: (await one<{ revision: number }>(`SELECT revision FROM rovv_entries WHERE id = $1`, [entryId])).revision,
    }),
  );
const download = (query: string) =>
  exporter.GET(
    new NextRequest(`${SITE}/api/admin/rovv/export?${query}`, {
      headers: { "x-forwarded-host": "blockfestafrica.com" },
    }),
  );

/** An entry in a given state, written directly so the window does not matter. */
async function entry(
  o: {
    status?: "pending" | "eligible" | "ineligible";
    winner?: boolean;
    notified?: boolean;
    name?: string;
    test?: boolean;
    /** The address, and the canonical form the form would store with it. */
    email?: string;
    canonical?: string;
    /** A review note: the reason on an ineligible entry, a judge's note on an eligible one. */
    note?: string;
    /** The ruling the entrant was last emailed. */
    rulingEmailed?: "eligible" | "ineligible";
  } = {},
) {
  seq += 1;
  const status = o.status ?? (o.winner ? "eligible" : "pending");
  const email = o.email ?? `entrant${seq}@example.test`;
  const row = await one<{ id: string; email: string; tiktok_handle: string }>(
    `INSERT INTO rovv_entries (
       campaign_id, full_name, email, email_canonical, tiktok_handle, tiktok_url, post_key,
       referral_code, rules_version, privacy_version, status, review_note,
       reviewed_at, reviewed_by_admin_id, winner_at, winner_by_admin_id, notified_at,
       ticket_code, is_test, ruling_emailed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '1.0', '1.0', $9::text,
       COALESCE($14::text, CASE WHEN $9::text = 'ineligible' THEN 'Seeded' END),
       CASE WHEN $9::text = 'pending' THEN NULL ELSE now() END,
       CASE WHEN $9::text = 'pending' THEN NULL ELSE $10::uuid END,
       CASE WHEN $11::boolean THEN now() END,
       CASE WHEN $11::boolean THEN $10::uuid END,
       CASE WHEN $12::boolean THEN now() END,
       CASE WHEN $11::boolean THEN 'CODE-' || $15::text END, $13::boolean, $16::text)
     RETURNING id, email, tiktok_handle`,
    [
      campaignId,
      o.name ?? `Entrant ${seq}`,
      email,
      o.canonical ?? email,
      `entrant${seq}`,
      `https://tiktok.com/@entrant${seq}/video/74000000000000${String(seq).padStart(5, "0")}`,
      `tiktok:74000000000000${String(seq).padStart(5, "0")}`,
      `CODE${seq}`,
      status,
      state.adminId,
      Boolean(o.winner),
      Boolean(o.notified),
      Boolean(o.test),
      o.note ?? null,
      String(seq),
      o.rulingEmailed ?? null,
    ],
  );
  return row;
}

const rowOf = (id: string) =>
  one<{ status: string; review_note: string | null; ruling_emailed: string | null; winner_at: Date | null }>(
    `SELECT status, review_note, ruling_emailed, winner_at FROM rovv_entries WHERE id = $1`,
    [id],
  );
const sends = () => state.events.filter((e) => e !== "copy");

type RuleOutAnswer = {
  ok: boolean;
  message?: string;
  ruledOut: number;
  alreadyOut: number;
  winners: { handle: string; email: string }[];
  unmatched: string[];
  notRuled: { handle: string }[];
  emailed: number;
  emailFailed: number;
  left: number;
};

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
  // Monday morning, after entries close: when ROVV's answer comes. A test
  // about the open window sets its own time. PGlite's now() follows it.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T09:00:00+01:00"));
  await db.exec(`DELETE FROM rovv_entries; DELETE FROM audit_log;`);
  state.role = "owner";
  state.events = [];
  state.copies = [];
  state.failFor = new Set();
  state.during = null;
  state.mails = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ruling out the emails ROVV could not confirm", () => {
  it("rules out each match once, emails each entrant once with the owner's copy first, and names the rest", async () => {
    const waiting = await entry();
    const accepted = await entry({ status: "eligible" });
    const out = await entry({ status: "ineligible", rulingEmailed: "ineligible" });
    const picked = await entry({ winner: true, name: "Ada Obi" });
    const test = await entry({ test: true, status: "eligible" });

    const answer = await ruleOut(
      [
        `${waiting.email.toUpperCase()}, ${accepted.email}; ${out.email}`,
        `"${picked.email}"`,
        `Nobody Here <nobody@example.test>`,
        // The same person twice, and a test entry ROVV never saw.
        `${waiting.email}\t${test.email}`,
      ].join("\n"),
    );
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      ok: true,
      ruledOut: 2,
      alreadyOut: 1,
      winners: [{ handle: picked.tiktok_handle, email: picked.email }],
      unmatched: ["nobody@example.test", test.email],
      notRuled: [],
      unsent: [],
      emailed: 2,
      emailFailed: 0,
      left: 0,
    });

    for (const e of [waiting, accepted]) {
      expect(await rowOf(e.id)).toMatchObject({ status: "ineligible", review_note: REASON, ruling_emailed: "ineligible" });
    }
    expect(await rowOf(out.id), "already out: left as it was").toMatchObject({ status: "ineligible", review_note: "Seeded" });
    expect(await rowOf(picked.id), "a winner stays a winner").toMatchObject({ status: "eligible" });
    expect((await rowOf(picked.id)).winner_at).not.toBeNull();
    expect(await rowOf(test.id)).toMatchObject({ status: "eligible" });

    // The owner's copy before anyone's, then each entrant once.
    expect(state.events[0]).toBe("copy");
    expect(state.copies).toEqual([
      { to: expect.any(String), sentTo: 2, context: "rovv rule-out", subject: "About your ROVV entry" },
    ]);
    expect(sends().sort()).toEqual([waiting.email, accepted.email].sort());
    for (const mail of state.mails) {
      // After the close: what happened, and no "fix it before Sunday".
      expect(mail.subject).toBe("About your ROVV entry");
      expect(mail.text).toContain(`Why: ${REASON}`);
      expect(mail.text).toContain("Entries have closed");
    }

    // Each ruling in the trail as a reviewer's would be, and one row for the press: counts, no addresses.
    const actions = (
      await db.query<{ action: string }>(`SELECT action FROM audit_log WHERE entity_id IN ($1, $2)`, [waiting.id, accepted.id])
    ).rows.map((r) => r.action);
    expect(actions).toEqual(["rovv_entry.ineligible", "rovv_entry.ineligible"]);
    const press = await one<{ after: Record<string, number> }>(`SELECT after FROM audit_log WHERE action = 'rovv.ruled_out'`);
    expect(press.after).toEqual({
      pasted: 6,
      ruledOut: 2,
      alreadyOut: 1,
      winners: 1,
      unmatched: 2,
      emailed: 2,
      emailFailed: 0,
      left: 0,
    });
    expect(JSON.stringify(press.after)).not.toContain("@");
  });

  it("matches an address the way the form stores it", async () => {
    const e = await entry({ email: "ada@example.test" });
    const answer = (await (await ruleOut("Ada+ROVV@Example.test.")).json()) as RuleOutAnswer;
    expect(answer).toMatchObject({ ruledOut: 1, unmatched: [] });
    expect((await rowOf(e.id)).status).toBe("ineligible");
  });

  it("emails nobody twice: a second paste finds them out, and a back-to-waiting between is not news", async () => {
    const e = await entry({ status: "eligible", rulingEmailed: "eligible" });
    await ruleOut(e.email);
    expect(sends()).toEqual([e.email]);

    state.events = [];
    state.copies = [];
    const again = (await (await ruleOut(e.email)).json()) as RuleOutAnswer;
    expect(again).toMatchObject({ ruledOut: 0, alreadyOut: 1, emailed: 0 });
    expect(state.events, "no copy and no mail when nothing is ruled").toEqual([]);

    await rule(e.id, "pending");
    const third = (await (await ruleOut(e.email)).json()) as RuleOutAnswer;
    expect(third).toMatchObject({ ruledOut: 1, emailed: 0, emailFailed: 0 });
    expect(sends(), "they already had this news").toEqual([]);
  });

  it("tells an entrant how to fix it while entries are open, and takes the owner's own reason", async () => {
    vi.setSystemTime(new Date("2026-10-15T12:00:00+01:00"));
    const e = await entry();
    await ruleOut(e.email, { reason: "Your referral code is for a driver account, not a passenger one." });
    expect(state.mails.map((m) => m.subject)).toEqual(["Your ROVV entry needs a fix"]);
    expect(state.mails[0].text).toContain("Why: Your referral code is for a driver account, not a passenger one.");
    expect(state.mails[0].text).toMatch(/fix it and send it again before 11:59 PM on Sunday 18 October/);
  });

  it("counts an email that did not send, and leaves it to go on the next ruling", async () => {
    const e = await entry();
    state.failFor.add(e.email);
    expect(await (await ruleOut(e.email)).json()).toMatchObject({ ruledOut: 1, emailed: 0, emailFailed: 1 });
    expect(await rowOf(e.id)).toMatchObject({ status: "ineligible", ruling_emailed: null });
    // The console's retry: back to waiting, then rule again.
    state.failFor.clear();
    await rule(e.id, "pending");
    expect(await (await rule(e.id, "ineligible", REASON)).json()).toMatchObject({ emailed: true });
  });

  it("stops starting batches once its time is spent, and says how many are left", async () => {
    const people = [];
    for (let i = 0; i < 6; i += 1) people.push(await entry());
    let spent = false;
    // The first batch's sends run past the 35 second budget.
    state.during = () => {
      if (spent) return;
      spent = true;
      vi.setSystemTime(Date.now() + 36_000);
    };
    const first = (await (await ruleOut(people.map((p) => p.email).join("\n"))).json()) as RuleOutAnswer;
    expect(first).toMatchObject({ ruledOut: 4, emailed: 4, left: 2 });
    const second = (await (await ruleOut(people.map((p) => p.email).join("\n"))).json()) as RuleOutAnswer;
    expect(second).toMatchObject({ ruledOut: 2, alreadyOut: 4, emailed: 2, left: 0 });
    expect(sends().sort(), "everyone once").toEqual(people.map((p) => p.email).sort());
  });

  it("needs something to read", async () => {
    expect((await ruleOut("   ")).status).toBe(400);
    const words = await ruleOut("nothing here is an address");
    expect(words.status).toBe(400);
    expect(((await words.json()) as { message: string }).message).toMatch(/Paste the email addresses/);
    expect((await ruleOut("a@example.test", { reason: "x".repeat(501) })).status).toBe(400);
  });

  it("is owner work, and refused from another site, before anything is ruled or sent", async () => {
    const e = await entry();
    state.role = "reviewer";
    expect((await ruleOut(e.email)).status).toBe(403);
    state.role = "owner";
    expect((await ruleOut(e.email, {}, "https://evil.example")).status).toBe(403);
    expect((await rowOf(e.id)).status).toBe("pending");
    expect(state.events).toEqual([]);
  });
});

describe("the files for ROVV", () => {
  it("gives ROVV's last check the picked winners only, in the four columns, dated and audited", async () => {
    await entry({ winner: true, notified: true, name: "Ada Obi" });
    await entry({ winner: true, name: "Bola Ade" });
    await entry({ status: "eligible", name: "Not Picked" });
    await entry({ status: "ineligible", name: "Ruled Out" });
    await entry({ winner: true, test: true, name: "Test Person" });

    const answer = await download("of=rovv&picked=1");
    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-disposition")).toBe('attachment; filename="rovv-picked-check-2026-10-19.csv"');
    expect(answer.headers.get("cache-control")).toContain("no-store");
    const lines = (await answer.text()).trim().split("\r\n");
    expect(lines[0]).toBe("full_name,email,tiktok_handle,referral_code");
    expect(lines.slice(1).map((l) => l.split(",")[0]).sort()).toEqual(["Ada Obi", "Bola Ade"]);
    expect(lines.join("\n")).not.toMatch(/Not Picked|Ruled Out|Test Person|CODE-|tiktok\.com|eligible/);

    const audit = await one<{ after: { of: string; rows: number } }>(`SELECT after FROM audit_log WHERE action = 'rovv.exported'`);
    expect(audit.after).toEqual({ of: "rovv-picked", rows: 2 });
  });

  it("leaves out of ROVV's referral file every entry already ruled out", async () => {
    await entry({ status: "ineligible", name: "Chidi Eze" });
    await entry({ name: "Still Waiting" });
    await entry({ status: "eligible", name: "In The Running" });
    await entry({ winner: true, notified: true, name: "Ada Obi" });

    const answer = await download("of=rovv");
    expect(answer.headers.get("content-disposition")).toBe('attachment; filename="rovv-referral-check-2026-10-19.csv"');
    const lines = (await answer.text()).trim().split("\r\n");
    expect(lines[0]).toBe("full_name,email,tiktok_handle,referral_code");
    expect(lines.slice(1).map((l) => l.split(",")[0]).sort()).toEqual(["Ada Obi", "In The Running", "Still Waiting"]);
    expect(lines.join("\n")).not.toMatch(/Chidi Eze|Seeded|tiktok\.com/);
    const audit = await one<{ after: { of: string; rows: number } }>(`SELECT after FROM audit_log WHERE action = 'rovv.exported'`);
    expect(audit.after).toEqual({ of: "rovv", rows: 3 });

    // The team's own file still has everyone.
    const all = (await (await download("of=all")).text()).trim().split("\r\n");
    expect(all).toHaveLength(5);
  });

  it("does not take ?picked=1 for anything but the ROVV file", async () => {
    await entry({ status: "ineligible", name: "Chidi Eze" });
    const answer = await download("of=all&picked=1");
    expect(answer.headers.get("content-disposition")).toBe('attachment; filename="rovv-entries-2026-10-19.csv"');
    expect(await answer.text()).toContain("Chidi Eze");
  });
});

describe("a ruling email that did not send", () => {
  it("is said, so the reviewer knows the entrant did not hear", async () => {
    const e = await entry();
    state.failFor.add(e.email);
    expect(await (await rule(e.id, "eligible")).json()).toEqual({
      ok: true,
      status: "eligible",
      winner: false,
      emailed: false,
      emailFailed: true,
    });
    expect((await rowOf(e.id)).ruling_emailed).toBeNull();
  });

  it("is not claimed when no email was due", async () => {
    const e = await entry({ status: "eligible", rulingEmailed: "eligible" });
    state.failFor.add(e.email);
    await rule(e.id, "pending");
    const body = await (await rule(e.id, "eligible")).json();
    expect(body).toEqual({ ok: true, status: "eligible", winner: false, emailed: false });
    expect(state.mails).toEqual([]);
  });

  it("shows on the list until the entrant has been told", async () => {
    const admin = { adminId: state.adminId, role: "owner", email: "owner@example.test" } as never;
    const e = await entry();
    state.failFor.add(e.email);
    await rule(e.id, "ineligible", "Not public");
    const [row] = await adminLib.rovvEntries(admin, { status: "all" });
    expect(row).toMatchObject({ status: "ineligible", rulingEmailed: null });
    state.failFor.clear();
    await rule(e.id, "pending");
    await rule(e.id, "ineligible", "Not public");
    expect((await adminLib.rovvEntries(admin, { status: "all" }))[0]).toMatchObject({ rulingEmailed: "ineligible" });
  });
});

describe("a judge's note", () => {
  it("is kept on an eligible ruling, and never reaches the entrant or ROVV", async () => {
    const e = await entry();
    const note = "Strong hook, best edit so far: shortlist";
    expect(await (await rule(e.id, "eligible", note)).json()).toEqual({ ok: true, status: "eligible", winner: false, emailed: true });
    expect((await rowOf(e.id)).review_note).toBe(note);

    expect(state.mails.map((m) => m.subject)).toEqual(["Your ROVV entry is in the running"]);
    expect(state.mails[0].text + state.mails[0].html).not.toContain("Strong hook");
    expect(await (await download("of=rovv")).text()).not.toContain("Strong hook");
  });

  it("is what the owner's 'Eligible with a note' filter finds", async () => {
    const admin = { adminId: state.adminId, role: "owner", email: "owner@example.test" } as never;
    const noted = await entry({ status: "eligible", note: "Shortlist" });
    await entry({ status: "eligible" });
    await entry({ status: "ineligible", note: "A reason, not a note" });
    await entry({ status: "eligible", note: "A test", test: true });
    expect((await adminLib.rovvEntries(admin, { status: "noted" })).map((r) => r.id)).toEqual([noted.id]);
    expect((await adminLib.rovvCounts(admin)).noted).toBe(1);
  });
});

describe("pasting the same addresses again", () => {
  it("resends the ruling email that failed, and only that one, without ruling anything twice", async () => {
    const ok = await entry({ status: "pending" });
    const failing = await entry({ status: "pending" });
    state.failFor.add(failing.email);
    const first = (await (await ruleOut(`${ok.email}\n${failing.email}`)).json()) as {
      emailed: number;
      emailFailed: number;
      unsent: { email: string }[];
    };
    expect(first.emailed).toBe(1);
    expect(first.emailFailed).toBe(1);
    expect(first.unsent.map((u) => u.email)).toEqual([failing.email]);

    state.failFor.clear();
    state.mails = [];
    const again = (await (await ruleOut(`${ok.email}\n${failing.email}`)).json()) as {
      ruledOut: number;
      alreadyOut: number;
      emailed: number;
    };
    expect(again).toMatchObject({ ruledOut: 0, alreadyOut: 2, emailed: 1 });
    expect(state.mails.map((m) => m.to)).toEqual([failing.email]);
  });
});
