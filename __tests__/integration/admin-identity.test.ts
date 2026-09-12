/**
 * Who counts as an admin, against a real Postgres.
 *
 * Netlify Identity says which verified address is signed in. It cannot say
 * whether that person is still an admin: roles ride in a token that stays valid
 * for about an hour and is not invalidated when a role is stripped. So a stolen
 * laptop would keep approving entries for an hour after being revoked, against
 * the surface that decides how 5,000,000 naira is split.
 *
 * resolve_admin is the answer to that, and these assertions are mostly about
 * what it refuses.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;

const rows = async (sql: string) => (await db.query(sql)).rows;
const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

const resolve = (email: string, identityId: string) =>
  db.query<{ admin_id: string; admin_role: string }>(
    `SELECT * FROM resolve_admin('${email}', '${identityId}')`,
  );

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    UPDATE admin_users
       SET identity_user_id = NULL, identity_bound_at = NULL, last_seen_at = NULL,
           is_active = true, revoked_at = NULL, revoked_reason = NULL;
  `);
});

describe("the seeded admins", () => {
  it("includes both named owners", async () => {
    expect(
      await count(
        `SELECT count(*)::int AS n FROM admin_users
          WHERE email_canonical IN ('partnership@blockfestafrica.com','heedris2olubisi@gmail.com')
            AND role = 'owner' AND is_active`,
      ),
    ).toBe(2);
  });

  it("stores no password, because authentication is delegated", async () => {
    // The column is NOT NULL and unused. A sentinel records that rather than a
    // hash of anything, and no hashing scheme produces this string.
    expect(
      await count(
        `SELECT count(*)::int AS n FROM admin_users WHERE password_hash <> 'netlify-identity'`,
      ),
    ).toBe(0);
  });
});

describe("resolving a signed-in user", () => {
  it("resolves a known active admin", async () => {
    const r = await resolve("partnership@blockfestafrica.com", "netlify-user-1");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].admin_role).toBe("owner");
  });

  it("binds the Netlify account on first use", async () => {
    await resolve("heedris2olubisi@gmail.com", "netlify-user-2");
    expect(
      await count(
        `SELECT count(*)::int AS n FROM admin_users
          WHERE email_canonical = 'heedris2olubisi@gmail.com'
            AND identity_user_id = 'netlify-user-2'
            AND identity_bound_at IS NOT NULL`,
      ),
    ).toBe(1);
  });

  it("keeps resolving the same account afterwards", async () => {
    await resolve("heedris2olubisi@gmail.com", "netlify-user-2");
    const again = await resolve("heedris2olubisi@gmail.com", "netlify-user-2");
    expect(again.rows).toHaveLength(1);
  });

  /**
   * The address matches an admin but the account behind it does not. Either
   * somebody else's Netlify account now carries this address, or the row was
   * bound to a different one. Neither is the person who was invited.
   */
  it("refuses a different Netlify account on a bound address", async () => {
    await resolve("heedris2olubisi@gmail.com", "netlify-user-2");
    const impostor = await resolve("heedris2olubisi@gmail.com", "netlify-user-EVIL");
    expect(impostor.rows).toHaveLength(0);
  });

  it("is case and whitespace insensitive about the address", async () => {
    const r = await resolve("  HEEDRIS2OLUBISI@Gmail.com  ", "netlify-user-2");
    expect(r.rows).toHaveLength(1);
  });

  it("records when they were last seen", async () => {
    await resolve("partnership@blockfestafrica.com", "netlify-user-1");
    expect(
      await count(
        `SELECT count(*)::int AS n FROM admin_users
          WHERE email_canonical = 'partnership@blockfestafrica.com'
            AND last_seen_at IS NOT NULL`,
      ),
    ).toBe(1);
  });
});

describe("what it refuses", () => {
  it("refuses an address that is not an admin", async () => {
    const r = await resolve("stranger@example.com", "netlify-user-9");
    expect(r.rows).toHaveLength(0);
  });

  /** The whole reason authorisation is not read from the token. */
  it("refuses a revoked admin immediately", async () => {
    await resolve("partnership@blockfestafrica.com", "netlify-user-1");
    await db.query(`
      UPDATE admin_users SET is_active = false, revoked_at = now(),
                             revoked_reason = 'laptop lost'
       WHERE email_canonical = 'partnership@blockfestafrica.com'`);

    const after = await resolve("partnership@blockfestafrica.com", "netlify-user-1");
    expect(after.rows).toHaveLength(0);
  });

  it("refuses an empty address or an empty account id", async () => {
    expect((await resolve("", "netlify-user-1")).rows).toHaveLength(0);
    expect(
      (await resolve("partnership@blockfestafrica.com", "")).rows,
    ).toHaveLength(0);
  });

  it("answers identically for unknown, revoked and mismatched", async () => {
    // A caller who can tell these apart can enumerate the admin list by trying
    // addresses. All three are the empty set.
    await resolve("heedris2olubisi@gmail.com", "netlify-user-2");
    await db.query(`
      UPDATE admin_users SET is_active = false, revoked_at = now()
       WHERE email_canonical = 'partnership@blockfestafrica.com'`);

    const unknown = await resolve("nobody@example.com", "x");
    const revoked = await resolve("partnership@blockfestafrica.com", "netlify-user-1");
    const mismatched = await resolve("heedris2olubisi@gmail.com", "wrong-account");

    expect(unknown.rows).toEqual([]);
    expect(revoked.rows).toEqual([]);
    expect(mismatched.rows).toEqual([]);
  });

  it("will not let one Netlify account back two admin rows", async () => {
    await resolve("partnership@blockfestafrica.com", "shared-account");
    await expect(
      resolve("heedris2olubisi@gmail.com", "shared-account"),
    ).rejects.toThrow();
  });
});

describe("revocation bookkeeping", () => {
  it("refuses an inactive admin with no revocation time", async () => {
    // Revocation has to be answerable after the fact: who, when and why.
    await expect(
      db.query(
        `UPDATE admin_users SET is_active = false WHERE email_canonical = 'heedris2olubisi@gmail.com'`,
      ),
    ).rejects.toThrow();
  });

  it("refuses an active admin that carries a revocation time", async () => {
    await expect(
      db.query(
        `UPDATE admin_users SET revoked_at = now() WHERE email_canonical = 'heedris2olubisi@gmail.com'`,
      ),
    ).rejects.toThrow();
  });
});

describe("deleting an admin", () => {
  /**
   * Every foreign key pointing at admin_users is ON DELETE SET NULL:
   * audit_log, point_ledger, point_rules, resources, submissions and votes. So
   * one DELETE silently strips a person's name from every approval they made
   * and every point they awarded, while leaving the points in place. The ledger
   * would still say the money was earned and nothing would say who decided it.
   */
  it("is refused outright", async () => {
    await expect(
      db.query(
        `DELETE FROM admin_users WHERE email_canonical = 'heedris2olubisi@gmail.com'`,
      ),
    ).rejects.toThrow(/never deleted/i);
  });

  it("leaves the row and its history intact after the attempt", async () => {
    await db
      .query(`DELETE FROM admin_users WHERE email_canonical = 'heedris2olubisi@gmail.com'`)
      .catch(() => {});
    expect(
      await count(
        `SELECT count(*)::int AS n FROM admin_users WHERE email_canonical = 'heedris2olubisi@gmail.com'`,
      ),
    ).toBe(1);
  });

  it("points at revocation in the error, since that is the real operation", async () => {
    const err = await db
      .query(`DELETE FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`)
      .catch((e: unknown) => e);
    expect(String(err)).toMatch(/revoke/i);
  });

  it("refuses even when nothing references that admin yet", async () => {
    // The trigger does not check for references. An admin with no history
    // today has history tomorrow, and a rule that depends on the data is a rule
    // that stops applying at the worst moment.
    await db.query(`
      INSERT INTO admin_users (email, email_canonical, password_hash, role)
      VALUES ('fresh@example.com', 'fresh@example.com', 'netlify-identity', 'reviewer')`);
    await expect(
      db.query(`DELETE FROM admin_users WHERE email_canonical = 'fresh@example.com'`),
    ).rejects.toThrow();
    await db.query(`
      UPDATE admin_users SET is_active = false, revoked_at = now()
       WHERE email_canonical = 'fresh@example.com'`);
    expect(await rows(`SELECT 1 FROM admin_users WHERE email_canonical = 'fresh@example.com'`)).toHaveLength(1);
  });
});
