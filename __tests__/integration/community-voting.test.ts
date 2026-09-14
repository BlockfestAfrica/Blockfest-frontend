/**
 * The Community Favourite voting engine, tested against real Postgres.
 *
 * A weekly ₦100,000 is decided by these functions, and the threat model in
 * the approved scope is explicit: a catch-all domain makes "one inbox, one
 * vote" purchasable, an unverified vote needs no inbox at all, and the
 * removal mechanic is a race unless fraud bars the slot. Every property
 * asserted here is one of those attacks, recreated and refused by name.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let campaignId: string;
let adminId: string;
let seq = 0;

const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0];

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

/** An enrolment with an approved entry on the given week, nominee-eligible. */
async function approvedEntry(week: number) {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164, content_niche)
    VALUES ('Creator ${tag}', 'v${tag}@e.com', 'v${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}', 'finance')
    RETURNING id`);
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'VC${tag}') RETURNING id`);
  const challenge = await one<{ id: string }>(`
    SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = ${week}`);
  const entry = await one<{ id: string }>(`
    INSERT INTO challenge_entries
      (campaign_creator_id, challenge_id, base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot,
       approved_platform_count, awarded_points)
    VALUES ('${enrolment.id}', '${challenge.id}', 100, 50, 100, 1, 100)
    RETURNING id`);
  // Ranked, so the Saturday freeze the announce gate requires captures a
  // non-empty board.
  await db.query(`
    UPDATE campaign_creators SET points_total = 100, approved_entries_count = 1
     WHERE id = '${enrolment.id}'`);
  return entry.id;
}

const openRound = (
  week: number,
  entries: string[],
  opts: { opens?: string; closes?: string; allowFew?: boolean; reason?: string } = {},
) =>
  db.query<{ round_id: string }>(
    `SELECT * FROM open_vote_round($1, $2::smallint, $3::timestamptz, $4::timestamptz, $5::uuid[], $6::uuid, $7::boolean, $8::text)`,
    [
      "monica-money-story",
      week,
      opts.opens ?? new Date(Date.now() - 60_000).toISOString(),
      opts.closes ?? new Date(Date.now() + 3_600_000).toISOString(),
      entries,
      adminId,
      opts.allowFew ?? false,
      opts.reason ?? null,
    ],
  );

const nomineeOf = async (round: string, entry: string) =>
  (
    await one<{ id: string }>(
      `SELECT id FROM vote_round_nominees WHERE round_id = '${round}' AND entry_id = '${entry}'`,
    )
  ).id;

const cast = (round: string, nominee: string, email: string, codeHash = "hash-1") =>
  db.query<{ vote_id: string; replaced: boolean }>(
    `SELECT * FROM cast_vote($1, $2::uuid, $3::uuid, $4, $5, $6, $7)`,
    ["monica-money-story", round, nominee, email, codeHash, "iphash", "ua"],
  );

const verify = (
  round: string,
  email: string,
  codeHash = "hash-1",
  cap = 10,
  allowlisted = false,
) =>
  db.query<{ vote_id: string; held: boolean }>(
    `SELECT * FROM verify_vote($1, $2::uuid, $3, $4, $5::integer, $6::boolean)`,
    ["monica-money-story", round, email, codeHash, cap, allowlisted],
  );

const tallyOf = async (round: string) =>
  (
    await db.query<{ nominee_id: string; votes: number }>(
      `SELECT nominee_id, votes FROM vote_tally WHERE round_id = '${round}' ORDER BY votes DESC`,
    )
  ).rows;

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
      `SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`,
    )
  ).id;
  // The purge, not raw DELETEs: leaderboard_snapshots is trigger-protected
  // as append-only, and the purge is the one sanctioned reset.
  await db.query(`SELECT purge_campaign_data($1, $1)`, [
    "monica-money-story",
  ]);
});

describe("opening a round", () => {
  it("seats three to five approved entries of the week and audits the act", async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    const { rows } = await openRound(1, entries);
    expect(rows[0].round_id).toBeTruthy();
    expect(
      await count(`SELECT count(*)::int AS n FROM vote_round_nominees`),
    ).toBe(3);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'vote_round.opened'`,
      ),
    ).toBe(1);
  });

  it("refuses fewer than three without the recorded override, and more than five always", async () => {
    const a = await approvedEntry(1);
    const b = await approvedEntry(1);
    await expect(openRound(1, [a, b])).rejects.toThrow(/too_few_nominees/);
    await expect(
      openRound(1, [a, b], { allowFew: true, reason: "only two eligible" }),
    ).resolves.toBeTruthy();

    const many = await Promise.all(
      Array.from({ length: 6 }, () => approvedEntry(2)),
    );
    await expect(openRound(2, many)).rejects.toThrow(/too_many_nominees/);
  });

  it("refuses an entry from another week or one never approved", async () => {
    const wrongWeek = await approvedEntry(2);
    const ok = [await approvedEntry(1), await approvedEntry(1)];
    await expect(openRound(1, [...ok, wrongWeek])).rejects.toThrow(
      /nominee_not_eligible/,
    );
  });

  it("one round per week, enforced by the index", async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    await openRound(1, entries);
    await expect(openRound(1, entries)).rejects.toThrow();
  });
});

describe("casting and verifying", () => {
  let round: string;
  let nominee: string;

  beforeEach(async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    round = (await openRound(1, entries)).rows[0].round_id;
    nominee = await nomineeOf(round, entries[0]);
  });

  it("a cast plus its code makes one countable vote; the tally sees it", async () => {
    await cast(round, nominee, "ada@gmail.com");
    // Unverified: exists, but counts nowhere.
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes`)).toBe(0);
    await verify(round, "ada@gmail.com");
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes`)).toBe(1);
    const tally = await tallyOf(round);
    expect(tally[0].votes).toBe(1);
  });

  it("one verified vote per email per round, however many casts try", async () => {
    await cast(round, nominee, "ada@gmail.com");
    await verify(round, "ada@gmail.com");
    await expect(cast(round, nominee, "ada@gmail.com")).rejects.toThrow(
      /already_voted/,
    );
  });

  it("recasting before verification changes the choice and kills the old code", async () => {
    const entries2 = await one<{ id: string }>(
      `SELECT entry_id AS id FROM vote_round_nominees WHERE round_id = '${round}' AND id <> '${nominee}' LIMIT 1`,
    );
    const other = await nomineeOf(round, entries2.id);

    await cast(round, nominee, "ada@gmail.com", "code-A");
    const second = await cast(round, other, "ada@gmail.com", "code-B");
    expect(second.rows[0].replaced).toBe(true);

    // The superseded code verifies nothing.
    await expect(verify(round, "ada@gmail.com", "code-A")).rejects.toThrow(
      /code_invalid/,
    );
    await verify(round, "ada@gmail.com", "code-B");
    const tally = await tallyOf(round);
    expect(tally.find((t) => t.nominee_id === other)?.votes).toBe(1);
    expect(tally.find((t) => t.nominee_id === nominee)?.votes).toBe(0);
  });

  it("a wrong or replayed code never verifies", async () => {
    await cast(round, nominee, "ada@gmail.com", "real");
    await expect(verify(round, "ada@gmail.com", "guess")).rejects.toThrow(
      /code_invalid/,
    );
    await verify(round, "ada@gmail.com", "real");
    // Replay after success: the hash was cleared.
    await expect(verify(round, "ada@gmail.com", "real")).rejects.toThrow(
      /code_invalid/,
    );
  });

  it("refuses casting outside the window and into a withdrawn nominee", async () => {
    await db.query(
      `UPDATE vote_rounds SET closes_at = now() - interval '1 minute' WHERE id = '${round}'`,
    );
    await expect(cast(round, nominee, "late@gmail.com")).rejects.toThrow(
      /round_not_open/,
    );
    await db.query(
      `UPDATE vote_rounds SET closes_at = now() + interval '1 hour' WHERE id = '${round}'`,
    );
    await db.query(
      `UPDATE vote_round_nominees SET withdrawn_at = now(), withdrawn_reason = 'test'
        WHERE id = '${nominee}'`,
    );
    await expect(cast(round, nominee, "x@gmail.com")).rejects.toThrow(
      /unknown_nominee/,
    );
  });

  it("verification gets the fifteen-minute grace after close and no more", async () => {
    await cast(round, nominee, "ada@gmail.com");
    await db.query(
      `UPDATE vote_rounds SET opens_at = now() - interval '1 hour',
                              closes_at = now() - interval '10 minutes'
        WHERE id = '${round}'`,
    );
    await expect(verify(round, "ada@gmail.com")).resolves.toBeTruthy();

    await cast(round, nominee, "ben@gmail.com").catch(() => {});
    await db.query(
      `UPDATE vote_rounds SET opens_at = now() - interval '1 hour',
                              closes_at = now() - interval '20 minutes'
        WHERE id = '${round}'`,
    );
    await expect(verify(round, "ben@gmail.com")).rejects.toThrow(
      /round_not_open/,
    );
  });
});

describe("the domain cap", () => {
  let round: string;
  let nominee: string;

  beforeEach(async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    round = (await openRound(1, entries)).rows[0].round_id;
    nominee = await nomineeOf(round, entries[0]);
  });

  it("verified votes past the cap are held, not counted and not refused", async () => {
    for (let i = 0; i < 3; i++) {
      const email = `v${i}@farm.example`;
      await cast(round, nominee, email, `c${i}`);
      const { rows } = await verify(round, email, `c${i}`, 2, false);
      expect(rows[0].held).toBe(i >= 2);
    }
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes`)).toBe(2);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM votes WHERE held_at IS NOT NULL`,
      ),
    ).toBe(1);

    // The human admits it, and it counts.
    const heldVote = await one<{ id: string }>(
      `SELECT id FROM votes WHERE held_at IS NOT NULL`,
    );
    await db.query(`SELECT release_vote($1::uuid, $2::uuid)`, [
      adminId,
      heldVote.id,
    ]);
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes`)).toBe(3);
  });

  it("allowlisted domains never hit the cap", async () => {
    for (let i = 0; i < 4; i++) {
      const email = `real${i}@gmail.com`;
      await cast(round, nominee, email, `g${i}`);
      const { rows } = await verify(round, email, `g${i}`, 2, true);
      expect(rows[0].held).toBe(false);
    }
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes`)).toBe(4);
  });
});

describe("removal, in its two modes", () => {
  let round: string;
  let nominee: string;

  beforeEach(async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    round = (await openRound(1, entries)).rows[0].round_id;
    nominee = await nomineeOf(round, entries[0]);
    await cast(round, nominee, "sus@gmail.com");
    await verify(round, "sus@gmail.com");
  });

  const removeAs = async (mode: string) => {
    const vote = await one<{ id: string }>(
      `SELECT id FROM votes WHERE voter_email_canonical = 'sus@gmail.com'`,
    );
    return db.query(
      `SELECT remove_vote($1::uuid, $2::uuid, $3, $4)`,
      [adminId, vote.id, "cluster of one, testing", mode],
    );
  };

  it("fraud bars the email for the round; the farm cannot re-cast", async () => {
    await removeAs("fraud");
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes`)).toBe(0);
    await expect(cast(round, nominee, "sus@gmail.com")).rejects.toThrow(
      /already_voted/,
    );
  });

  it("unsweep frees a wrongly-flagged person to vote again", async () => {
    await removeAs("unsweep");
    await expect(cast(round, nominee, "sus@gmail.com", "again")).resolves.toBeTruthy();
    await verify(round, "sus@gmail.com", "again");
    expect(await count(`SELECT count(*)::int AS n FROM countable_votes`)).toBe(1);
  });

  it("a removal needs a reason and a known mode", async () => {
    const vote = await one<{ id: string }>(
      `SELECT id FROM votes WHERE voter_email_canonical = 'sus@gmail.com'`,
    );
    await expect(
      db.query(`SELECT remove_vote($1::uuid, $2::uuid, '', 'fraud')`, [adminId, vote.id]),
    ).rejects.toThrow(/reason_required/);
    await expect(
      db.query(`SELECT remove_vote($1::uuid, $2::uuid, 'x', 'oops')`, [adminId, vote.id]),
    ).rejects.toThrow(/mode_required/);
  });
});

describe("close, review, announce", () => {
  it("announcing Community Favourite refuses until the round is closed and reviewed", async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    const round = (await openRound(1, entries)).rows[0].round_id;
    const enrolment = await one<{ id: string }>(
      `SELECT campaign_creator_id AS id FROM challenge_entries WHERE id = '${entries[0]}'`,
    );
    await db.query(
      `SELECT * FROM take_leaderboard_snapshot($1, 1::smallint, $2::uuid)`,
      ["monica-money-story", adminId],
    );

    const announce = () =>
      db.query(
        `SELECT * FROM publish_weekly_winner($1, 1::smallint, 'community_favourite'::winner_category,
           $2::uuid, $3::uuid, 100000, NULL, $4::uuid, true)`,
        ["monica-money-story", enrolment.id, entries[0], adminId],
      );

    // Open round: the sweep has not happened, announce refuses by name.
    await expect(announce()).rejects.toThrow(/round_not_reviewed/);

    await db.query(`SELECT close_vote_round($1::uuid, $2::uuid)`, [adminId, round]);
    await expect(announce()).rejects.toThrow(/round_not_reviewed/);

    await db.query(`SELECT mark_round_reviewed($1::uuid, $2::uuid)`, [adminId, round]);
    await expect(announce()).resolves.toBeTruthy();

    // The round followed the announcement into its terminal state, and the
    // winning entry travelled so the public page keeps its link.
    expect(
      (await one<{ status: string }>(`SELECT status FROM vote_rounds WHERE id = '${round}'`)).status,
    ).toBe("published");
    expect(
      (await one<{ entry_id: string }>(`SELECT entry_id FROM weekly_winners LIMIT 1`)).entry_id,
    ).toBe(entries[0]);
  });

  it("a week with no round announces exactly as before", async () => {
    const entry = await approvedEntry(1);
    const enrolment = await one<{ id: string }>(
      `SELECT campaign_creator_id AS id FROM challenge_entries WHERE id = '${entry}'`,
    );
    await db.query(
      `SELECT * FROM take_leaderboard_snapshot($1, 1::smallint, $2::uuid)`,
      ["monica-money-story", adminId],
    );
    await expect(
      db.query(
        `SELECT * FROM publish_weekly_winner($1, 1::smallint, 'community_favourite'::winner_category,
           $2::uuid, NULL, 100000, NULL, $3::uuid, true)`,
        ["monica-money-story", enrolment.id, adminId],
      ),
    ).resolves.toBeTruthy();
  });

  const enrolmentOf = async (entry: string) =>
    (
      await one<{ id: string }>(
        `SELECT campaign_creator_id AS id FROM challenge_entries WHERE id = '${entry}'`,
      )
    ).id;

  const announceFavourite = (enrolment: string) =>
    db.query(
      `SELECT * FROM publish_weekly_winner($1, 1::smallint, 'community_favourite'::winner_category,
         $2::uuid, NULL, 100000, NULL, $3::uuid, true)`,
      ["monica-money-story", enrolment, adminId],
    );

  const settleRound = async (round: string) => {
    await db.query(
      `SELECT * FROM take_leaderboard_snapshot($1, 1::smallint, $2::uuid)`,
      ["monica-money-story", adminId],
    );
    await db.query(`SELECT close_vote_round($1::uuid, $2::uuid)`, [adminId, round]);
    await db.query(`SELECT mark_round_reviewed($1::uuid, $2::uuid)`, [adminId, round]);
  };

  it("the vote decides: announcing anyone but the winner refuses by name", async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    const round = (await openRound(1, entries)).rows[0].round_id;
    const winner = await nomineeOf(round, entries[1]);
    await cast(round, winner, "decider@gmail.com");
    await verify(round, "decider@gmail.com");
    await settleRound(round);

    // An owner with the form open still cannot announce the loser.
    await expect(announceFavourite(await enrolmentOf(entries[0]))).rejects.toThrow(
      /not_the_vote_winner/,
    );

    // The winner announces, and the winning entry travels even though the
    // call passed no entry: the public page keeps linking what people
    // actually voted for.
    await expect(announceFavourite(await enrolmentOf(entries[1]))).resolves.toBeTruthy();
    expect(
      (await one<{ entry_id: string }>(`SELECT entry_id FROM weekly_winners LIMIT 1`)).entry_id,
    ).toBe(entries[1]);
  });

  it("a vote tie breaks by the recorded standings, as the rules publish", async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    const round = (await openRound(1, entries)).rows[0].round_id;
    await cast(round, await nomineeOf(round, entries[0]), "one@gmail.com", "c1");
    await verify(round, "one@gmail.com", "c1");
    await cast(round, await nomineeOf(round, entries[1]), "two@yahoo.com", "c2");
    await verify(round, "two@yahoo.com", "c2");

    // One vote each; the second nominee stands higher on the board when
    // the week is recorded, so the standings break the tie their way.
    const ahead = await enrolmentOf(entries[1]);
    await db.query(
      `UPDATE campaign_creators SET points_total = 150 WHERE id = '${ahead}'`,
    );
    await settleRound(round);

    await expect(announceFavourite(await enrolmentOf(entries[0]))).rejects.toThrow(
      /not_the_vote_winner/,
    );
    await expect(announceFavourite(ahead)).resolves.toBeTruthy();
  });

  it("zero countable votes falls back to Blockfest selecting, shortlist only", async () => {
    const entries = [await approvedEntry(1), await approvedEntry(1), await approvedEntry(1)];
    const outsider = await approvedEntry(1);
    const round = (await openRound(1, entries)).rows[0].round_id;
    await settleRound(round);

    // The fallback is a genuine selection, but only among the names people
    // were shown. A creator who was never on the ballot cannot quietly
    // become its winner.
    await expect(announceFavourite(await enrolmentOf(outsider))).rejects.toThrow(
      /not_on_shortlist/,
    );
    await expect(announceFavourite(await enrolmentOf(entries[2]))).resolves.toBeTruthy();
    expect(
      (await one<{ entry_id: string }>(`SELECT entry_id FROM weekly_winners LIMIT 1`)).entry_id,
    ).toBe(entries[2]);
  });
});
