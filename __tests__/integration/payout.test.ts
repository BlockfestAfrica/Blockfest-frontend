/**
 * The payout export, against a real Postgres.
 *
 * This is the document somebody reads two days before transferring 1,500,000
 * naira, so the tests are about the two things that would make it worthless:
 * numbers that do not add up, and an ordering that disagrees with the board
 * creators have been watching for a month.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";
import { payoutCsv, entriesCsv, type PayoutLine } from "@/lib/admin/payout";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

/**
 * The same shape payoutLines returns, built straight from the database.
 *
 * payoutLines needs a live Drizzle handle, so this exercises the queries and
 * the CSV writers against real rows without standing up the whole client. The
 * ordering comes from campaign_ranked either way, which is the part that must
 * not drift.
 */
async function lines(positions = 5): Promise<PayoutLine[]> {
  const ranked = (
    await db.query<{
      rank: string;
      campaign_creator_id: string;
      display_name: string;
      points_total: number;
    }>(
      `SELECT rank, campaign_creator_id, display_name, points_total
         FROM campaign_ranked('monica-money-story') ORDER BY rank LIMIT ${positions}`,
    )
  ).rows;

  const prizes = [1_500_000, 800_000, 500_000, 300_000, 300_000];
  const out: PayoutLine[] = [];

  for (const r of ranked) {
    const ledger = (
      await db.query<{
        created_at: string;
        source: string;
        points: number;
        note: string | null;
        awarded_by: string | null;
        week_no: number | null;
      }>(
        `SELECT pl.created_at, pl.source::text AS source, pl.points, pl.note,
                a.email AS awarded_by, ch.week_no
           FROM point_ledger pl
           LEFT JOIN admin_users a        ON a.id = pl.awarded_by_admin_id
           LEFT JOIN challenge_entries ce ON ce.id = pl.entry_id
           LEFT JOIN challenges ch        ON ch.id = ce.challenge_id
          WHERE pl.campaign_creator_id = '${r.campaign_creator_id}'
          ORDER BY pl.created_at, pl.id`,
      )
    ).rows;

    const entries = (
      await db.query<{ week_no: number; platform: string; url: string }>(
        `SELECT ch.week_no, s.platform::text AS platform, s.url
           FROM submissions s
           JOIN challenge_entries ce ON ce.id = s.entry_id
           JOIN challenges ch        ON ch.id = ce.challenge_id
          WHERE ce.campaign_creator_id = '${r.campaign_creator_id}'
            AND s.status = 'approved'
          ORDER BY ch.week_no, s.platform`,
      )
    ).rows;

    const rows = ledger.map((l) => ({
      at: new Date(l.created_at),
      source: l.source,
      points: Number(l.points),
      note: l.note,
      awardedBy: l.awarded_by,
      weekNo: l.week_no === null ? null : Number(l.week_no),
    }));

    const pointsTotal = Number(r.points_total);
    const ledgerSum = rows.reduce((t, row) => t + row.points, 0);

    out.push({
      rank: Number(r.rank),
      name: r.display_name,
      prizeNaira: prizes[Number(r.rank) - 1] ?? 0,
      pointsTotal,
      ledgerSum,
      reconciles: pointsTotal === ledgerSum,
      rows,
      entries: entries.map((e) => ({
        weekNo: Number(e.week_no),
        platform: e.platform,
        url: e.url,
      })),
    });
  }

  return out;
}

async function creatorWith(
  name: string,
  awards: { points: number; at: string; note?: string }[],
) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('${name}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code, points_total, approved_entries_count)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}',
            ${awards.reduce((t, a) => t + a.points, 0)}, 1)
    RETURNING id`);

  for (const award of awards) {
    await db.query(
      `INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, note, awarded_by_admin_id, created_at)
       VALUES ($1::uuid, $2::uuid, 'quality_bonus', $3::integer, $4::text, $5::uuid, $6::timestamptz)`,
      [
        campaignId,
        enrolment.id,
        award.points,
        // ledger_manual_awards_attributed requires an admin AND a note on a
        // manual source. A fixture with a null note is a row the database
        // refuses, which is the constraint doing its job.
        award.note ?? "seeded for the payout export",
        adminId,
        award.at,
      ],
    );
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
    await one<{ id: string }>(
      `SELECT id FROM campaigns WHERE slug = 'monica-money-story'`,
    )
  ).id;
  adminId = (
    await one<{ id: string }>(
      `SELECT id FROM admin_users WHERE role = 'owner' ORDER BY email_canonical LIMIT 1`,
    )
  ).id;
  await db.query(`SELECT purge_campaign_data($1, $1)`, ["monica-money-story"]);
});

describe("the numbers", () => {
  /** The acceptance criterion, and the only one that decides a transfer. */
  it("reconciles: every payee's rows sum to their displayed total", async () => {
    await creatorWith("Ada", [
      { points: 300, at: "2026-09-20T10:00:00Z" },
      { points: 100, at: "2026-09-27T10:00:00Z" },
    ]);
    await creatorWith("Bola", [{ points: 200, at: "2026-09-21T10:00:00Z" }]);

    for (const line of await lines()) {
      expect(line.ledgerSum, `${line.name} sums to their total`).toBe(
        line.pointsTotal,
      );
      expect(line.reconciles).toBe(true);
    }
  });

  it("says NO loudly when a total has drifted from its ledger", async () => {
    // The cache and the record disagreeing is the case this export exists to
    // catch, so it must be visible on every row rather than inferred.
    const me = await creatorWith("Drifted", [
      { points: 300, at: "2026-09-20T10:00:00Z" },
    ]);
    await db.query(
      `UPDATE campaign_creators SET points_total = 999 WHERE id = '${me}'`,
    );

    const csv = payoutCsv(await lines());
    expect(csv).toContain(",NO,");
  });

  it("shows a correction as a negative row rather than a smaller total", async () => {
    // The ledger is append-only, so the working has to show the taking back.
    await creatorWith("Corrected", [
      { points: 300, at: "2026-09-20T10:00:00Z", note: "Featured" },
      { points: -100, at: "2026-09-22T10:00:00Z", note: "Awarded in error" },
    ]);

    const csv = payoutCsv(await lines());
    expect(csv).toContain("Awarded in error");
    expect(csv, "and the negative is defused for the spreadsheet").toContain(
      "'-100",
    );
  });
});

describe("the ordering", () => {
  /**
   * The tiebreak the rules published on day one: total points, then who reached
   * that total first, then approved entries. A deliberate tie, resolved by the
   * rule rather than by whatever the planner returned.
   */
  it("resolves a tie by who reached the total first", async () => {
    await creatorWith("Late", [{ points: 300, at: "2026-09-25T10:00:00Z" }]);
    await creatorWith("Early", [
      { points: 100, at: "2026-09-20T08:00:00Z" },
      { points: 200, at: "2026-09-21T08:00:00Z" },
    ]);

    const ordered = await lines();
    expect(ordered.map((l) => l.name)).toEqual(["Early", "Late"]);
    expect(ordered[0].prizeNaira).toBe(1_500_000);
    expect(ordered[1].prizeNaira).toBe(800_000);
  });

  it("pays by position, from the published table", async () => {
    for (const [i, name] of ["A", "B", "C", "D", "E"].entries()) {
      await creatorWith(name, [
        { points: 500 - i * 10, at: "2026-09-20T10:00:00Z" },
      ]);
    }
    expect((await lines()).map((l) => l.prizeNaira)).toEqual([
      1_500_000, 800_000, 500_000, 300_000, 300_000,
    ]);
  });
});

describe("what the file must not contain", () => {
  it("has no bank details, because the platform never holds any", async () => {
    await creatorWith("Ada", [{ points: 300, at: "2026-09-20T10:00:00Z" }]);
    const csv = payoutCsv(await lines()) + entriesCsv(await lines());

    for (const forbidden of [
      "account_number",
      "bank",
      "iban",
      "swift",
      "sort_code",
    ]) {
      expect(csv.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("carries the entries it paid for, so the work can be checked", async () => {
    const me = await creatorWith("Ada", [
      { points: 100, at: "2026-09-20T10:00:00Z" },
    ]);
    const week1 = await one<{ id: string }>(
      `SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 1`,
    );
    const entry = await one<{ id: string }>(`
      INSERT INTO challenge_entries (campaign_creator_id, challenge_id,
        base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot)
      VALUES ('${me}', '${week1.id}', 100, 100, 200) RETURNING id`);
    await db.query(`
      INSERT INTO submissions (entry_id, platform, url, status, reviewed_at, reviewed_by_admin_id)
      VALUES ('${entry.id}', 'x', 'https://x.com/ada/1', 'approved', now(), '${adminId}')`);

    expect(entriesCsv(await lines())).toContain("https://x.com/ada/1");
  });

  it("names the admin who awarded each row", async () => {
    // A dispute is answered by who decided and why, not by a total.
    await creatorWith("Ada", [
      { points: 300, at: "2026-09-20T10:00:00Z", note: "Standout entry" },
    ]);
    const csv = payoutCsv(await lines());
    expect(csv).toContain("Standout entry");
    expect(csv).toMatch(/@blockfestafrica\.com|@gmail\.com/);
  });
});
