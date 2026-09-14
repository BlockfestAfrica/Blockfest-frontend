/**
 * Self-service link recovery, against a real Postgres. Closes #206, successor
 * to #78.
 *
 * lib/creator-recovery.ts issues its queries through drizzle, which this
 * suite does not run (drizzle needs the Neon HTTP driver, not PGlite). What
 * it CAN and must verify is the schema and the exact query shape those
 * functions depend on: that 0053_creator_link_recovery.sql actually adds the
 * two columns, and that the single UPDATE confirmAccessRecovery issues
 * behaves the way its own comment claims — matching on hash and expiry,
 * clearing both columns in the same statement, and therefore refusing a
 * second attempt with the same token without any separate "consumed" flag.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

const SLUG = "monica-money-story";

let db: PGlite;
let seq = 0;

const register = () => {
  const t = `${++seq}`;
  return db.query<{ campaign_creator_id: string }>(
    `SELECT * FROM register_creator($1,$2,$3,$4,$5,$6,$7,NULL,NULL,$8,NULL,NULL,$9,
       '1.2.3.4','test',$10,'1.0',false,'1.0',NULL)`,
    [
      SLUG, `Creator ${t}`, `c${t}@e.com`, `c${t}@e.com`,
      `080${t.padStart(8, "0")}`, `+23480${t.padStart(8, "0")}`, "finance",
      `handle${t}`, null, `CODE${t}`,
    ],
  );
};

/** The exact shape of the UPDATE in lib/creator-recovery.ts's
 *  confirmAccessRecovery, run directly against PGlite. */
const confirm = (hash: string, newAccessHash: string) =>
  db.query<{ id: string }>(
    `UPDATE campaign_creators
        SET access_token_hash = $2,
            access_token_issued_at = now(),
            recovery_token_hash = NULL,
            recovery_token_expires_at = NULL
      WHERE recovery_token_hash = $1
        AND recovery_token_expires_at > now()
      RETURNING id`,
    [hash, newAccessHash],
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
    DELETE FROM submissions; DELETE FROM challenge_entries;
    DELETE FROM creator_social_handles; DELETE FROM campaign_creators;
    DELETE FROM creators; DELETE FROM audit_log;
  `);
});

describe("the columns 0053 adds", () => {
  it("lets a recovery token be parked without touching the access token", async () => {
    const { rows } = await register();
    const enrolmentId = rows[0].campaign_creator_id;

    const before = await db.query<{ access_token_hash: string | null }>(
      `SELECT access_token_hash FROM campaign_creators WHERE id = $1`,
      [enrolmentId],
    );

    await db.query(
      `UPDATE campaign_creators
          SET recovery_token_hash = 'deadbeef',
              recovery_token_expires_at = now() + interval '30 minutes'
        WHERE id = $1`,
      [enrolmentId],
    );

    const after = await db.query<{
      access_token_hash: string | null;
      recovery_token_hash: string | null;
    }>(
      `SELECT access_token_hash, recovery_token_hash FROM campaign_creators WHERE id = $1`,
      [enrolmentId],
    );

    expect(
      after.rows[0].access_token_hash,
      "requesting recovery must not rotate the working link",
    ).toBe(before.rows[0].access_token_hash);
    expect(after.rows[0].recovery_token_hash).toBe("deadbeef");
  });
});

describe("confirming a recovery, at the SQL level", () => {
  it("rotates the access token and clears the recovery token together", async () => {
    const { rows } = await register();
    const enrolmentId = rows[0].campaign_creator_id;

    await db.query(
      `UPDATE campaign_creators
          SET recovery_token_hash = 'hash-1',
              recovery_token_expires_at = now() + interval '30 minutes'
        WHERE id = $1`,
      [enrolmentId],
    );

    const result = await confirm("hash-1", "new-access-hash");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(enrolmentId);

    const row = await db.query<{
      access_token_hash: string;
      recovery_token_hash: string | null;
      recovery_token_expires_at: string | null;
    }>(
      `SELECT access_token_hash, recovery_token_hash, recovery_token_expires_at
         FROM campaign_creators WHERE id = $1`,
      [enrolmentId],
    );
    expect(row.rows[0].access_token_hash).toBe("new-access-hash");
    expect(row.rows[0].recovery_token_hash).toBeNull();
    expect(row.rows[0].recovery_token_expires_at).toBeNull();
  });

  it("is single use: a second attempt with the same token matches nothing", async () => {
    const { rows } = await register();
    const enrolmentId = rows[0].campaign_creator_id;

    await db.query(
      `UPDATE campaign_creators
          SET recovery_token_hash = 'hash-1',
              recovery_token_expires_at = now() + interval '30 minutes'
        WHERE id = $1`,
      [enrolmentId],
    );

    const first = await confirm("hash-1", "access-a");
    expect(first.rows).toHaveLength(1);

    // The token was cleared by the first confirmation, so the same hash now
    // matches no row: no separate "consumed" flag exists to race against.
    const second = await confirm("hash-1", "access-b");
    expect(second.rows, "a used recovery token must not work twice").toHaveLength(0);

    const row = await db.query<{ access_token_hash: string }>(
      `SELECT access_token_hash FROM campaign_creators WHERE id = $1`,
      [enrolmentId],
    );
    expect(
      row.rows[0].access_token_hash,
      "the replay must not rotate the token a second time",
    ).toBe("access-a");
  });

  it("refuses an expired recovery token", async () => {
    const { rows } = await register();
    const enrolmentId = rows[0].campaign_creator_id;

    await db.query(
      `UPDATE campaign_creators
          SET recovery_token_hash = 'hash-1',
              recovery_token_expires_at = now() - interval '1 minute'
        WHERE id = $1`,
      [enrolmentId],
    );

    const result = await confirm("hash-1", "access-a");
    expect(result.rows).toHaveLength(0);
  });

  it("refuses a token that never existed", async () => {
    await register();
    const result = await confirm("never-issued", "access-a");
    expect(result.rows).toHaveLength(0);
  });
});

describe("the wiring", () => {
  it("the recovery routes actually consult the throttle", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const requestAccess = readFileSync(
      join(process.cwd(), "app/api/campaigns/monica/request-access/route.ts"),
      "utf8",
    );
    expect(
      requestAccess,
      "the mail-sending endpoint must use the fail-closed throttle, not the fail-open one",
    ).toContain("allowKeyStrict(");

    const open = readFileSync(
      join(
        process.cwd(),
        "app/campaigns/monica-money-story/recover/open/route.ts",
      ),
      "utf8",
    );
    expect(open).toContain("await allow(");

    const actions = readFileSync(
      join(
        process.cwd(),
        "app/campaigns/monica-money-story/recover/confirm/actions.ts",
      ),
      "utf8",
    );
    expect(actions).toContain("await allowKey(");
  });

  it("requesting recovery never touches access_token_hash in lib/creator-recovery.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "lib/creator-recovery.ts"),
      "utf8",
    );
    const requestFn = src.slice(
      src.indexOf("export async function requestAccessRecovery"),
      src.indexOf("export interface RecoveryHolder"),
    );
    expect(
      requestFn,
      "requestAccessRecovery must never set accessTokenHash: only confirmAccessRecovery may",
    ).not.toContain("accessTokenHash");
  });
});
