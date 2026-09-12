import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG, monicaFinalPrizes } from "@/lib/campaigns";
import { csvFile } from "@/lib/csv";
import { pointSourceLabel } from "@/lib/point-sources";
import type { AdminIdentity } from "@/lib/admin/session";

/**
 * The artefact that settles a dispute two days before a 1,500,000 naira
 * transfer.
 *
 * Every ledger row for every payee, with the date, the source, the amount, the
 * admin who awarded it and the note they wrote, plus the entries they were paid
 * for. Not a summary: a summary is what somebody disputes, and the answer to a
 * dispute is the working.
 *
 * There are no bank details here and there never will be. They are collected
 * out of band from winners only, and a platform that holds them is a platform
 * that can leak them. A test asserts their absence rather than trusting it.
 */

export interface PayoutLine {
  rank: number;
  name: string;
  /** What the published prize table says this position is paid. */
  prizeNaira: number;
  pointsTotal: number;
  /** The sum of their ledger rows. Must equal pointsTotal. */
  ledgerSum: number;
  reconciles: boolean;
  rows: {
    at: Date;
    source: string;
    points: number;
    note: string | null;
    awardedBy: string | null;
    weekNo: number | null;
  }[];
  entries: { weekNo: number; platform: string; url: string }[];
}

/**
 * The final standings, with the working for each payee.
 *
 * Ordered by campaign_ranked, which is the tiebreak the rules published on day
 * one: total points, then who reached that total first, then approved entries.
 * The ordering is not decided here, deliberately. If this query sorted for
 * itself it could disagree with the public board, and the first time anybody
 * noticed would be a tie at the top worth 700,000 naira.
 */
export async function payoutLines(
  admin: AdminIdentity,
  positions = monicaFinalPrizes.length,
): Promise<PayoutLine[]> {
  void admin;

  const ranked = await getDb().execute(sql`
    SELECT rank, campaign_creator_id, display_name, points_total
      FROM campaign_ranked(${MONICA_SLUG})
     ORDER BY rank
     LIMIT ${positions}
  `);

  const lines: PayoutLine[] = [];

  for (const row of ranked.rows ?? []) {
    const r = row as Record<string, unknown>;
    const enrolmentId = String(r.campaign_creator_id);
    const rank = Number(r.rank ?? 0);

    const ledger = await getDb().execute(sql`
      SELECT pl.created_at, pl.source::text AS source, pl.points, pl.note,
             a.email AS awarded_by, ch.week_no
        FROM point_ledger pl
        LEFT JOIN admin_users a        ON a.id = pl.awarded_by_admin_id
        LEFT JOIN challenge_entries ce ON ce.id = pl.entry_id
        LEFT JOIN challenges ch        ON ch.id = ce.challenge_id
       WHERE pl.campaign_creator_id = ${enrolmentId}::uuid
       ORDER BY pl.created_at, pl.id
    `);

    const entries = await getDb().execute(sql`
      SELECT ch.week_no, s.platform::text AS platform, s.url
        FROM submissions s
        JOIN challenge_entries ce ON ce.id = s.entry_id
        JOIN challenges ch        ON ch.id = ce.challenge_id
       WHERE ce.campaign_creator_id = ${enrolmentId}::uuid
         AND s.status = 'approved'
       ORDER BY ch.week_no, s.platform
    `);

    const rows = (ledger.rows ?? []).map((l) => {
      const row = l as Record<string, unknown>;
      return {
        at: new Date(String(row.created_at)),
        source: String(row.source),
        points: Number(row.points ?? 0),
        note: row.note ? String(row.note) : null,
        awardedBy: row.awarded_by ? String(row.awarded_by) : null,
        weekNo: row.week_no === null || row.week_no === undefined
          ? null
          : Number(row.week_no),
      };
    });

    const pointsTotal = Number(r.points_total ?? 0);
    const ledgerSum = rows.reduce((total, row) => total + row.points, 0);

    lines.push({
      rank,
      name: String(r.display_name ?? "").trim(),
      // Positions beyond the published table are included with no prize, so a
      // near miss can still be checked without inventing an award for them.
      prizeNaira: monicaFinalPrizes[rank - 1]?.amount ?? 0,
      pointsTotal,
      ledgerSum,
      reconciles: pointsTotal === ledgerSum,
      rows,
      entries: (entries.rows ?? []).map((e) => {
        const row = e as Record<string, unknown>;
        return {
          weekNo: Number(row.week_no ?? 0),
          platform: String(row.platform),
          url: String(row.url),
        };
      }),
    });
  }

  return lines;
}

const LAGOS = "Africa/Lagos";

const when = (date: Date) =>
  date.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LAGOS,
  });

/**
 * One file, one row per ledger entry, with the payee repeated on each.
 *
 * Long rather than wide on purpose. A spreadsheet can pivot a long file and
 * cannot unpivot a wide one, and the question this answers is "where did this
 * number come from", which is a question about rows.
 *
 * The reconciliation column is on every row rather than in a summary, because a
 * summary at the bottom is the part people scroll past.
 */
export function payoutCsv(lines: PayoutLine[]): string {
  const rows: unknown[][] = [
    [
      "rank",
      "creator",
      "prize_naira",
      "points_total",
      "ledger_sum",
      "reconciles",
      "awarded_at_lagos",
      "source",
      "points",
      "week",
      "awarded_by",
      "note",
    ],
  ];

  for (const line of lines) {
    if (line.rows.length === 0) {
      rows.push([
        line.rank,
        line.name,
        line.prizeNaira,
        line.pointsTotal,
        line.ledgerSum,
        line.reconciles ? "yes" : "NO",
        "",
        "no ledger rows",
        0,
        "",
        "",
        "",
      ]);
      continue;
    }

    for (const row of line.rows) {
      rows.push([
        line.rank,
        line.name,
        line.prizeNaira,
        line.pointsTotal,
        line.ledgerSum,
        line.reconciles ? "yes" : "NO",
        when(row.at),
        pointSourceLabel(row.source),
        row.points,
        row.weekNo ?? "",
        row.awardedBy ?? "",
        row.note ?? "",
      ]);
    }
  }

  return csvFile(rows);
}

/** The published work, so a payout can be checked against what was posted. */
export function entriesCsv(lines: PayoutLine[]): string {
  const rows: unknown[][] = [["rank", "creator", "week", "platform", "url"]];

  for (const line of lines) {
    for (const entry of line.entries) {
      rows.push([line.rank, line.name, entry.weekNo, entry.platform, entry.url]);
    }
  }

  return csvFile(rows);
}
