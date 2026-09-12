/**
 * The pause switch, against a real Postgres.
 *
 * The only ways to stop people entering used to be a code change and a build,
 * or editing the database by hand with a connection string that is not readable
 * from the dashboard. On a launch morning with something going wrong, neither
 * is a plan.
 *
 * What matters here is that pausing is answerable afterwards, that resuming
 * leaves nothing behind, and that a pause can never be silent.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

const setPause = (paused: boolean, reason: string | null, admin = adminId) =>
  db.query(
    `SELECT * FROM set_campaign_pause('monica-money-story', ${paused}, ${
      reason === null ? "NULL" : `'${reason}'`
    }, ${admin === "" ? "NULL" : `'${admin}'`})`,
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
    DELETE FROM audit_log;
    UPDATE campaigns SET paused_at = NULL, paused_reason = NULL, paused_by_admin_id = NULL;
  `);
  adminId = (
    await one<{ id: string }>(
      `SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`,
    )
  ).id;
});

describe("pausing", () => {
  it("records when, why and who", async () => {
    await setPause(true, "Spam wave from one carrier");

    expect(
      await count(`
        SELECT count(*)::int AS n FROM campaigns
         WHERE slug = 'monica-money-story'
           AND paused_at IS NOT NULL
           AND paused_reason = 'Spam wave from one carrier'
           AND paused_by_admin_id IS NOT NULL`),
    ).toBe(1);
  });

  it("writes an audit row naming the admin", async () => {
    await setPause(true, "Checking a scoring bug");
    expect(
      await count(`
        SELECT count(*)::int AS n FROM audit_log
         WHERE action = 'campaign.paused' AND actor_admin_id = '${adminId}'`),
    ).toBe(1);
  });

  it("refuses a pause with no reason", async () => {
    // A silent pause is the failure this exists to prevent: a creator meets a
    // refusal, tries again, and writes in.
    await expect(setPause(true, null)).rejects.toThrow(/reason_required/);
  });

  it("refuses a pause with a blank reason", async () => {
    await expect(setPause(true, "   ")).rejects.toThrow(/reason_required/);
  });

  it("refuses a pause with no admin", async () => {
    // Stopping every creator entering is not something that happens
    // anonymously.
    await expect(setPause(true, "because", "")).rejects.toThrow(
      /admin_required/,
    );
  });
});

describe("resuming", () => {
  it("clears the reason so a stale one cannot be shown later", async () => {
    await setPause(true, "Temporary");
    await setPause(false, null);

    expect(
      await count(`
        SELECT count(*)::int AS n FROM campaigns
         WHERE slug = 'monica-money-story'
           AND paused_at IS NULL
           AND paused_reason IS NULL
           AND paused_by_admin_id IS NULL`),
    ).toBe(1);
  });

  it("needs no reason, because getting back up should be the easy direction", async () => {
    await setPause(true, "Temporary");
    await expect(setPause(false, null)).resolves.toBeTruthy();
  });

  it("writes its own audit row", async () => {
    await setPause(true, "Temporary");
    await setPause(false, null);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'campaign.resumed'`,
      ),
    ).toBe(1);
  });
});

describe("the state it can never be in", () => {
  it("refuses a pause time with no reason", async () => {
    await expect(
      db.query(
        `UPDATE campaigns SET paused_at = now() WHERE slug = 'monica-money-story'`,
      ),
    ).rejects.toThrow();
  });

  it("refuses a reason with no pause time", async () => {
    await expect(
      db.query(
        `UPDATE campaigns SET paused_reason = 'x' WHERE slug = 'monica-money-story'`,
      ),
    ).rejects.toThrow();
  });
});

describe("what pausing does not touch", () => {
  it("leaves the campaign status alone", async () => {
    // status = 'closed' means the campaign has ended. A pause has to be
    // reversible without looking like an ending, which is why it is a separate
    // column rather than a fifth enum value.
    await setPause(true, "Temporary");
    const row = await one<{ status: string }>(
      `SELECT status FROM campaigns WHERE slug = 'monica-money-story'`,
    );
    expect(row.status).toBe("active");
  });

  it("leaves the opening date alone", async () => {
    const before = await one<{ starts_at: Date }>(
      `SELECT starts_at FROM campaigns WHERE slug = 'monica-money-story'`,
    );
    await setPause(true, "Temporary");
    const after = await one<{ starts_at: Date }>(
      `SELECT starts_at FROM campaigns WHERE slug = 'monica-money-story'`,
    );
    expect(new Date(after.starts_at).getTime()).toBe(
      new Date(before.starts_at).getTime(),
    );
  });
});
