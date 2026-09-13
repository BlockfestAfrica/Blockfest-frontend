/**
 * Server-minted admin sessions, against a real Postgres (#138).
 *
 * The Identity credential is spent once at sign-in and what the browser holds
 * afterwards is an opaque token whose SHA-256 is a row here. These exercise the
 * three functions 0029 adds directly, because the properties that matter,
 * expiry, revocation, pruning, are database behaviour a mocked unit test cannot
 * prove.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let ownerId: string;
let ownerEmail: string;
let ownerIdentity: string;

const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> =>
  (await db.query<T>(sql, params)).rows[0];

const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(sql, params)).rows[0].n);

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const HASH_A = hash("token-a");
const HASH_B = hash("token-b");

const create = (email: string, identity: string, tokenHash: string) =>
  db.query(`SELECT * FROM create_admin_session($1, $2, $3)`, [email, identity, tokenHash]);

const touch = (tokenHash: string) =>
  db.query<{ admin_id: string; admin_role: string; admin_email: string; expires_at: string }>(
    `SELECT * FROM touch_admin_session($1)`,
    [tokenHash],
  );

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM admin_sessions; DELETE FROM audit_log;`);
  const owner = await one<{ id: string; email_canonical: string }>(
    `SELECT id, email_canonical FROM admin_users
      WHERE email_canonical = 'partnership@blockfestafrica.com'`,
  );
  ownerId = owner.id;
  ownerEmail = owner.email_canonical;
  ownerIdentity = "acct-owner";
  /*
   * Reset the whole admin row, not just the sessions. Individual tests revoke
   * the owner and rebind identity, and without restoring is_active and the
   * binding here, every test after the first revoke would find a revoked owner
   * and create_admin_session would return nothing. The trigger is re-enabled
   * too, in case a test left it off.
   */
  await db.query(
    `UPDATE admin_users
        SET is_active = true, revoked_at = NULL, revoked_reason = NULL,
            identity_user_id = 'acct-owner'
      WHERE id = $1`,
    [ownerId],
  );
  await db.exec(`ALTER TABLE admin_users ENABLE TRIGGER admin_sessions_end_on_revoke`);
});

describe("creating a session", () => {
  it("returns the admin and a twelve-hour expiry, and inserts one row", async () => {
    const { rows } = await create(ownerEmail, ownerIdentity, HASH_A);
    expect(rows.length).toBe(1);
    const row = rows[0] as { admin_id: string; admin_email: string; expires_at: string };
    expect(row.admin_id).toBe(ownerId);
    expect(row.admin_email).toBe(ownerEmail);

    const ms = new Date(row.expires_at).getTime() - Date.now();
    expect(ms).toBeGreaterThan(11.9 * 3600_000);
    expect(ms).toBeLessThan(12.1 * 3600_000);
    expect(await count(`SELECT count(*)::int AS n FROM admin_sessions`)).toBe(1);
  });

  it("returns nothing for an unknown address, and writes no row", async () => {
    const { rows } = await create("nobody@example.com", "acct-x", HASH_A);
    expect(rows.length).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM admin_sessions`)).toBe(0);
  });

  it("returns nothing when the address is bound to a different identity", async () => {
    // TOFU binding: the seeded owner is bound to ownerIdentity. A different id
    // on the same address is an impostor.
    const { rows } = await create(ownerEmail, "acct-attacker", HASH_A);
    expect(rows.length).toBe(0);
  });

  it("returns nothing for a malformed hash, and writes no row", async () => {
    for (const bad of ["short", "ABC".repeat(21) + "z", "g".repeat(64)]) {
      const { rows } = await create(ownerEmail, ownerIdentity, bad);
      expect(rows.length, bad).toBe(0);
    }
    expect(await count(`SELECT count(*)::int AS n FROM admin_sessions`)).toBe(0);
  });
});

describe("touching a session", () => {
  it("returns the admin and advances both last_seen_at values", async () => {
    await create(ownerEmail, ownerIdentity, HASH_A);
    await db.query(`UPDATE admin_sessions SET last_seen_at = now() - interval '1 hour'`);
    await db.query(`UPDATE admin_users SET last_seen_at = now() - interval '1 hour' WHERE id = $1`, [ownerId]);

    const { rows } = await touch(HASH_A);
    expect(rows.length).toBe(1);
    expect(rows[0].admin_email).toBe(ownerEmail);

    const sessionSeen = await one<{ last_seen_at: string }>(`SELECT last_seen_at FROM admin_sessions LIMIT 1`);
    expect(Date.now() - new Date(sessionSeen.last_seen_at).getTime()).toBeLessThan(60_000);
    const adminSeen = await one<{ last_seen_at: string }>(`SELECT last_seen_at FROM admin_users WHERE id = $1`, [ownerId]);
    expect(Date.now() - new Date(adminSeen.last_seen_at).getTime()).toBeLessThan(60_000);
  });

  it("returns nothing once the session has expired", async () => {
    // The bug this catches is an inverted comparison, which makes every session
    // immortal.
    await create(ownerEmail, ownerIdentity, HASH_A);
    await db.query(`UPDATE admin_sessions SET expires_at = now() - interval '1 minute'`);
    expect((await touch(HASH_A)).rows.length).toBe(0);
  });

  it("returns nothing when the admin is no longer active", async () => {
    // Per-request revocation, the property the whole codebase rests on. The
    // trigger deletes rows on revoke, so disable it to test the touch guard
    // itself, then set is_active directly.
    await create(ownerEmail, ownerIdentity, HASH_A);
    await db.query(`ALTER TABLE admin_users DISABLE TRIGGER admin_sessions_end_on_revoke`);
    await db.query(`UPDATE admin_users SET is_active = false, revoked_at = now(), revoked_reason = 'test' WHERE id = $1`, [ownerId]);
    expect((await touch(HASH_A)).rows.length).toBe(0);
    await db.query(`ALTER TABLE admin_users ENABLE TRIGGER admin_sessions_end_on_revoke`);
  });

  it("returns nothing for a malformed hash without touching the table", async () => {
    expect((await touch("nope")).rows.length).toBe(0);
  });
});

describe("revoking an admin", () => {
  it("ends their live sessions in the same UPDATE", async () => {
    // The one-UPDATE runbook since 0009 must now also end consoles.
    await create(ownerEmail, ownerIdentity, HASH_A);
    await create(ownerEmail, ownerIdentity, HASH_B);
    expect(await count(`SELECT count(*)::int AS n FROM admin_sessions`)).toBe(2);

    await db.query(
      `UPDATE admin_users SET is_active = false, revoked_at = now(), revoked_reason = 'compromised' WHERE id = $1`,
      [ownerId],
    );
    expect(await count(`SELECT count(*)::int AS n FROM admin_sessions`)).toBe(0);
  });
});

describe("bounding the table", () => {
  it("keeps only the five newest sessions per admin", async () => {
    for (let i = 0; i < 6; i += 1) {
      await create(ownerEmail, ownerIdentity, hash(`t-${i}`));
    }
    expect(await count(`SELECT count(*)::int AS n FROM admin_sessions WHERE admin_id = $1`, [ownerId])).toBe(5);
  });

  it("prunes the least recently seen, not the newest", async () => {
    await create(ownerEmail, ownerIdentity, hash("keep-me"));
    // Make it the freshest by touching, then flood.
    await touch(hash("keep-me"));
    for (let i = 0; i < 6; i += 1) {
      await create(ownerEmail, ownerIdentity, hash(`flood-${i}`));
      await db.query(`UPDATE admin_sessions SET last_seen_at = now() - interval '2 hours'
                       WHERE token_hash = $1`, [hash(`flood-${i}`)]);
    }
    // keep-me was seen most recently, so it survives.
    expect((await touch(hash("keep-me"))).rows.length).toBe(1);
  });
});

describe("two machines for the shared inbox", () => {
  it("signing out one leaves the other alive", async () => {
    await create(ownerEmail, ownerIdentity, HASH_A);
    await create(ownerEmail, ownerIdentity, HASH_B);

    await db.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [HASH_A]);

    expect((await touch(HASH_A)).rows.length, "signed out").toBe(0);
    expect((await touch(HASH_B)).rows.length, "other machine survives").toBe(1);
  });
});

describe("the unique hash constraint", () => {
  it("refuses a duplicate token hash", async () => {
    await create(ownerEmail, ownerIdentity, HASH_A);
    await expect(
      db.query(
        `INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '1 hour')`,
        [ownerId, HASH_A],
      ),
    ).rejects.toThrow();
  });
});
