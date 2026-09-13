/**
 * Clearing the campaign before launch, against a real Postgres.
 *
 * Production has been used for real testing and all of it has to go before
 * Monday. The failure that matters here is not leaving a row behind, it is
 * taking the setup with it: no campaign row means registration 404s on launch
 * morning, and no admin_users row means nobody can sign in to review. So most
 * of these assertions are about what survives.
 *
 * The last test is the one that will still be earning its keep in a year. It
 * reads the migration directory, finds every table, and fails if one is in
 * neither the purge nor the keep list, so adding a table forces the decision
 * rather than silently leaving people's data in it.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

const SLUG = "monica-money-story";
const MIGRATIONS = join(process.cwd(), "netlify/database/migrations");

let db: PGlite;
let seq = 0;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(sql, params)).rows[0].n);

const rows = (table: string) => count(`SELECT count(*)::int AS n FROM ${table}`);

const purge = (slug = SLUG, confirm = SLUG) =>
  db.query(`SELECT * FROM purge_campaign_data($1, $2)`, [slug, confirm]);

/** Register through the real function, so the test data looks like real data. */
const register = (opts: { ref?: string } = {}) => {
  const t = `${++seq}`;
  return db.query<{ campaign_creator_id: string; referral_code: string }>(
    `SELECT * FROM register_creator($1,$2,$3,$4,$5,$6,$7,NULL,NULL,$8,NULL,NULL,$9,
       '1.2.3.4','test',$10,'1.0',false,'1.0',NULL)`,
    [
      SLUG, `Creator ${t}`, `c${t}@e.com`, `c${t}@e.com`,
      `080${t.padStart(8, "0")}`, `+23480${t.padStart(8, "0")}`, "finance",
      `handle${t}`, opts.ref ?? null, `CODE${t}`,
    ],
  );
};

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

/** A campaign that has been used: creators, an entry, a submission, points. */
async function useTheCampaign() {
  const first = (await register()).rows[0];
  await register({ ref: first.referral_code });

  /*
   * Verified, the way an admin would.
   *
   * register_creator deliberately never sets verified_at, because registration
   * cannot check anything, and review() from 0022 refuses to approve through an
   * unverified handle. So a fixture that registers and then approves has to
   * include the step a person performs in between.
   */
  await db.query(`UPDATE creator_social_handles SET verified_at = now()`);

  const campaign = await one<{ id: string }>(
    `SELECT id FROM campaigns WHERE slug = '${SLUG}'`,
  );
  const admin = await one<{ id: string }>(
    `SELECT id FROM admin_users ORDER BY created_at LIMIT 1`,
  );
  const week1 = await one<{ id: string }>(
    `SELECT id FROM challenges WHERE campaign_id = '${campaign.id}' AND week_no = 1`,
  );
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
    VALUES ('${first.campaign_creator_id}', '${week1.id}', 100, 100, 200)
    RETURNING id`);
  const sub = await one<{ id: string }>(`
    INSERT INTO submissions (entry_id, platform, url)
    VALUES ('${entry.id}', 'x', 'https://x.com/a/1') RETURNING id`);
  await db.query(`SELECT review('${sub.id}', 'approved', '${admin.id}', NULL)`);

  return { campaign: campaign.id, admin: admin.id };
}

beforeEach(async () => {
  await db.exec(`
    DELETE FROM audit_log; DELETE FROM referrals; DELETE FROM point_ledger;
    DELETE FROM submissions; DELETE FROM challenge_entries;
    DELETE FROM creator_social_handles; DELETE FROM campaign_creators;
    DELETE FROM creators; DELETE FROM registration_attempts;
  `);
});

describe("what the purge removes", () => {
  it("empties every table that holds a participant", async () => {
    await useTheCampaign();

    // Everything is actually populated first, or the assertions below pass
    // against a database that was already empty.
    expect(await rows("creators"), "creators before").toBeGreaterThan(0);
    expect(await rows("submissions"), "submissions before").toBeGreaterThan(0);
    expect(await rows("point_ledger"), "ledger before").toBeGreaterThan(0);
    expect(await rows("referrals"), "referrals before").toBeGreaterThan(0);

    await purge();

    for (const t of [
      "creators", "campaign_creators", "creator_social_handles",
      "challenge_entries", "submissions", "point_ledger", "referrals",
      "weekly_winners", "vote_rounds", "vote_round_nominees", "votes",
      "registration_attempts",
    ]) {
      expect(await rows(t), `${t} after purge`).toBe(0);
    }
  });

  it("reports what it deleted, per table", async () => {
    await useTheCampaign();
    const result = await purge();
    const byTable = Object.fromEntries(
      (result.rows as { table_name: string; rows_deleted: number }[])
        .map((r) => [r.table_name, Number(r.rows_deleted)]),
    );
    expect(byTable.creators).toBe(2);
    expect(byTable.submissions).toBe(1);
  });
});

describe("what the purge must not touch", () => {
  it("leaves the campaign, so registration still works afterwards", async () => {
    await useTheCampaign();
    await purge();

    // The real assertion. A campaign row that survives but is somehow unusable
    // is the same outage as one that does not.
    const again = await register();
    expect(again.rows[0].campaign_creator_id).toBeTruthy();
  });

  it("leaves the challenges, the point rules and the admins", async () => {
    const before = {
      campaigns: await rows("campaigns"),
      challenges: await rows("challenges"),
      rules: await rows("point_rules"),
      admins: await rows("admin_users"),
    };
    await useTheCampaign();
    await purge();

    expect(await rows("campaigns")).toBe(before.campaigns);
    expect(await rows("challenges")).toBe(before.challenges);
    expect(await rows("point_rules")).toBe(before.rules);
    expect(await rows("admin_users")).toBe(before.admins);
  });

  it("leaves the Identity binding, so reviewers can still sign in", async () => {
    // Dropping and re-migrating would restore every table above and still lose
    // this, which is the failure that locks the team out on launch morning.
    await db.query(
      `UPDATE admin_users SET identity_user_id = 'netlify-user-1'
        WHERE id = (SELECT id FROM admin_users ORDER BY created_at LIMIT 1)`,
    );
    await useTheCampaign();
    await purge();

    expect(
      await count(
        `SELECT count(*)::int AS n FROM admin_users WHERE identity_user_id = 'netlify-user-1'`,
      ),
    ).toBe(1);
  });

  it("keeps audit rows that are about admins rather than the campaign", async () => {
    await db.query(
      `INSERT INTO audit_log (action, entity_type, note)
       VALUES ('admin.identity_bound', 'admin_user', 'bound before the purge')`,
    );
    await useTheCampaign();
    await purge();

    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'admin.identity_bound'`,
      ),
      "admin binding history survives",
    ).toBe(1);
  });

  it("records the purge itself", async () => {
    await useTheCampaign();
    await purge();
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'campaign.purged'`,
      ),
    ).toBe(1);
  });

  it("leaves a creator who is enrolled in another campaign", async () => {
    // Only true once a second campaign exists, which is exactly when nobody
    // will be thinking about it.
    const other = await one<{ id: string }>(`
      INSERT INTO campaigns (slug, name, starts_at, ends_at, status)
      VALUES ('other', 'Other', now(), now() + interval '30 days', 'active')
      RETURNING id`);
    const me = (await register()).rows[0];
    const creator = await one<{ creator_id: string }>(
      `SELECT creator_id FROM campaign_creators WHERE id = '${me.campaign_creator_id}'`,
    );
    await db.query(`
      INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
      VALUES ('${other.id}', '${creator.creator_id}', 'OTHERCODE')`);

    await purge();

    expect(
      await count(
        `SELECT count(*)::int AS n FROM creators WHERE id = '${creator.creator_id}'`,
      ),
      "still a participant somewhere else",
    ).toBe(1);
    await db.query(`DELETE FROM campaign_creators WHERE campaign_id = '${other.id}'`);
    await db.query(`DELETE FROM campaigns WHERE id = '${other.id}'`);
  });
});

describe("what the purge refuses", () => {
  it("refuses without the slug typed twice", async () => {
    await useTheCampaign();
    await expect(purge(SLUG, "yes")).rejects.toThrow(/slug twice/);
    expect(await rows("creators"), "nothing deleted").toBeGreaterThan(0);
  });

  it("refuses an unknown slug", async () => {
    await expect(purge("monica", "monica")).rejects.toThrow(/no campaign/);
  });
});

describe("the shortcuts somebody will reach for instead", () => {
  /*
   * admin_users already refuses DELETE. That guard is a row trigger and row
   * triggers do not fire on TRUNCATE, so it stopped nothing on the one
   * statement most likely to be typed in a hurry.
   */
  it("refuses TRUNCATE on admin_users", async () => {
    await expect(db.query(`TRUNCATE admin_users CASCADE`)).rejects.toThrow(
      /never truncated/,
    );
    expect(await rows("admin_users")).toBeGreaterThan(0);
  });

  it("refuses TRUNCATE on campaigns", async () => {
    await expect(db.query(`TRUNCATE campaigns CASCADE`)).rejects.toThrow(
      /never truncated/,
    );
    expect(await rows("campaigns")).toBeGreaterThan(0);
  });

  it("still refuses DELETE on an admin", async () => {
    const admin = await one<{ id: string }>(`SELECT id FROM admin_users LIMIT 1`);
    await expect(
      db.query(`DELETE FROM admin_users WHERE id = '${admin.id}'`),
    ).rejects.toThrow(/never deleted/);
  });
});

describe("the list stays complete", () => {
  /**
   * Tables the purge deliberately keeps, each with the reason, because a bare
   * list is the kind of thing that gets extended without thought.
   */
  const KEEP: Record<string, string> = {
    campaigns: "the site looks this up by slug on every campaign page",
    challenges: "the weekly brief, written once and referenced by entries",
    point_rules: "the ladder and the award bounds",
    admin_users: "carries the Identity binding every reviewer signs in with",
    resources: "admin-edited page content, not anybody's personal data",
    audit_log: "purged per campaign, so admin history survives",
    admin_sessions:
      "the signed-in admins' own sessions, not participant data; rows expire in twelve hours and purging them would sign the owner out mid-purge",
  };

  /*
   * The quotes are optional in that pattern for a reason.
   *
   * It originally required them, because drizzle writes CREATE TABLE "name".
   * The first hand-written migration to add a table wrote it unquoted, the
   * regex did not match, and this test went green while a table full of
   * campaign data was in neither list. A completeness check that only sees one
   * dialect is a completeness check that reports what it can see.
   */
  /**
   * The counts the purge reports are true.
   *
   * 0026 inserted the request_throttle DELETE between the votes DELETE and the
   * GET DIAGNOSTICS meant to capture it, so ROW_COUNT was overwritten and the
   * purge reported the throttle's count under the votes name. Rows were still
   * deleted; the accounting lied, in the one report an owner reads while
   * destroying data. Nothing here checked counts, which is how it survived
   * 799 green tests. request_throttle is trivial to seed, so the assertion
   * rides on it: under the bug, votes reported the throttle's count. Proved by
   * running this against the migrations capped at 0027, where it fails with
   * votes = 3.
   */
  it("reports each table's own count, not its neighbour's", async () => {
    await db.query(`
      INSERT INTO request_throttle (bucket, window_start, hits) VALUES
        ('t:1.2.3.4', now(), 1), ('t:5.6.7.8', now(), 2), ('t:9.9.9.9', now(), 3)`);

    const { rows } = await db.query<{ table_name: string; rows_deleted: number }>(
      `SELECT * FROM purge_campaign_data($1, $2)`,
      [SLUG, SLUG],
    );
    const reported = Object.fromEntries(
      rows.map((r) => [r.table_name, Number(r.rows_deleted)]),
    );

    expect(reported.request_throttle, "its own three rows").toBe(3);
    expect(reported.votes, "not the throttle count wearing the votes name").toBe(0);
  });

  it("classifies every table as purged or kept", async () => {
    const sql = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
      .join("\n");

    const tables = [
      ...sql.matchAll(/create table (?:if not exists )?"?([a-z_]+)"?/gi),
    ].map((m) => m[1]);
    expect(tables.length, "found the schema").toBeGreaterThan(10);

    /*
     * Every migration, not just 0017.
     *
     * This read one filename, and purge_campaign_data was later redefined in a
     * different migration to cover a new table. The function had been updated
     * correctly and the test still reported the table as unclassified, because
     * it was reading a file that no longer held the current definition. A check
     * pinned to a filename stops being a check the first time somebody does the
     * ordinary thing and replaces a function in a later migration.
     */
    const purgeFn = sql;
    const unclassified = [...new Set(tables)].filter(
      (t) =>
        !KEEP[t] &&
        !new RegExp(`table_name := '${t}'`).test(purgeFn),
    );

    expect(
      unclassified,
      "a new table is neither purged nor kept: decide which, in 0017_purge.sql or in KEEP above",
    ).toEqual([]);
  });

  it("empties everything it claims to, measured against the schema", async () => {
    await useTheCampaign();
    await purge();

    const sql = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
      .join("\n");
    const tables = [
      ...new Set(
        [...sql.matchAll(/create table (?:if not exists )?"?([a-z_]+)"?/gi)].map(
          (m) => m[1],
        ),
      ),
    ];

    for (const t of tables.filter((t) => !KEEP[t])) {
      expect(await rows(t), `${t} should be empty after a purge`).toBe(0);
    }
  });
});

describe("the button version", () => {
  const owner = () =>
    one<{ id: string }>(
      `SELECT id FROM admin_users WHERE role = 'owner' AND is_active LIMIT 1`,
    );

  // Pausing takes an admin too, which is the point of it: it is a named act.
  const pause = async (on: boolean) =>
    db.query(`SELECT set_campaign_pause($1, $2, $3, $4::uuid)`, [
      SLUG,
      on,
      on ? "Clearing test data before launch" : null,
      (await owner()).id,
    ]);

  const viaButton = async (opts: { admin?: string; confirm?: string } = {}) => {
    const o = opts.admin ?? (await owner()).id;
    return db.query(`SELECT * FROM purge_before_launch($1, $2, $3::uuid)`, [
      SLUG,
      opts.confirm ?? SLUG,
      o,
    ]);
  };

  beforeEach(async () => {
    await db.query(
      `UPDATE campaigns SET paused_at = NULL, paused_reason = NULL,
         paused_by_admin_id = NULL, starts_at = now() + interval '2 days'
        WHERE slug = '${SLUG}'`,
    );
  });

  it("purges when the campaign is paused and has not opened", async () => {
    await useTheCampaign();
    await pause(true);
    await viaButton();
    expect(await rows("creators")).toBe(0);
  });

  it("names the owner on the audit row", async () => {
    const o = await owner();
    await useTheCampaign();
    await pause(true);
    await viaButton();
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log
          WHERE action = 'campaign.purged' AND actor_admin_id = '${o.id}'`,
      ),
    ).toBe(1);
  });

  it("refuses while the campaign is running", async () => {
    // Not a safety rail so much as an order of operations: pausing is visible,
    // reversible and takes a reason, so it is the step that makes a purge a
    // decision rather than a click.
    await useTheCampaign();
    await expect(viaButton()).rejects.toThrow(/pause_first/);
    expect(await rows("creators")).toBeGreaterThan(0);
  });

  /**
   * The guard that matters after Monday.
   *
   * Every row in an open campaign belongs to somebody who entered in good
   * faith. The window closes by itself at the instant registration opens.
   */
  it("refuses once the campaign has opened, however much it is confirmed", async () => {
    await db.query(
      `UPDATE campaigns SET starts_at = now() - interval '1 minute' WHERE slug = '${SLUG}'`,
    );
    await useTheCampaign();
    await pause(true);

    await expect(viaButton()).rejects.toThrow(/campaign_already_open/);
    expect(await rows("creators"), "still there").toBeGreaterThan(0);
  });

  it("refuses a reviewer", async () => {
    const reviewer = await one<{ id: string }>(`
      INSERT INTO admin_users (email, email_canonical, password_hash, role, is_active)
      VALUES ('r@e.com', 'r@e.com', 'netlify-identity', 'reviewer', true)
      RETURNING id`);
    await useTheCampaign();
    await pause(true);
    await expect(viaButton({ admin: reviewer.id })).rejects.toThrow(
      /owner_required/,
    );
    expect(await rows("creators")).toBeGreaterThan(0);
    await db.query(
      `UPDATE admin_users SET is_active = false, revoked_at = now(),
         revoked_reason = 'test fixture' WHERE id = '${reviewer.id}'`,
    );
  });

  it("refuses a revoked owner", async () => {
    const o = await owner();
    await db.query(
      `UPDATE admin_users SET is_active = false, revoked_at = now(),
         revoked_reason = 'left the team' WHERE id = '${o.id}'`,
    );
    await useTheCampaign();
    await pause(true);
    await expect(viaButton({ admin: o.id })).rejects.toThrow(/admin_required/);
    await db.query(
      `UPDATE admin_users SET is_active = true, revoked_at = NULL,
         revoked_reason = NULL WHERE id = '${o.id}'`,
    );
  });

  it("still needs the slug typed twice", async () => {
    await useTheCampaign();
    await pause(true);
    await expect(viaButton({ confirm: "yes" })).rejects.toThrow(/slug twice/);
    expect(await rows("creators")).toBeGreaterThan(0);
  });
});
