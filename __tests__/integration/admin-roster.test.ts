/**
 * Who has console access, read back correctly.
 *
 * The roster is set by migration and was readable only in psql, so the
 * console could not answer "who can see the review queue" about itself.
 * These assertions are mostly about what the query must NOT do: it runs
 * against a table holding a credential column and joins one holding session
 * hashes, and the page renders every field it returns.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;

/** Strip comments, so a docstring describing a rule cannot break it. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const ROSTER_SQL = `
  SELECT a.id, a.email, a.role, a.is_active, a.created_at,
         count(s.id) FILTER (WHERE s.expires_at > now())::int AS live_sessions,
         max(s.last_seen_at) AS last_seen_at
    FROM admin_users a
    LEFT JOIN admin_sessions s ON s.admin_id = a.id
   GROUP BY a.id, a.email, a.role, a.is_active, a.created_at
   ORDER BY a.role = 'owner' DESC, a.is_active DESC, a.email ASC
`;

const roster = async () =>
  (
    await db.query<{
      id: string;
      email: string;
      role: string;
      is_active: boolean;
      live_sessions: number;
      last_seen_at: string | null;
    }>(ROSTER_SQL)
  ).rows;

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM admin_sessions`);
});

describe("the admin roster", () => {
  it("lists the admins the migrations seeded, owners first", async () => {
    const rows = await roster();
    expect(rows.length, "0009 seeds two owners, 0033 adds a reviewer")
      .toBeGreaterThanOrEqual(3);
    expect(rows[0].role).toBe("owner");
    expect(rows.map((r) => r.email)).toContain("partnership@blockfestafrica.com");
    expect(rows.map((r) => r.email)).toContain("marketing@blockfestafrica.com");
  });

  it("counts only sessions that have not expired", async () => {
    const admin = (
      await db.query<{ id: string }>(
        `SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`,
      )
    ).rows[0];

    await db.query(
      `INSERT INTO admin_sessions (admin_id, token_hash, expires_at, last_seen_at)
       VALUES ($1, 'hash-live', now() + interval '6 hours', now())`,
      [admin.id],
    );
    await db.query(
      `INSERT INTO admin_sessions (admin_id, token_hash, expires_at, last_seen_at)
       VALUES ($1, 'hash-dead', now() - interval '1 hour', now() - interval '2 hours')`,
      [admin.id],
    );

    const mine = (await roster()).find((r) => r.id === admin.id);
    expect(mine?.live_sessions, "the expired one is not access").toBe(1);
  });

  it("shows never for an admin who has not signed in", async () => {
    const rows = await roster();
    expect(rows.every((r) => r.live_sessions === 0)).toBe(true);
    expect(rows.every((r) => r.last_seen_at === null)).toBe(true);
  });

  it("returns a row per admin, not a row per session", async () => {
    // A join without the grouping would list somebody three times for having
    // three devices, and the page renders one row per result.
    const admin = (
      await db.query<{ id: string }>(
        `SELECT id FROM admin_users WHERE email_canonical = 'marketing@blockfestafrica.com'`,
      )
    ).rows[0];
    for (const tag of ["a", "b", "c"]) {
      await db.query(
        `INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '6 hours')`,
        [admin.id, `hash-${tag}`],
      );
    }
    const rows = await roster();
    expect(rows.filter((r) => r.id === admin.id)).toHaveLength(1);
    expect(rows.find((r) => r.id === admin.id)?.live_sessions).toBe(3);
  });

  it("never selects the credential column or a session token", () => {
    /*
     * Read against the real module, not the copy above.
     *
     * Asserting on ROSTER_SQL would only prove this test file is safe, and
     * would stay green the day somebody widens the production query. The
     * page renders every field the query returns, admin_users carries a
     * credential column, and admin_sessions carries a SHA-256 of a live
     * session token, so the thing worth pinning is the source that ships.
     */
    /* Comments stripped first. The module's own docstring explains that
       password_hash is never selected, and a check that reads prose would
       fail on the sentence promising the thing it is checking. */
    const source = codeOnly(
      readFileSync(join(process.cwd(), "lib/admin/admins.ts"), "utf8"),
    );
    expect(source).not.toMatch(/password_hash/);
    expect(source).not.toMatch(/token_hash/);
    expect(source, "no star select can widen it by accident").not.toMatch(
      /SELECT\s+\*|\ba\.\*|\bs\.\*/i,
    );
  });

  it("keeps the shipped query and this test's copy in step", () => {
    // The copy above is what the other assertions exercise. If the real one
    // drifts from it, those assertions stop describing production.
    const source = codeOnly(
      readFileSync(join(process.cwd(), "lib/admin/admins.ts"), "utf8"),
    );
    const normalise = (q: string) => q.replace(/\s+/g, " ").trim().toLowerCase();
    expect(normalise(source)).toContain(
      normalise("FROM admin_users a LEFT JOIN admin_sessions s ON s.admin_id = a.id"),
    );
    expect(normalise(source)).toContain(
      normalise("count(s.id) FILTER (WHERE s.expires_at > now())"),
    );
  });
});
