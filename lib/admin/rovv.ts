import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { csvFile } from "@/lib/csv";
import { ROVV_SLUG, type RovvEntryStatus } from "@/lib/rovv";
import { isOwner, type AdminIdentity } from "@/lib/admin/session";

/**
 * Rovv's entries, read and decided for the console (0073_rovv_campaign.sql).
 *
 * Raw SQL rather than a drizzle table: rovv_entries has no schema object and
 * the rules live in the database's own functions, so this module only reads
 * rows and calls decide_rovv_entry and set_rovv_winner. Every function takes
 * an AdminIdentity, the same discipline as every other lib/admin module: a
 * call from an unguarded place does not compile.
 */

/**
 * What the console's filter can ask for: a review state, the winners, every
 * real entry, or the test entries. Every filter but "test" leaves tests out,
 * so nothing an export or a count reads ever includes one (0074).
 */
export type RovvFilter = "all" | RovvEntryStatus | "winners" | "test";

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
  /** An admin's test entry (0074): never public, exported or counted. */
  isTest: boolean;
  /** The winner's 100%-off ticket code, once the owner has given one. */
  ticketCode: string | null;
  /** Other entries (of the same kind) under the same TikTok username. */
  sameHandle: number;
  /** Other entries (of the same kind) with the same referral code, ignoring case. */
  sameReferral: number;
  /** When the entry last changed: a replacement shows when it came back. */
  updatedAt: Date;
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
  /** Winners not yet emailed who have no ticket code, so cannot be. */
  needCode: number;
  /** Test entries, counted apart and in nothing above. */
  tests: number;
  /** Test winners not yet emailed and without a code, for the test panel. */
  testNeedCode: number;
  /** Real entrants who did not win and have not had the results email. */
  resultsToSend: number;
  /** How many have had it. */
  resultsSent: number;
}

/** A winner not yet emailed, and not being emailed by another press. */
export interface RovvWinnerToNotify {
  id: string;
  fullName: string;
  email: string;
  tiktokUrl: string;
  tiktokHandle: string;
  /** Always present: a winner without a code is never listed to email. */
  ticketCode: string;
}

/* One row of rovv_entries as a winner to tell. */
const toWinner = (r: Record<string, unknown>): RovvWinnerToNotify => ({
  id: String(r.id),
  fullName: String(r.full_name),
  email: String(r.email),
  tiktokUrl: String(r.tiktok_url),
  tiktokHandle: String(r.tiktok_handle),
  ticketCode: String(r.ticket_code),
});

/**
 * How long a press's claim on a winner holds: longer than the notify route
 * can run (maxDuration 300s), so a claim is never taken over while its mail
 * may still be leaving. The database's unpick check uses the same interval.
 */
const CLAIM_HOLDS = sql`interval '6 minutes'`;

/**
 * A text[] built from one parameter per element. drizzle's sql template
 * spreads a JavaScript array into a parameter list, so `${codes}::text[]`
 * would be ($1, $2)::text[], which is not an array.
 */
function textArray(values: string[]) {
  return values.length === 0
    ? sql`ARRAY[]::text[]`
    : sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::text[]`;
}

/* PGlite hands back Date objects and neon-http hands back strings. */
const toDate = (value: unknown): Date =>
  value instanceof Date ? value : new Date(String(value));
const toDateOrNull = (value: unknown): Date | null =>
  value === null || value === undefined ? null : toDate(value);

/** Newest first. No limit returns every match, which is what the export wants. */
export async function rovvEntries(
  admin: AdminIdentity,
  { status = "all", limit, q }: { status?: RovvFilter; limit?: number; q?: string } = {},
): Promise<RovvEntryRow[]> {
  /* A search over what someone writing in would quote: their name, email,
     username or referral code; a ticket code too, but only for an owner, so
     a reviewer cannot test whether a code exists by searching for it. */
  const term = q?.trim().slice(0, 100);
  const like = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const search = like
    ? sql`AND (e.full_name ILIKE ${like} OR e.email ILIKE ${like} OR e.tiktok_handle ILIKE ${like}
               OR e.referral_code ILIKE ${like}
               ${isOwner(admin) ? sql`OR e.ticket_code ILIKE ${like}` : sql``})`
    : sql``;
  /* The waiting list is worked from the front: the oldest wait first, so
     the cap never hides the people who have waited longest. */
  /* By when they first entered: a resend, a replacement or a correction
     does not send anybody to the back of the queue, or jump them ahead. */
  const order = status === "pending" ? sql`ORDER BY e.created_at ASC, e.id` : sql`ORDER BY e.created_at DESC, e.id`;

  const which =
    status === "test"
      ? sql`AND e.is_test`
      : status === "winners"
        ? sql`AND NOT e.is_test AND e.winner_at IS NOT NULL`
        : status === "all"
          ? sql`AND NOT e.is_test`
          : sql`AND NOT e.is_test AND e.status = ${status}`;

  const result = await getDb().execute(sql`
    SELECT e.id, e.full_name, e.email, e.tiktok_handle, e.tiktok_url,
           e.referral_code, e.status, e.review_note, e.reviewed_at,
           e.winner_at, e.notified_at, e.created_at, e.revision,
           e.is_test, e.ticket_code, e.updated_at,
           (SELECT count(*)::int FROM rovv_entries o
             WHERE o.campaign_id = e.campaign_id AND o.post_key = e.post_key
               AND o.is_test = e.is_test AND o.id <> e.id) AS same_video,
           (SELECT count(*)::int FROM rovv_entries o
             WHERE o.campaign_id = e.campaign_id AND o.tiktok_handle = e.tiktok_handle
               AND o.is_test = e.is_test AND o.id <> e.id) AS same_handle,
           (SELECT count(*)::int FROM rovv_entries o
             WHERE o.campaign_id = e.campaign_id AND upper(o.referral_code) = upper(e.referral_code)
               AND o.is_test = e.is_test AND o.id <> e.id) AS same_referral,
           a.email AS reviewer_email
      FROM rovv_entries e
      JOIN campaigns c ON c.id = e.campaign_id
      LEFT JOIN admin_users a ON a.id = e.reviewed_by_admin_id
     WHERE c.slug = ${ROVV_SLUG}
       ${which}
       ${search}
     ${order}
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
      isTest: Boolean(r.is_test),
      ticketCode: r.ticket_code ? String(r.ticket_code) : null,
      sameHandle: Number(r.same_handle ?? 0),
      sameReferral: Number(r.same_referral ?? 0),
      updatedAt: toDate(r.updated_at),
    };
  });
}

export async function rovvCounts(admin: AdminIdentity): Promise<RovvCounts> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT count(*) FILTER (WHERE NOT e.is_test)::int                                   AS total,
           count(*) FILTER (WHERE NOT e.is_test AND e.status = 'pending')::int          AS pending,
           count(*) FILTER (WHERE NOT e.is_test AND e.status = 'eligible')::int         AS eligible,
           count(*) FILTER (WHERE NOT e.is_test AND e.status = 'ineligible')::int       AS ineligible,
           count(*) FILTER (WHERE NOT e.is_test AND e.winner_at IS NOT NULL)::int       AS winners,
           count(*) FILTER (WHERE NOT e.is_test AND e.notified_at IS NOT NULL)::int     AS notified,
           count(*) FILTER (WHERE NOT e.is_test AND e.winner_at IS NOT NULL AND e.notified_at IS NULL
                              AND e.notice_claimed_at > now() - ${CLAIM_HOLDS})::int    AS sending,
           count(*) FILTER (WHERE NOT e.is_test AND e.winner_at IS NOT NULL AND e.notified_at IS NULL
                              AND e.ticket_code IS NULL)::int                           AS need_code,
           count(*) FILTER (WHERE e.is_test)::int                                       AS tests,
           count(*) FILTER (WHERE e.is_test AND e.winner_at IS NOT NULL AND e.notified_at IS NULL
                              AND e.ticket_code IS NULL)::int                           AS test_need_code,
           count(*) FILTER (WHERE NOT e.is_test AND e.winner_at IS NULL AND e.status <> 'ineligible'
                              AND e.results_emailed_at IS NULL)::int                    AS results_to_send,
           count(*) FILTER (WHERE NOT e.is_test AND e.results_emailed_at IS NOT NULL)::int AS results_sent
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
    needCode: Number(r.need_code ?? 0),
    tests: Number(r.tests ?? 0),
    testNeedCode: Number(r.test_need_code ?? 0),
    resultsToSend: Number(r.results_to_send ?? 0),
    resultsSent: Number(r.results_sent ?? 0),
  };
}

/** Winners nobody has emailed yet, oldest pick first. */
export async function rovvWinnersToNotify(
  admin: AdminIdentity,
): Promise<RovvWinnerToNotify[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT e.id, e.full_name, e.email, e.tiktok_url, e.tiktok_handle, e.ticket_code
      FROM rovv_entries e
      JOIN campaigns c ON c.id = e.campaign_id
     WHERE c.slug = ${ROVV_SLUG}
       AND NOT e.is_test
       AND e.winner_at IS NOT NULL
       AND e.notified_at IS NULL
       AND e.ticket_code IS NOT NULL
       AND (e.notice_claimed_at IS NULL OR e.notice_claimed_at <= now() - ${CLAIM_HOLDS})
     ORDER BY e.winner_at, e.id
  `);

  return ((result.rows ?? []) as Record<string, unknown>[]).map(toWinner);
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
): Promise<RovvWinnerToNotify | null> {
  void admin;

  /* Returns the row as it stands under the claim, and the mail is built from
     that, not from the list read before: a code corrected in the second
     between the two would otherwise be mailed in its old form, then locked
     in its new one (set_rovv_ticket_code refuses a claimed winner). */
  const result = await getDb().execute(sql`
    UPDATE rovv_entries
       SET notice_claimed_at = now()
     WHERE id = ${winner.id}::uuid
       AND winner_at IS NOT NULL
       AND notified_at IS NULL
       AND ticket_code IS NOT NULL
       AND (notice_claimed_at IS NULL OR notice_claimed_at <= now() - ${CLAIM_HOLDS})
    RETURNING id, full_name, email, tiktok_url, tiktok_handle, ticket_code
  `);
  const r = result.rows?.[0] as Record<string, unknown> | undefined;
  return r ? toWinner(r) : null;
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
  /** The ruling the reviewer's card showed; refused (P1018) if another reviewer has since ruled. */
  from: RovvEntryStatus | null = null,
): Promise<{ status: RovvEntryStatus; winner: boolean; previous: RovvEntryStatus }> {
  const result = await getDb().execute(sql`
    SELECT * FROM decide_rovv_entry(
      ${entryId}::uuid, ${status}::text, ${note}::text, ${admin.adminId}::uuid, ${revision}::int, ${from}::text
    )
  `);
  const r = (result.rows?.[0] ?? {}) as { status?: string; winner?: boolean; previous?: string };
  return {
    status: (r.status ?? status) as RovvEntryStatus,
    winner: Boolean(r.winner),
    previous: (r.previous ?? status) as RovvEntryStatus,
  };
}

/** Who to write to about an entry, for the review emails. */
export async function rovvEntrant(
  admin: AdminIdentity,
  entryId: string,
): Promise<{
  fullName: string;
  email: string;
  tiktokHandle: string;
  tiktokUrl: string;
  referralCode: string;
  status: RovvEntryStatus;
  reviewNote: string | null;
  isTest: boolean;
  /** The ruling they were last emailed, if any (0074). */
  rulingEmailed: RovvEntryStatus | null;
} | null> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT full_name, email, tiktok_handle, tiktok_url, referral_code, status, review_note, is_test, ruling_emailed
      FROM rovv_entries WHERE id = ${entryId}::uuid
  `);
  const r = result.rows?.[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    fullName: String(r.full_name),
    email: String(r.email),
    tiktokHandle: String(r.tiktok_handle),
    tiktokUrl: String(r.tiktok_url),
    referralCode: String(r.referral_code),
    status: String(r.status) as RovvEntryStatus,
    reviewNote: r.review_note ? String(r.review_note) : null,
    isTest: Boolean(r.is_test),
    rulingEmailed: r.ruling_emailed ? (String(r.ruling_emailed) as RovvEntryStatus) : null,
  };
}

/** Whether any real winner has been emailed: the results are then out. */
export async function rovvWinnersAnnounced(admin: AdminIdentity): Promise<boolean> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM rovv_entries e JOIN campaigns c ON c.id = e.campaign_id
       WHERE c.slug = ${ROVV_SLUG} AND NOT e.is_test AND e.notified_at IS NOT NULL
    ) AS announced
  `);
  return Boolean((result.rows?.[0] as { announced?: boolean } | undefined)?.announced);
}

/** Record which ruling the entrant was just emailed. */
export async function markRovvRulingEmailed(
  admin: AdminIdentity,
  entryId: string,
  status: "eligible" | "ineligible",
): Promise<void> {
  void admin;

  await getDb().execute(sql`
    UPDATE rovv_entries SET ruling_emailed = ${status} WHERE id = ${entryId}::uuid
  `);
}

/** Give a winner their ticket code, or clear it with an empty one. */
export async function setRovvTicketCode(
  admin: AdminIdentity,
  entryId: string,
  code: string,
): Promise<string | null> {
  const result = await getDb().execute(sql`
    SELECT * FROM set_rovv_ticket_code(${entryId}::uuid, ${code}::text, ${admin.adminId}::uuid)
  `);
  const r = result.rows?.[0] as { code?: string | null } | undefined;
  return r?.code ?? null;
}

/**
 * Hand a pasted list of codes out, one per winner without one, in the order
 * they were picked (assign_rovv_ticket_codes, 0074). Real winners, or test
 * ones, never both. Returns who got which code.
 */
export async function assignRovvTicketCodes(
  admin: AdminIdentity,
  codes: string[],
  test: boolean,
): Promise<{ entryId: string; handle: string; code: string }[]> {
  const result = await getDb().execute(sql`
    SELECT * FROM assign_rovv_ticket_codes(
      ${ROVV_SLUG}, ${textArray(codes)}, ${test}::boolean, ${admin.adminId}::uuid
    )
  `);
  return ((result.rows ?? []) as Record<string, unknown>[]).map((r) => ({
    entryId: String(r.entry_id),
    handle: String(r.handle),
    code: String(r.code),
  }));
}

/** Which of these codes a winner already holds, to name them when refusing. */
export async function heldRovvTicketCodes(admin: AdminIdentity, codes: string[]): Promise<string[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT e.ticket_code FROM rovv_entries e
      JOIN campaigns c ON c.id = e.campaign_id
     WHERE c.slug = ${ROVV_SLUG}
       AND upper(e.ticket_code) IN (SELECT upper(x) FROM unnest(${textArray(codes)}) AS x)
  `);
  return ((result.rows ?? []) as { ticket_code?: string }[]).map((r) => String(r.ticket_code));
}

/** Delete every test entry. Returns how many went. */
export async function clearRovvTestEntries(admin: AdminIdentity): Promise<number> {
  const result = await getDb().execute(sql`
    SELECT * FROM clear_rovv_test_entries(${ROVV_SLUG}, ${admin.adminId}::uuid)
  `);
  return Number((result.rows?.[0] as { deleted?: number } | undefined)?.deleted ?? 0);
}

/**
 * One test winner, for the owner's "send me the winner email" button: a
 * test entry, picked, with a code, not yet emailed. Null otherwise.
 */
export async function rovvTestWinner(
  admin: AdminIdentity,
  entryId: string,
): Promise<RovvWinnerToNotify | null> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT id, full_name, email, tiktok_url, tiktok_handle, ticket_code
      FROM rovv_entries
     WHERE id = ${entryId}::uuid AND is_test
       AND winner_at IS NOT NULL AND notified_at IS NULL AND ticket_code IS NOT NULL
  `);
  const r = result.rows?.[0] as Record<string, unknown> | undefined;
  return r ? toWinner(r) : null;
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
      "ticket_code",
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
      row.ticketCode ?? "",
      row.notifiedAt ? lagosStamp(row.notifiedAt) : "",
    ]),
  ]);
}

/** The code an entry holds now, read before an unpick clears it. */
export async function rovvTicketCodeOf(admin: AdminIdentity, entryId: string): Promise<string | null> {
  void admin;

  const result = await getDb().execute(sql`SELECT ticket_code FROM rovv_entries WHERE id = ${entryId}::uuid`);
  const r = result.rows?.[0] as { ticket_code?: string | null } | undefined;
  return r?.ticket_code ?? null;
}

/**
 * Correct an entrant's TikTok username or email address, for an owner, when
 * the entrant writes in. Not once they have been emailed as a winner: the
 * email and the page have already named them. The per-email rule still
 * holds, and is the database's to enforce.
 */
export async function correctRovvEntrant(
  admin: AdminIdentity,
  entryId: string,
  change: { tiktokHandle?: string; email?: string; emailCanonical?: string },
): Promise<"ok" | "notified" | "missing" | "handle_won"> {
  const before = await getDb().execute(sql`
    SELECT campaign_id, tiktok_handle, email, notified_at, is_test,
           (notice_claimed_at > now() - ${CLAIM_HOLDS}) AS being_told
      FROM rovv_entries WHERE id = ${entryId}::uuid
  `);
  const row = before.rows?.[0] as
    | { campaign_id?: string; tiktok_handle?: string; email?: string; notified_at?: unknown; is_test?: boolean; being_told?: boolean }
    | undefined;
  if (!row) return "missing";
  // Being emailed right now counts as told: the code is leaving for the old address.
  if (row.notified_at || row.being_told) return "notified";
  /* A new username that already won, on another entry, would make one
     person a winner twice. */
  if (change.tiktokHandle && change.tiktokHandle !== row.tiktok_handle) {
    const won = await getDb().execute(sql`
      SELECT 1 FROM rovv_entries
       WHERE campaign_id = ${row.campaign_id}::uuid AND tiktok_handle = ${change.tiktokHandle}
         AND is_test = ${Boolean(row.is_test)} AND id <> ${entryId}::uuid AND winner_at IS NOT NULL
       LIMIT 1
    `);
    if ((won.rows?.length ?? 0) > 0) return "handle_won";
  }

  /* A corrected address forgets which ruling was emailed: it went to the
     wrong inbox, so ruling the entry the same way again sends it to the
     right one. */
  await getDb().execute(sql`
    UPDATE rovv_entries SET
      tiktok_handle   = COALESCE(${change.tiktokHandle ?? null}::text, tiktok_handle),
      email           = COALESCE(${change.email ?? null}::text, email),
      email_canonical = COALESCE(${change.emailCanonical ?? null}::text, email_canonical),
      ruling_emailed  = CASE WHEN ${change.email ?? null}::text IS NULL THEN ruling_emailed END,
      updated_at      = now()
     WHERE id = ${entryId}::uuid
  `);
  // Who changed what, but not the old or new address: the trail is for the team, not a copy of the list.
  await getDb()
    .execute(sql`
      INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (${row.campaign_id}::uuid, ${admin.adminId}::uuid, 'rovv_entry.corrected', 'rovv_entry', ${entryId}::uuid,
              ${JSON.stringify({ handle: Boolean(change.tiktokHandle), email: Boolean(change.email) })}::jsonb)
    `)
    .catch(() => undefined);
  return "ok";
}

/**
 * The winners waiting for a code, in the order a pasted list would reach
 * them (assign_rovv_ticket_codes' own order and filter), so the console can
 * show who gets which code before anything is saved.
 */
export async function rovvCodeQueue(admin: AdminIdentity, test: boolean): Promise<string[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT e.tiktok_handle
      FROM rovv_entries e JOIN campaigns c ON c.id = e.campaign_id
     WHERE c.slug = ${ROVV_SLUG}
       AND e.is_test = ${test}
       AND e.winner_at IS NOT NULL
       AND e.notified_at IS NULL
       AND e.ticket_code IS NULL
       AND (e.notice_claimed_at IS NULL OR e.notice_claimed_at <= now() - ${CLAIM_HOLDS})
     ORDER BY e.winner_at, e.id
  `);
  return ((result.rows ?? []) as { tiktok_handle?: string }[]).map((r) => String(r.tiktok_handle));
}

/**
 * The results email's recipients (0075): every real entry that did not win
 * and was not ruled out (they were told why already), not yet sent it, up to
 * a press's worth.
 */
export async function rovvResultsRecipients(
  admin: AdminIdentity,
  limit: number,
): Promise<{ id: string; fullName: string; email: string }[]> {
  void admin;

  const result = await getDb().execute(sql`
    SELECT e.id, e.full_name, e.email
      FROM rovv_entries e JOIN campaigns c ON c.id = e.campaign_id
     WHERE c.slug = ${ROVV_SLUG} AND NOT e.is_test
       AND e.winner_at IS NULL AND e.status <> 'ineligible'
       AND e.results_emailed_at IS NULL
       AND (e.results_claimed_at IS NULL OR e.results_claimed_at <= now() - ${CLAIM_HOLDS})
     ORDER BY e.created_at, e.id
     LIMIT ${limit}
  `);
  return ((result.rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    fullName: String(r.full_name),
    email: String(r.email),
  }));
}

/**
 * Claim one results email just before sending it (0075): true only for the
 * press that got it. A claim, not a record: results_emailed_at is set only
 * once the mail has left, and a claim left by a press that died lapses after
 * CLAIM_HOLDS, so nobody is stranded as "sent".
 */
export async function claimRovvResults(admin: AdminIdentity, entryId: string): Promise<boolean> {
  void admin;

  const result = await getDb().execute(sql`
    UPDATE rovv_entries SET results_claimed_at = now()
     WHERE id = ${entryId}::uuid AND results_emailed_at IS NULL AND winner_at IS NULL
       AND (results_claimed_at IS NULL OR results_claimed_at <= now() - ${CLAIM_HOLDS})
    RETURNING id
  `);
  return (result.rows?.length ?? 0) > 0;
}

/** Record that a results email left. */
export async function markRovvResultsSent(admin: AdminIdentity, entryId: string): Promise<void> {
  void admin;

  await getDb().execute(sql`
    UPDATE rovv_entries SET results_emailed_at = now(), results_claimed_at = NULL WHERE id = ${entryId}::uuid
  `);
}

/** Give a claim back when the mail did not leave, so the next press retries. */
export async function releaseRovvResults(admin: AdminIdentity, entryId: string): Promise<void> {
  void admin;

  await getDb().execute(sql`UPDATE rovv_entries SET results_claimed_at = NULL WHERE id = ${entryId}::uuid`);
}

/** Every ticket code a winner holds, for the paste preview (owners only, like the codes). */
export async function rovvHeldCodes(admin: AdminIdentity): Promise<string[]> {
  if (!isOwner(admin)) return [];
  const result = await getDb().execute(sql`
    SELECT e.ticket_code FROM rovv_entries e JOIN campaigns c ON c.id = e.campaign_id
     WHERE c.slug = ${ROVV_SLUG} AND e.ticket_code IS NOT NULL
  `);
  return ((result.rows ?? []) as { ticket_code?: string }[]).map((r) => String(r.ticket_code));
}
