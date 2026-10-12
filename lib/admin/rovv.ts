import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { csvFile } from "@/lib/csv";
import { ROVV_SLUG, type RovvEntryStatus } from "@/lib/rovv";
import type { AdminIdentity } from "@/lib/admin/session";

/**
 * Rovv's entries, read and decided for the console (0073_rovv_campaign.sql).
 *
 * Raw SQL rather than a drizzle table: rovv_entries has no schema object and
 * the rules live in the database's own functions, so this module only reads
 * rows and calls decide_rovv_entry and set_rovv_winner. Every function takes
 * an AdminIdentity, the same discipline as every other lib/admin module: a
 * call from an unguarded place does not compile.
 */

/** What the console's filter can ask for: a review state, the winners, or everything. */
export type RovvFilter = "all" | RovvEntryStatus | "winners";

export interface RovvEntryRow {
  id: string;
  fullName: string;
  email: string;
  tiktokHandle: string;
  tiktokUrl: string;
  referralCode: string;
  status: RovvEntryStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
  /** Null when nobody has ruled yet, or the reviewer has since been removed. */
  reviewerEmail: string | null;
  winnerAt: Date | null;
  notifiedAt: Date | null;
  createdAt: Date;
  /** 1, plus one for each time the entrant replaced it. A ruling names it. */
  revision: number;
  /** How many other entries name the same video. Only one can be eligible. */
  sameVideo: number;
}

export interface RovvCounts {
  total: number;
  pending: number;
  eligible: number;
  ineligible: number;
  winners: number;
  /** Winners who have been emailed. */
  notified: number;
  /** Winners whose email a press is sending right now. */
  sending: number;
}

/** A winner not yet emailed, and not being emailed by another press. */
export interface RovvWinnerToNotify {
  id: string;
  fullName: string;
  email: string;
  tiktokUrl: string;
}

/**
 * How long a press's claim on a winner holds: longer than the notify route
 * can run (maxDuration 300s), so a claim is never taken over while its mail
 * may still be leaving. The database's unpick check uses the same interval.
 */
const CLAIM_HOLDS = sql`interval '6 minutes'`;

/* PGlite hands back Date objects and neon-http hands back strings. */
const toDate = (value: unknown): Date =>
  value instanceof Date ? value : new Date(String(value));
const toDateOrNull = (value: unknown): Date | null =>
  value === null || value === undefined ? null : toDate(value);

/** Newest first. No limit returns every match, which is what the export wants. */
export async function rovvEntries(
  admin: AdminIdentity,
  { status = "all", limit }: { status?: RovvFilter; limit?: number } = {},
): Promise<RovvEntryRow[]> {
  void admin;

  const which =
    status === "winners"
      ? sql`AND e.winner_at IS NOT NULL`
      : status === "all"
        ? sql``
        : sql`AND e.status = ${status}`;

  const result = await getDb().execute(sql`
    SELECT e.id, e.full_name, e.email, e.tiktok_handle, e.tiktok_url,
           e.referral_code, e.status, e.review_note, e.reviewed_at,
           e.winner_at, e.notified_at, e.created_at, e.revision,
           (SELECT count(*)::int FROM rovv_entries o
             WHERE o.campaign_id = e.campaign_id AND o.post_key = e.post_key
               AND o.id <> e.id) AS same_video,
           a.email AS reviewer_email
      FROM rovv_entries e
      JOIN campaigns c ON c.id = e.campaign_id
      LEFT JOIN admin_users a ON a.id = e.reviewed_by_admin_id
     WHERE c.slug = ${ROVV_SLUG}
       ${which}
     ORDER BY e.created_at DESC, e.id
     ${limit ? sql`LIMIT ${limit}` : sql``}
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      fullName: String(r.full_name),
      email: String(r.email),
      tiktokHandle: String(r.tiktok_handle),
      tiktokUrl: String(r.tiktok_url),
      referralCode: String(r.referral_code),
      status: String(r.status) as RovvEntryStatus,
      reviewNote: r.review_note ? String(r.review_note) : null,
      reviewedAt: toDateOrNull(r.reviewed_at),
      reviewerEmail: r.reviewer_email ? String(r.reviewer_email) : null,
      winnerAt: toDateOrNull(r.winner_at),
      notifiedAt: toDateOrNull(r.notified_at),
      createdAt: toDate(r.created_at),
      revision: Number(r.revision ?? 1),
      sameVideo: Number(r.same_video ?? 0),
    };
  });
}

export async function rovvCounts(admin: AdminIdentity): Promise<RovvCounts> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT count(*)::int                                            AS total,
           count(*) FILTER (WHERE e.status = 'pending')::int        AS pending,
           count(*) FILTER (WHERE e.status = 'eligible')::int       AS eligible,
           count(*) FILTER (WHERE e.status = 'ineligible')::int     AS ineligible,
           count(*) FILTER (WHERE e.winner_at IS NOT NULL)::int     AS winners,
           count(*) FILTER (WHERE e.notified_at IS NOT NULL)::int   AS notified,
           count(*) FILTER (WHERE e.winner_at IS NOT NULL AND e.notified_at IS NULL
                              AND e.notice_claimed_at > now() - ${CLAIM_HOLDS})::int AS sending
      FROM rovv_entries e
      JOIN campaigns c ON c.id = e.campaign_id
     WHERE c.slug = ${ROVV_SLUG}
  `);

  const r = (result.rows?.[0] ?? {}) as Record<string, unknown>;
  return {
    total: Number(r.total ?? 0),
    pending: Number(r.pending ?? 0),
    eligible: Number(r.eligible ?? 0),
    ineligible: Number(r.ineligible ?? 0),
    winners: Number(r.winners ?? 0),
    notified: Number(r.notified ?? 0),
    sending: Number(r.sending ?? 0),
  };
}

/** Winners nobody has emailed yet, oldest pick first. */
export async function rovvWinnersToNotify(
  admin: AdminIdentity,
): Promise<RovvWinnerToNotify[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT e.id, e.full_name, e.email, e.tiktok_url
      FROM rovv_entries e
      JOIN campaigns c ON c.id = e.campaign_id
     WHERE c.slug = ${ROVV_SLUG}
       AND e.winner_at IS NOT NULL
       AND e.notified_at IS NULL
       AND (e.notice_claimed_at IS NULL OR e.notice_claimed_at <= now() - ${CLAIM_HOLDS})
     ORDER BY e.winner_at, e.id
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      fullName: String(r.full_name),
      email: String(r.email),
      tiktokUrl: String(r.tiktok_url),
    };
  });
}

/**
 * Claim one winner's notice before mailing them.
 *
 * notified_at is only stamped once a mail has left, which stops a re-press
 * after a send mailing anybody twice, but not a press during one: the first
 * press can take most of a minute over twenty mails, and a reload or a second
 * device pressing meanwhile would read the same untold winners. So each press
 * claims each winner first, and a claim holds until its mail is stamped or
 * fails (or CLAIM_HOLDS passes, for a press that died). One UPDATE, so of two
 * presses racing for the same winner exactly one gets them; the database
 * also refuses to unpick a claimed winner (P1011), so nobody is told they won
 * after being unpicked.
 */
export async function claimRovvNotice(
  admin: AdminIdentity,
  winner: Pick<RovvWinnerToNotify, "id">,
): Promise<boolean> {
  void admin;

  const result = await getDb().execute(sql`
    UPDATE rovv_entries
       SET notice_claimed_at = now()
     WHERE id = ${winner.id}::uuid
       AND winner_at IS NOT NULL
       AND notified_at IS NULL
       AND (notice_claimed_at IS NULL OR notice_claimed_at <= now() - ${CLAIM_HOLDS})
    RETURNING id
  `);
  return (result.rows?.length ?? 0) > 0;
}

/** Let a claim go when its mail did not leave, so the next press retries them. */
export async function releaseRovvNotice(admin: AdminIdentity, entryId: string): Promise<void> {
  void admin;

  await getDb().execute(sql`
    UPDATE rovv_entries SET notice_claimed_at = NULL
     WHERE id = ${entryId}::uuid AND notified_at IS NULL
  `);
}

/**
 * Record that a winner's mail left. Only ever called after a send that
 * reported sent, so notified_at means "emailed", which is also what puts
 * their username on the public page (lib/rovv-winners.ts).
 */
export async function markRovvNotified(
  admin: AdminIdentity,
  entryId: string,
): Promise<boolean> {
  void admin;

  const result = await getDb().execute(sql`
    UPDATE rovv_entries SET notified_at = now(), updated_at = now()
     WHERE id = ${entryId}::uuid
       AND winner_at IS NOT NULL
       AND notified_at IS NULL
    RETURNING id
  `);
  return (result.rows?.length ?? 0) > 0;
}

/**
 * A reviewer's ruling. The function checks the reason, the state and the
 * winner rule, and writes the audit row itself; its raises reach the route,
 * which turns their codes into words.
 */
export async function decideRovvEntry(
  admin: AdminIdentity,
  entryId: string,
  status: RovvEntryStatus,
  note: string | null,
  /** The revision the reviewer was shown; refused (P1012) if it has moved. */
  revision: number,
): Promise<{ status: RovvEntryStatus; winner: boolean }> {
  const result = await getDb().execute(sql`
    SELECT * FROM decide_rovv_entry(
      ${entryId}::uuid, ${status}::text, ${note}::text, ${admin.adminId}::uuid, ${revision}::int
    )
  `);
  const r = (result.rows?.[0] ?? {}) as { status?: string; winner?: boolean };
  return { status: (r.status ?? status) as RovvEntryStatus, winner: Boolean(r.winner) };
}

/** Pick or unpick a winner. Returns how many are picked now. */
export async function setRovvWinner(
  admin: AdminIdentity,
  entryId: string,
  pick: boolean,
): Promise<number> {
  const result = await getDb().execute(sql`
    SELECT * FROM set_rovv_winner(
      ${entryId}::uuid, ${pick}::boolean, ${admin.adminId}::uuid
    )
  `);
  return Number((result.rows?.[0] as { winners?: number } | undefined)?.winners ?? 0);
}

/* ------------------------------------------------------------------ */
/* The export                                                         */
/* ------------------------------------------------------------------ */

const LAGOS_STAMP = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Africa/Lagos",
});

/** 2026-10-13 09:05, Lagos: sorts as text and reads the same in any spreadsheet. */
export function lagosStamp(date: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    LAGOS_STAMP.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

/**
 * csvFile defuses anything a spreadsheet would run in both files below:
 * every field in them was typed by the entrant.
 *
 * The file that goes to ROVV, and only what the privacy notice says ROVV
 * receives: name, email, TikTok username and referral code. Every entry, so
 * ROVV can confirm each code; nothing about how the team ruled on it.
 */
export function rovvReferralCsv(rows: RovvEntryRow[]): string {
  return csvFile([
    ["full_name", "email", "tiktok_handle", "referral_code"],
    ...rows.map((row) => [row.fullName, row.email, row.tiktokHandle, row.referralCode]),
  ]);
}

/** Every column, for the team. Not for sending to ROVV: see rovvReferralCsv. */
export function rovvCsv(rows: RovvEntryRow[]): string {
  return csvFile([
    [
      "submitted_at_lagos",
      "full_name",
      "email",
      "tiktok_handle",
      "tiktok_url",
      "referral_code",
      "status",
      "review_note",
      "winner",
      "notified_at_lagos",
    ],
    ...rows.map((row) => [
      lagosStamp(row.createdAt),
      row.fullName,
      row.email,
      row.tiktokHandle,
      row.tiktokUrl,
      row.referralCode,
      row.status,
      row.reviewNote ?? "",
      row.winnerAt ? "yes" : "no",
      row.notifiedAt ? lagosStamp(row.notifiedAt) : "",
    ]),
  ]);
}
