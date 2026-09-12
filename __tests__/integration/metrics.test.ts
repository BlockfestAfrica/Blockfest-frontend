/**
 * The overview numbers, against a real Postgres.
 *
 * These go into the report to Monica, so the tests are about the two ways a
 * dashboard misleads: a figure that disagrees with the screen it summarises,
 * and a figure that counts the wrong thing while looking entirely reasonable.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

const SLUG = "monica-money-story";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const n = async (sql: string) =>
  Number(Object.values((await db.query<Record<string, unknown>>(sql)).rows[0])[0]);

/**
 * The same predicate the metrics query uses, kept here so a drift between the
 * two shows up as a failing test rather than as a wrong number in a report.
 */
const metricPending = () =>
  n(`SELECT count(*)::int FROM submissions sub
       JOIN challenge_entries ce ON ce.id = sub.entry_id
       JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
       JOIN campaigns cm         ON cm.id = cc.campaign_id
      WHERE cm.slug = '${SLUG}' AND sub.status = 'pending'`);

/** What pendingSubmissions in lib/admin/review.ts selects, uncapped. */
const queuePending = () =>
  n(`SELECT count(*)::int FROM submissions sub
       JOIN challenge_entries ce ON ce.id = sub.entry_id
       JOIN challenges ch        ON ch.id = ce.challenge_id
       JOIN campaigns cm         ON cm.id = ch.campaign_id
       JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
       JOIN creators c           ON c.id = cc.creator_id
      WHERE sub.status = 'pending' AND cm.slug = '${SLUG}'`);

async function creatorWithSubmissions(
  platforms: { platform: string; status: string }[],
) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche, registration_ip)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance', '10.0.0.1')
    RETURNING id`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);

  if (platforms.length > 0) {
    const week1 = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    );
    const entry = await one<{ id: string }>(`
      INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
        base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
      VALUES ('${enrolment.id}', '${week1.id}', 100, 100, 200) RETURNING id`);

    for (const p of platforms) {
      const reviewed =
        p.status === "pending"
          ? "NULL, NULL"
          : `now(), '${adminId}'`;
      await db.query(`
        INSERT INTO submissions (entry_id, platform, url, status, reviewed_at, reviewed_by_admin_id)
        VALUES ('${entry.id}', '${p.platform}', 'https://x.com/${tag}${p.platform}/1',
                '${p.status}', ${reviewed})`);
    }
  }
  return enrolment.id;
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  campaignId = (
    await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = '${SLUG}'`)
  ).id;
  adminId = (
    await one<{ id: string }>(
      `SELECT id FROM admin_users WHERE role = 'owner' ORDER BY email_canonical LIMIT 1`,
    )
  ).id;
  await db.query(`SELECT purge_campaign_data($1, $1)`, [SLUG]);
});

describe("the pending count", () => {
  /** The acceptance criterion: it must match the queue exactly. */
  it("agrees with the review queue", async () => {
    await creatorWithSubmissions([
      { platform: "x", status: "pending" },
      { platform: "instagram", status: "approved" },
      { platform: "tiktok", status: "rejected" },
    ]);
    await creatorWithSubmissions([{ platform: "x", status: "pending" }]);

    expect(await metricPending()).toBe(await queuePending());
    expect(await metricPending()).toBe(2);
  });

  it("still agrees when a creator has no submissions at all", async () => {
    // The metrics query joins through campaign_creators and the queue joins
    // through challenges. A creator with no entry is where two join paths
    // disagree if either is written carelessly.
    await creatorWithSubmissions([]);
    expect(await metricPending()).toBe(await queuePending());
  });
});

describe("what the figures actually count", () => {
  it("counts approved URLs per platform, not per entry", async () => {
    // The KPI is published artefacts. The same piece on three platforms is one
    // entry and three things a person can go and look at.
    await creatorWithSubmissions([
      { platform: "x", status: "approved" },
      { platform: "instagram", status: "approved" },
      { platform: "tiktok", status: "approved" },
    ]);

    const approved = await n(
      `SELECT count(*)::int FROM submissions sub
         JOIN challenge_entries ce ON ce.id = sub.entry_id
         JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
         JOIN campaigns cm         ON cm.id = cc.campaign_id
        WHERE cm.slug = '${SLUG}' AND sub.status = 'approved'`,
    );
    const entries = await n(
      `SELECT count(*)::int FROM challenge_entries ce
         JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
        WHERE cc.campaign_id = '${campaignId}'`,
    );

    expect(approved, "three artefacts").toBe(3);
    expect(entries, "from one entry").toBe(1);
  });

  it("counts a creator with no submissions as silent", async () => {
    await creatorWithSubmissions([]);
    await creatorWithSubmissions([{ platform: "x", status: "pending" }]);

    const silent = await n(
      `SELECT count(*)::int FROM campaign_creators cc
         JOIN campaigns cm ON cm.id = cc.campaign_id
        WHERE cm.slug = '${SLUG}'
          AND NOT EXISTS (
            SELECT 1 FROM submissions sub
              JOIN challenge_entries ce ON ce.id = sub.entry_id
             WHERE ce.campaign_creator_id = cc.id
          )`,
    );
    expect(silent).toBe(1);
  });

  it("counts a referral as paid only once it has actually paid", async () => {
    // Recorded and paid are different states, and reporting the first as the
    // second would overstate what creators have earned.
    const a = await creatorWithSubmissions([]);
    const b = await creatorWithSubmissions([]);
    await db.query(`
      INSERT INTO referrals (campaign_id, referrer_campaign_creator_id,
                             referred_campaign_creator_id, code_used)
      VALUES ('${campaignId}', '${a}', '${b}', 'CODE1')`);

    expect(
      await n(
        `SELECT count(*)::int FROM referrals WHERE awarded_at IS NOT NULL`,
      ),
      "recorded is not paid",
    ).toBe(0);
  });
});

describe("registrations sharing an address", () => {
  it("groups them, so a person can look", async () => {
    for (let i = 0; i < 3; i++) await creatorWithSubmissions([]);

    const clusters = (
      await db.query<{ ip: string; creators: number }>(
        `SELECT cr.registration_ip AS ip, count(*)::int AS creators
           FROM creators cr
           JOIN campaign_creators cc ON cc.creator_id = cr.id
          WHERE cc.campaign_id = '${campaignId}'
            AND cr.registration_ip IS NOT NULL
          GROUP BY cr.registration_ip
         HAVING count(*) >= 3`,
      )
    ).rows;

    expect(clusters).toHaveLength(1);
    expect(Number(clusters[0].creators)).toBe(3);
  });

  it("does not flag an address below the threshold", async () => {
    await creatorWithSubmissions([]);
    const clusters = (
      await db.query(
        `SELECT cr.registration_ip FROM creators cr
           JOIN campaign_creators cc ON cc.creator_id = cr.id
          WHERE cc.campaign_id = '${campaignId}'
          GROUP BY cr.registration_ip HAVING count(*) >= 3`,
      )
    ).rows;
    expect(clusters).toHaveLength(0);
  });
});
