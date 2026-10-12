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
  ...o,
});

async function submit(o: Partial<Record<string, unknown>> = {}) {
  const e = entry(o);
  const r = await db.query<{ entry_id: string; outcome: string }>(
    `SELECT * FROM submit_rovv_entry('rovv', $1, $2, $3, $4, $5, $6, '1.0', '1.0', false, '198.51.100.1', 'test')`,
    [e.name, e.email, e.canonical, e.handle, e.url, e.code],
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
      `SELECT * FROM submit_rovv_entry('rovv', 'Ada Obi', 'Ada@Example.test', 'ada@example.test', 'adaobi', $1, 'ADA123', '1.0', '1.0', true, NULL, NULL)`,
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
