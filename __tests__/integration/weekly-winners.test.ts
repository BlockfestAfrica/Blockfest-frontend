/**
 * Weekly snapshots and weekly winners, against a real Postgres.
 *
 * 1,600,000 naira of weekly prizes and 3,400,000 on final positions, so both
 * halves are about being able to answer a question in October about what was
 * true in September.
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

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

/** A creator holding points, so they appear in the ranking. */
async function creatorWith(name: string, points: number) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('${name}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code, points_total, approved_entries_count)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}', ${points}, 1)
    RETURNING id`);
  await db.query(`
    INSERT INTO point_ledger (campaign_id, campaign_creator_id, source, points, note, awarded_by_admin_id)
    VALUES ('${campaignId}', '${enrolment.id}', 'quality_bonus', ${points}, 'seed', '${adminId}')`);
  return enrolment.id;
}

const snapshot = (week: number) =>
  db.query<{ version: number; rows_captured: number }>(
    `SELECT * FROM take_leaderboard_snapshot($1, $2::smallint, $3::uuid)`,
    [SLUG, week, adminId],
  );

const publish = (
  week: number,
  category: string,
  enrolment: string,
  opts: { prize?: number; publish?: boolean; note?: string } = {},
) =>
  db.query<{ winner_id: string; published: boolean }>(
    `SELECT * FROM publish_weekly_winner($1, $2::smallint, $3::winner_category, $4::uuid, NULL, $5::integer, $6::text, $7::uuid, $8::boolean)`,
    [
      SLUG,
      week,
      category,
      enrolment,
      opts.prize ?? 100000,
      opts.note ?? null,
      adminId,
      opts.publish ?? true,
    ],
  );

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
    await one<{ id: string }>(`SELECT id FROM admin_users ORDER BY created_at LIMIT 1`)
  ).id;
  await db.query(`SELECT purge_campaign_data($1, $1)`, [SLUG]);
});

describe("freezing a week's standings", () => {
  it("captures the ranking as it stands", async () => {
    await creatorWith("Ada", 300);
    await creatorWith("Bola", 200);

    const result = await snapshot(1);
    expect(Number(result.rows[0].rows_captured)).toBe(2);
    expect(Number(result.rows[0].version)).toBe(1);

    const top = await one<{ display_name: string; rank: number }>(
      `SELECT display_name, rank FROM leaderboard_snapshots
        WHERE week_no = 1 AND version = 1 ORDER BY rank LIMIT 1`,
    );
    expect(top.display_name).toBe("Ada");
    expect(Number(top.rank)).toBe(1);
  });

  /**
   * The whole point. A live query answers "what are the standings"; only this
   * answers "what were they on the 19th", and 3,400,000 naira turns on the
   * second question in October.
   */
  it("does not move when the ledger moves afterwards", async () => {
    const ada = await creatorWith("Ada", 300);
    await creatorWith("Bola", 200);
    await snapshot(1);

    // A late approval changes the live board.
    await db.query(
      `SELECT award_points($1::uuid, 'quality_bonus', 300, 'Late review', $2::uuid)`,
      [ada, adminId],
    );

    const frozen = await one<{ points_total: number }>(
      `SELECT points_total FROM leaderboard_snapshots
        WHERE week_no = 1 AND version = 1 AND display_name = 'Ada'`,
    );
    expect(Number(frozen.points_total), "the snapshot still says 300").toBe(300);
  });

  it("versions a re-take rather than overwriting it", async () => {
    await creatorWith("Ada", 300);
    await snapshot(1);
    const second = await snapshot(1);

    expect(Number(second.rows[0].version)).toBe(2);
    expect(
      await count(
        `SELECT count(DISTINCT version)::int AS n FROM leaderboard_snapshots WHERE week_no = 1`,
      ),
      "both survive",
    ).toBe(2);
  });

  it("refuses an edit, because an editable week is not a record", async () => {
    await creatorWith("Ada", 300);
    await snapshot(1);
    await expect(
      db.query(`UPDATE leaderboard_snapshots SET points_total = 9999`),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(`DELETE FROM leaderboard_snapshots`),
    ).rejects.toThrow(/append-only/);
  });

  it("survives the creator being removed", async () => {
    // Denormalised on purpose: a snapshot that needs a live row to render is
    // not a record of anything.
    await creatorWith("Ada", 300);
    await snapshot(1);
    await db.query(`SELECT purge_campaign_data($1, $1)`, [SLUG]);

    // The purge clears snapshots too, so take a fresh one and then remove only
    // the creator, which is the case that matters for a disqualification.
    const gone = await creatorWith("Temporary", 300);
    await snapshot(2);
    await db.query(
      `UPDATE campaign_creators SET status = 'disqualified' WHERE id = '${gone}'`,
    );

    const row = await one<{ display_name: string }>(
      `SELECT display_name FROM leaderboard_snapshots WHERE week_no = 2`,
    );
    expect(row.display_name).toBe("Temporary");
  });

  it("records an empty week rather than leaving a gap", async () => {
    const result = await snapshot(1);
    expect(Number(result.rows[0].rows_captured)).toBe(0);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'leaderboard.snapshot'`,
      ),
    ).toBe(1);
  });
});

describe("publishing a weekly winner", () => {
  it("writes the winner and an audit row", async () => {
    const ada = await creatorWith("Ada", 300);
    await publish(1, "creator_of_week", ada);

    expect(
      await count(
        `SELECT count(*)::int AS n FROM weekly_winners
          WHERE category = 'creator_of_week' AND published_at IS NOT NULL`,
      ),
    ).toBe(1);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'winner.published'`,
      ),
    ).toBe(1);
  });

  it("keeps a draft out of the published set", async () => {
    // Chosen Saturday, announced Sunday. The site must not give it away.
    const ada = await creatorWith("Ada", 300);
    await publish(1, "creator_of_week", ada, { publish: false });

    expect(
      await count(
        `SELECT count(*)::int AS n FROM weekly_winners WHERE published_at IS NULL`,
      ),
    ).toBe(1);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'winner.drafted'`,
      ),
    ).toBe(1);
  });

  /** The rule the brief is explicit about, enforced in the database. */
  it("refuses the same Creator of the Week twice", async () => {
    const ada = await creatorWith("Ada", 300);
    await publish(1, "creator_of_week", ada);
    await expect(publish(2, "creator_of_week", ada)).rejects.toThrow(
      /already_creator_of_week/,
    );
  });

  /** And the one it deliberately does not restrict. */
  it("allows the same Community Favourite twice", async () => {
    const ada = await creatorWith("Ada", 300);
    await publish(1, "community_favourite", ada);
    await expect(publish(2, "community_favourite", ada)).resolves.toBeTruthy();
  });

  it("allows one creator to hold both categories in a week", async () => {
    const ada = await creatorWith("Ada", 300);
    await publish(1, "creator_of_week", ada);
    await expect(publish(1, "community_favourite", ada)).resolves.toBeTruthy();
  });

  it("replaces a pick for the same week and category rather than duplicating", async () => {
    const ada = await creatorWith("Ada", 300);
    const bola = await creatorWith("Bola", 200);
    await publish(1, "creator_of_week", ada, { publish: false });
    await publish(1, "creator_of_week", bola, { publish: false });

    expect(
      await count(
        `SELECT count(*)::int AS n FROM weekly_winners WHERE week_no = 1 AND category = 'creator_of_week'`,
      ),
    ).toBe(1);
    const held = await one<{ campaign_creator_id: string }>(
      `SELECT campaign_creator_id FROM weekly_winners WHERE week_no = 1 AND category = 'creator_of_week'`,
    );
    expect(held.campaign_creator_id).toBe(bola);
  });

  it("refuses a creator from another campaign", async () => {
    await expect(
      publish(1, "creator_of_week", "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(/unknown_creator/);
  });
});

describe("who may still be offered", () => {
  /**
   * The second of the three enforcements. The index refuses a repeat, this
   * stops one being offered, and the screen says why the name is missing.
   */
  it("drops a past Creator of the Week from the candidates", async () => {
    const ada = await creatorWith("Ada", 300);
    await creatorWith("Bola", 200);

    const before = await db.query<{ display_name: string }>(
      `SELECT display_name FROM weekly_winner_candidates($1, 'creator_of_week')`,
      [SLUG],
    );
    expect(before.rows.map((r) => r.display_name)).toEqual(["Ada", "Bola"]);

    await publish(1, "creator_of_week", ada);

    const after = await db.query<{ display_name: string }>(
      `SELECT display_name FROM weekly_winner_candidates($1, 'creator_of_week')`,
      [SLUG],
    );
    expect(after.rows.map((r) => r.display_name)).toEqual(["Bola"]);
  });

  it("keeps them for Community Favourite, which may repeat", async () => {
    const ada = await creatorWith("Ada", 300);
    await publish(1, "creator_of_week", ada);

    const rows = await db.query<{ display_name: string }>(
      `SELECT display_name FROM weekly_winner_candidates($1, 'community_favourite')`,
      [SLUG],
    );
    expect(rows.rows.map((r) => r.display_name)).toContain("Ada");
  });

  it("offers the ranking order, so the obvious candidate is first", async () => {
    await creatorWith("Third", 100);
    await creatorWith("First", 300);
    await creatorWith("Second", 200);

    const rows = await db.query<{ display_name: string }>(
      `SELECT display_name FROM weekly_winner_candidates($1, 'creator_of_week')`,
      [SLUG],
    );
    expect(rows.rows.map((r) => r.display_name)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });
});
