import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ROVV_ENTRY_STATUSES } from "@/lib/rovv";
import { applyMigrations } from "../helpers/migrations";

/*
 * Rovv's entries (0073_rovv_campaign.sql) against the real schema: one entry
 * per person and per video, a replacement only by the same person before
 * review, the window, the review rules and the 20-winner cap.
 *
 * The window is set relative to the database's own now() in each test, so
 * nothing here depends on today's date.
 */

let db: PGlite;
let admin: string;

const entry = (o: Partial<Record<string, unknown>> = {}) => ({
  name: "Ada Obi",
  email: "ada@example.test",
  canonical: "ada@example.test",
  handle: "adaobi",
  url: "https://tiktok.com/@adaobi/video/7300000000000000001",
  code: "ADA123",
  test: false,
  ...o,
});

async function submit(o: Partial<Record<string, unknown>> = {}) {
  const e = entry(o);
  const r = await db.query<{ entry_id: string; outcome: string }>(
    `SELECT * FROM submit_rovv_entry('rovv', $1, $2, $3, $4, $5, $6, '1.0', '1.0', false, '198.51.100.1', 'test', $7)`,
    [e.name, e.email, e.canonical, e.handle, e.url, e.code, e.test],
  );
  return r.rows[0];
}

const errorOf = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string; message?: string }) => e.code ?? e.message);

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
  admin = (
    await db.query<{ id: string }>(
      `INSERT INTO admin_users (email, email_canonical, password_hash, role) VALUES ('o@example.test','o@example.test','x','owner') RETURNING id`,
    )
  ).rows[0].id;
}, 60_000);
afterAll(() => db?.close());
beforeEach(async () => {
  await db.exec(`DELETE FROM rovv_entries;
    UPDATE campaigns SET starts_at = now() - interval '1 day', ends_at = now() + interval '1 day', paused_at = NULL, paused_reason = NULL WHERE slug = 'rovv';`);
});

describe("the campaign row", () => {
  it("is seeded active for 13 to 18 October, Lagos", async () => {
    const fresh = new PGlite();
    await applyMigrations(fresh);
    const row = (
      await fresh.query<{ status: string; starts: string; ends: string; timezone: string }>(
        `SELECT status::text, to_char(starts_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD HH24:MI:SS') AS starts,
                to_char(ends_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD HH24:MI:SS') AS ends, timezone
           FROM campaigns WHERE slug = 'rovv'`,
      )
    ).rows[0];
    await fresh.close();
    expect(row).toEqual({ status: "active", starts: "2026-10-13 00:00:00", ends: "2026-10-18 23:59:59", timezone: "Africa/Lagos" });
  }, 60_000);

  it("lists the same review states as the code", async () => {
    const def = (await db.query<{ d: string }>(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'rovv_entry_status'`)).rows[0].d;
    expect([...def.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort()).toEqual([...ROVV_ENTRY_STATUSES].sort());
  });
});

describe("entering", () => {
  it("takes an entry inside the window, and nothing outside it or while paused", async () => {
    expect((await submit()).outcome).toBe("created");
    await db.exec(`UPDATE campaigns SET starts_at = now() + interval '1 hour', ends_at = now() + interval '2 days' WHERE slug = 'rovv'`);
    expect(await errorOf(submit({ email: "b@example.test", canonical: "b@example.test", handle: "bee", url: "https://tiktok.com/@bee/video/7300000000000000002" }))).toBe("P1001");
    await db.exec(`UPDATE campaigns SET starts_at = now() - interval '2 days', ends_at = now() - interval '1 second' WHERE slug = 'rovv'`);
    expect(await errorOf(submit({ email: "b@example.test", canonical: "b@example.test", handle: "bee", url: "https://tiktok.com/@bee/video/7300000000000000002" }))).toBe("P1001");
    await db.exec(`UPDATE campaigns SET starts_at = now() - interval '1 day', ends_at = now() + interval '1 day', paused_at = now(), paused_reason = 'x' WHERE slug = 'rovv'`);
    expect(await errorOf(submit({ email: "b@example.test", canonical: "b@example.test", handle: "bee", url: "https://tiktok.com/@bee/video/7300000000000000002" }))).toBe("P1002");
  });

  it("lets the same person replace their unreviewed entry, and says when nothing changed", async () => {
    const first = await submit();
    expect((await submit()).outcome).toBe("unchanged");
    const second = await submit({ url: "https://tiktok.com/@adaobi/video/7300000000000000009", code: "ADA999" });
    expect(second).toEqual({ entry_id: first.entry_id, outcome: "updated" });
    const row = (await db.query<{ tiktok_url: string; referral_code: string; n: number }>(
      `SELECT tiktok_url, referral_code, (SELECT count(*)::int FROM rovv_entries) AS n FROM rovv_entries`,
    )).rows[0];
    expect(row).toEqual({ tiktok_url: "https://tiktok.com/@adaobi/video/7300000000000000009", referral_code: "ADA999", n: 1 });
  });

  it("never lets someone else's username, or a reviewed entry, be replaced through the same email", async () => {
    const first = await submit();
    expect(await errorOf(submit({ handle: "intruder", url: "https://tiktok.com/@intruder/video/7300000000000000003" }))).toBe("P1003");
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [first.entry_id, admin]);
    expect(await errorOf(submit({ url: "https://tiktok.com/@adaobi/video/7300000000000000004" }))).toBe("P1003");
  });

  it("lets a stranger who entered the author's video first never lock the author out", async () => {
    // A stranger copies the public link and the author's username, with an
    // address of their own. The author still gets in.
    const stranger = await submit({ email: "x@example.test", canonical: "x@example.test" });
    const author = await submit({ email: "ada@example.test", canonical: "ada@example.test" });
    expect(author.outcome).toBe("created");
    // Only one of them can be eligible: the one the reviewer decides is the author's.
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [author.entry_id, admin]);
    expect(await errorOf(db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [stranger.entry_id, admin]))).toBe("23505");
    // And once it is, nobody new can enter that video.
    expect(await errorOf(submit({ email: "c@example.test", canonical: "c@example.test", handle: "cee" }))).toBe("P1004");
  });

  it("frees a video once its eligible entry is ruled out", async () => {
    const first = await submit();
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [first.entry_id, admin]);
    expect(await errorOf(submit({ email: "c@example.test", canonical: "c@example.test", handle: "cee" }))).toBe("P1004");
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'ineligible', 'Not their video', $2, 1)`, [first.entry_id, admin]);
    expect((await submit({ email: "c@example.test", canonical: "c@example.test", handle: "cee" })).outcome).toBe("created");
  });

  it("keeps two short links that differ only in case as two videos", async () => {
    await submit({ url: "https://vm.tiktok.com/ZMabcDEF1" });
    const other = await submit({ email: "b@example.test", canonical: "b@example.test", handle: "bee", url: "https://vm.tiktok.com/ZMABCdef1" });
    expect(other.outcome).toBe("created");
    const keys = (await db.query<{ post_key: string }>(`SELECT post_key FROM rovv_entries ORDER BY post_key`)).rows.map((r) => r.post_key);
    expect(new Set(keys).size).toBe(2);
  });

  it("calls a new email spelling or newsletter choice an update, without voiding a review in progress", async () => {
    const { entry_id } = await submit();
    const rev = async () => (await db.query<{ revision: number; email: string }>(`SELECT revision, email FROM rovv_entries WHERE id = $1`, [entry_id])).rows[0];
    expect((await submit({ email: "Ada@Example.test" })).outcome).toBe("updated");
    expect(await rev()).toEqual({ revision: 1, email: "Ada@Example.test" });
    const r = await db.query<{ outcome: string }>(
      `SELECT * FROM submit_rovv_entry('rovv', 'Ada Obi', 'Ada@Example.test', 'ada@example.test', 'adaobi', $1, 'ADA123', '1.0', '1.0', true, NULL, NULL, false)`,
      [entry().url],
    );
    expect(r.rows[0].outcome).toBe("updated");
    expect((await rev()).revision).toBe(1);
  });
});

describe("replacing and reviewing", () => {
  it("counts a replacement in the revision, and refuses a ruling on a version since replaced", async () => {
    const { entry_id } = await submit();
    await submit();
    const rev = async () => (await db.query<{ revision: number }>(`SELECT revision FROM rovv_entries WHERE id = $1`, [entry_id])).rows[0].revision;
    expect(await rev(), "an unchanged resubmit is not a new version").toBe(1);
    await submit({ url: "https://tiktok.com/@adaobi/video/7300000000000000077" });
    expect(await rev()).toBe(2);
    // The reviewer loaded revision 1 and watched that video.
    expect(await errorOf(db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [entry_id, admin]))).toBe("P1012");
    expect(await errorOf(db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, NULL)`, [entry_id, admin]))).toBe("P1012");
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 2)`, [entry_id, admin]);
  });
});

describe("reviewing and picking", () => {
  it("needs a reason to rule an entry out, and keeps a winner eligible", async () => {
    const { entry_id } = await submit();
    expect(await errorOf(db.query(`SELECT * FROM decide_rovv_entry($1, 'ineligible', '  ', $2, 1)`, [entry_id, admin]))).toBe("P0402");
    expect(await errorOf(db.query(`SELECT * FROM decide_rovv_entry($1, 'maybe', NULL, $2, 1)`, [entry_id, admin]))).toBe("P1005");
    expect(await errorOf(db.query(`SELECT * FROM set_rovv_winner($1, true, $2)`, [entry_id, admin]))).toBe("P1008");
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [entry_id, admin]);
    expect((await db.query<{ winners: number }>(`SELECT * FROM set_rovv_winner($1, true, $2)`, [entry_id, admin])).rows[0].winners).toBe(1);
    expect(await errorOf(db.query(`SELECT * FROM decide_rovv_entry($1, 'ineligible', 'x', $2, 1)`, [entry_id, admin]))).toBe("P1006");
    const audit = (await db.query<{ action: string }>(`SELECT action FROM audit_log WHERE entity_type = 'rovv_entry' AND entity_id = $1 ORDER BY created_at`, [entry_id])).rows.map((r) => r.action);
    expect(audit).toEqual(["rovv_entry.eligible", "rovv_winner.picked"]);
  });

  it("never picks more than 20, and keeps a winner who has been emailed", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) {
      const r = await submit({ email: `p${i}@example.test`, canonical: `p${i}@example.test`, handle: `p${i}x`, url: `https://tiktok.com/@p${i}x/video/73000000000000001${String(i).padStart(2, "0")}` });
      await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [r.entry_id, admin]);
      ids.push(r.entry_id);
    }
    for (const id of ids.slice(0, 20)) await db.query(`SELECT * FROM set_rovv_winner($1, true, $2)`, [id, admin]);
    expect(await errorOf(db.query(`SELECT * FROM set_rovv_winner($1, true, $2)`, [ids[20], admin]))).toBe("P1009");
    // Picking a winner again is no change, not a 21st.
    expect((await db.query<{ winners: number }>(`SELECT * FROM set_rovv_winner($1, true, $2)`, [ids[0], admin])).rows[0].winners).toBe(20);
    await db.query(`UPDATE rovv_entries SET notified_at = now() WHERE id = $1`, [ids[0]]);
    expect(await errorOf(db.query(`SELECT * FROM set_rovv_winner($1, false, $2)`, [ids[0], admin]))).toBe("P1010");
    expect((await db.query<{ winners: number }>(`SELECT * FROM set_rovv_winner($1, false, $2)`, [ids[1], admin])).rows[0].winners).toBe(19);
    expect((await db.query<{ winners: number }>(`SELECT * FROM set_rovv_winner($1, true, $2)`, [ids[20], admin])).rows[0].winners).toBe(20);
  });
});

describe("test entries (0074)", () => {
  it("are taken outside the window, never meet a real entry, and leave every count alone", async () => {
    await db.exec(`UPDATE campaigns SET starts_at = now() + interval '1 day', ends_at = now() + interval '2 days' WHERE slug = 'rovv'`);
    expect(await errorOf(submit())).toBe("P1001");
    const t = await submit({ test: true });
    expect(t.outcome).toBe("created");
    // The same email as a real entry later, and a test of the same video: neither is in the way.
    await db.exec(`UPDATE campaigns SET starts_at = now() - interval '1 day', ends_at = now() + interval '1 day' WHERE slug = 'rovv'`);
    expect((await submit()).outcome).toBe("created");
    const rows = (await db.query<{ is_test: boolean }>(`SELECT is_test FROM rovv_entries ORDER BY is_test`)).rows;
    expect(rows.map((r) => r.is_test)).toEqual([false, true]);
  });

  it("still stop while the campaign is paused", async () => {
    await db.exec(`UPDATE campaigns SET paused_at = now(), paused_reason = 'x' WHERE slug = 'rovv'`);
    expect(await errorOf(submit({ test: true }))).toBe("P1002");
  });

  it("never take a real winner's place: the cap of 20 counts real winners only", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await submit({ email: `r${i}@example.test`, canonical: `r${i}@example.test`, handle: `r${i}x`, url: `https://tiktok.com/@r${i}x/video/73000000000000002${String(i).padStart(2, "0")}` });
      await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [r.entry_id, admin]);
      await db.query(`SELECT * FROM set_rovv_winner($1, true, $2)`, [r.entry_id, admin]);
    }
    const t = await submit({ test: true });
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [t.entry_id, admin]);
    expect((await db.query<{ winners: number }>(`SELECT * FROM set_rovv_winner($1, true, $2)`, [t.entry_id, admin])).rows[0].winners).toBe(20);
  });

  it("are deleted in one go, and nothing real with them", async () => {
    await submit();
    await submit({ test: true });
    await submit({ test: true, email: "t2@example.test", canonical: "t2@example.test" });
    const r = await db.query<{ deleted: number }>(`SELECT * FROM clear_rovv_test_entries('rovv', $1)`, [admin]);
    expect(r.rows[0].deleted).toBe(2);
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM rovv_entries`)).rows[0].n).toBe(1);
    expect(await errorOf(db.query(`SELECT * FROM clear_rovv_test_entries('rovv', NULL)`))).toBe("P0401");
  });
});

describe("fixing a ruled-out entry (0074)", () => {
  it("lets the same person send it again, which puts it back to waiting as a new version", async () => {
    const { entry_id } = await submit();
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'ineligible', 'Not tagged', $2, 1)`, [entry_id, admin]);
    // The usual fix (adding the tag) happens on TikTok, so the link can be the same.
    const again = await submit();
    expect(again).toEqual({ entry_id, outcome: "updated" });
    const row = (await db.query<{ status: string; review_note: string | null; reviewed_at: Date | null; revision: number }>(
      `SELECT status, review_note, reviewed_at, revision FROM rovv_entries WHERE id = $1`, [entry_id])).rows[0];
    expect(row).toEqual({ status: "pending", review_note: null, reviewed_at: null, revision: 2 });
  });

  it("never lets an accepted entry be swapped", async () => {
    const { entry_id } = await submit();
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [entry_id, admin]);
    expect(await errorOf(submit({ url: "https://tiktok.com/@adaobi/video/7300000000000000555" }))).toBe("P1003");
  });

  it("says what a ruling changed from, so only a change is emailed", async () => {
    const { entry_id } = await submit();
    const first = (await db.query<{ previous: string }>(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [entry_id, admin])).rows[0];
    const again = (await db.query<{ previous: string }>(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [entry_id, admin])).rows[0];
    expect([first.previous, again.previous]).toEqual(["pending", "eligible"]);
  });
});

describe("ticket codes (0074)", () => {
  async function winner(i = 0) {
    const r = await submit({ email: `w${i}@example.test`, canonical: `w${i}@example.test`, handle: `w${i}x`, url: `https://tiktok.com/@w${i}x/video/73000000000000003${String(i).padStart(2, "0")}` });
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [r.entry_id, admin]);
    await db.query(`SELECT * FROM set_rovv_winner($1, true, $2)`, [r.entry_id, admin]);
    return r.entry_id;
  }
  const setCode = (id: string, code: string) => db.query(`SELECT * FROM set_rovv_ticket_code($1, $2, $3)`, [id, code, admin]);

  it("goes only to a winner, one each, of the right shape, and is cleared with an empty one", async () => {
    const { entry_id: notWinner } = await submit({ email: "n@example.test", canonical: "n@example.test", handle: "nn", url: "https://tiktok.com/@nn/video/7300000000000000999" });
    expect(await errorOf(setCode(notWinner, "BUIDL-1"))).toBe("P1014");
    const a = await winner(0);
    const b = await winner(1);
    await setCode(a, "  BUIDL-1 ");
    expect(await errorOf(setCode(b, "BUIDL-1"))).toBe("P1015");
    expect(await errorOf(setCode(b, "has space"))).toBe("P1016");
    await setCode(a, "");
    await setCode(b, "BUIDL-1");
    const codes = (await db.query<{ ticket_code: string | null }>(`SELECT ticket_code FROM rovv_entries WHERE id IN ($1, $2) ORDER BY email`, [a, b])).rows;
    expect(codes.map((c) => c.ticket_code)).toEqual([null, "BUIDL-1"]);
    const audit = (await db.query<{ action: string; after: Record<string, unknown> }>(`SELECT action, after FROM audit_log WHERE action LIKE 'rovv_code.%' ORDER BY created_at`)).rows;
    expect(audit.map((x) => x.action)).toEqual(["rovv_code.set", "rovv_code.cleared", "rovv_code.set"]);
    expect(JSON.stringify(audit), "the code itself is never written to the audit log").not.toContain("BUIDL-1");
  });

  it("is fixed once the winner is emailed, refused while they are being emailed, and goes with an unpick", async () => {
    const a = await winner(2);
    await setCode(a, "CODE-A");
    await db.query(`UPDATE rovv_entries SET notice_claimed_at = now() WHERE id = $1`, [a]);
    expect(await errorOf(setCode(a, "CODE-B"))).toBe("P1011");
    await db.query(`UPDATE rovv_entries SET notice_claimed_at = NULL, notified_at = now() WHERE id = $1`, [a]);
    expect(await errorOf(setCode(a, "CODE-B"))).toBe("P1013");

    const b = await winner(3);
    await setCode(b, "CODE-C");
    await db.query(`SELECT * FROM set_rovv_winner($1, false, $2)`, [b, admin]);
    expect((await db.query<{ ticket_code: string | null }>(`SELECT ticket_code FROM rovv_entries WHERE id = $1`, [b])).rows[0].ticket_code).toBeNull();
  });
});

describe("handing out a pasted list of codes (0074)", () => {
  async function winner(i: number, test = false) {
    const r = await submit({ email: `h${i}@example.test`, canonical: `h${i}@example.test`, handle: `h${i}x`, url: `https://tiktok.com/@h${i}x/video/73000000000000004${String(i).padStart(2, "0")}`, test });
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'eligible', NULL, $2, 1)`, [r.entry_id, admin]);
    await db.query(`SELECT * FROM set_rovv_winner($1, true, $2)`, [r.entry_id, admin]);
    // Picked in order, a second apart, as real picks are; a frozen clock would tie them.
    await db.query(`UPDATE rovv_entries SET winner_at = now() - interval '1 hour' + $2 * interval '1 second' WHERE id = $1`, [r.entry_id, i]);
    return r.entry_id;
  }
  const assign = (codes: string[], test = false) =>
    db.query<{ entry_id: string; handle: string; code: string }>(`SELECT * FROM assign_rovv_ticket_codes('rovv', $1, $2, $3)`, [codes, test, admin]);

  it("gives one code each, in the order the winners were picked, skipping anyone who has one or was emailed", async () => {
    const a = await winner(1);
    const b = await winner(2);
    const c = await winner(3);
    const d = await winner(4);
    await db.query(`SELECT * FROM set_rovv_ticket_code($1, 'KEPT-1', $2)`, [b, admin]);
    await db.query(`UPDATE rovv_entries SET notified_at = now() WHERE id = $1`, [c]);
    const out = (await assign(["C-1", "C-2", "C-3"])).rows;
    expect(out.map((r) => [r.entry_id, r.code])).toEqual([[a, "C-1"], [d, "C-2"]]);
    const codes = (await db.query<{ id: string; ticket_code: string | null }>(`SELECT id, ticket_code FROM rovv_entries WHERE id IN ($1,$2,$3,$4)`, [a, b, c, d])).rows;
    const byId = Object.fromEntries(codes.map((r) => [r.id, r.ticket_code]));
    expect([byId[a], byId[b], byId[c], byId[d]]).toEqual(["C-1", "KEPT-1", "C-1" === byId[c] ? "never" : byId[c], "C-2"]);
    expect(byId[c]).toBeNull();
  });

  it("leaves the last winners waiting when there are fewer codes than winners", async () => {
    const a = await winner(5);
    const b = await winner(6);
    expect((await assign(["ONLY-1"])).rows.map((r) => r.entry_id)).toEqual([a]);
    expect((await db.query<{ ticket_code: string | null }>(`SELECT ticket_code FROM rovv_entries WHERE id = $1`, [b])).rows[0].ticket_code).toBeNull();
  });

  it("refuses the whole list for a repeat (in any case), a bad code or a code already held, saving nothing", async () => {
    const a = await winner(7);
    const b = await winner(8);
    expect(await errorOf(assign(["X-1", "x-1"]))).toBe("P1017");
    expect(await errorOf(assign(["X-1", "no good"]))).toBe("P1016");
    await db.query(`SELECT * FROM set_rovv_ticket_code($1, 'HELD-1', $2)`, [a, admin]);
    expect(await errorOf(assign(["NEW-1", "held-1"]))).toBe("P1015");
    expect((await db.query<{ ticket_code: string | null }>(`SELECT ticket_code FROM rovv_entries WHERE id = $1`, [b])).rows[0].ticket_code).toBeNull();
  });

  it("gives test codes to test winners and real codes to real winners, never across", async () => {
    const real = await winner(9);
    const test = await winner(10, true);
    expect((await assign(["T-1"], true)).rows.map((r) => r.entry_id)).toEqual([test]);
    expect((await assign(["R-1"])).rows.map((r) => r.entry_id)).toEqual([real]);
  });

  it("writes how many went to the audit log, never the codes", async () => {
    await db.exec(`DELETE FROM audit_log WHERE action = 'rovv_code.assigned'`);
    await winner(11);
    await assign(["SECRET-1", "SECRET-2"]);
    const audit = (await db.query<{ after: Record<string, unknown> }>(`SELECT after FROM audit_log WHERE action = 'rovv_code.assigned'`)).rows;
    expect(audit.map((r) => r.after)).toEqual([{ assigned: 1, pasted: 2, test: false }]);
    expect(JSON.stringify(audit)).not.toContain("SECRET");
  });
});

describe("which ruling the entrant was last emailed (0074)", () => {
  it("is forgotten when they replace the entry, so a ruling on the new one is news", async () => {
    const { entry_id } = await submit();
    await db.query(`SELECT * FROM decide_rovv_entry($1, 'ineligible', 'Not tagged', $2, 1)`, [entry_id, admin]);
    await db.query(`UPDATE rovv_entries SET ruling_emailed = 'ineligible' WHERE id = $1`, [entry_id]);
    await submit();
    const row = (await db.query<{ ruling_emailed: string | null }>(`SELECT ruling_emailed FROM rovv_entries WHERE id = $1`, [entry_id])).rows[0];
    expect(row.ruling_emailed).toBeNull();
  });

  it("is kept through a resubmission that changes nothing a reviewer judges", async () => {
    const { entry_id } = await submit();
    await db.query(`UPDATE rovv_entries SET ruling_emailed = 'eligible' WHERE id = $1`, [entry_id]);
    await submit({ email: "Ada@Example.test" });
    const row = (await db.query<{ ruling_emailed: string | null }>(`SELECT ruling_emailed FROM rovv_entries WHERE id = $1`, [entry_id])).rows[0];
    expect(row.ruling_emailed).toBe("eligible");
  });
});

describe("the deploy still serving while 0074 applies", () => {
  it("can still enter with 0073's twelve arguments, as a real entry", async () => {
    const r = await db.query<{ outcome: string }>(
      `SELECT * FROM submit_rovv_entry('rovv', 'Old Deploy', 'old@example.test', 'old@example.test', 'olddeploy',
         'https://tiktok.com/@olddeploy/video/7300000000000000888', 'OLD123', '1.0', '1.0', false, NULL, NULL)`,
    );
    expect(r.rows[0].outcome).toBe("created");
    const row = (await db.query<{ is_test: boolean }>(`SELECT is_test FROM rovv_entries WHERE email = 'old@example.test'`)).rows[0];
    expect(row.is_test).toBe(false);
  });
});

describe("purging", () => {
  it("deletes Rovv's entries with Rovv's purge, never with Monica's", async () => {
    await submit();
    await db.query(`SELECT * FROM purge_campaign_data('monica-money-story', 'monica-money-story')`);
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM rovv_entries`)).rows[0].n).toBe(1);
    const out = (await db.query<{ table_name: string; rows_deleted: number }>(`SELECT * FROM purge_campaign_data('rovv', 'rovv')`)).rows;
    expect(out.find((r) => r.table_name === "rovv_entries")).toEqual({ table_name: "rovv_entries", rows_deleted: 1 });
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM rovv_entries`)).rows[0].n).toBe(0);
  });
});
