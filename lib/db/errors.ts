import "server-only";
import { DrizzleQueryError } from "drizzle-orm";

/**
 * Reading a Postgres error, whichever driver raised it.
 *
 * Every plpgsql function here raises with a deliberate SQLSTATE: email_taken is
 * P0101, wrong_account is P0209, and so on. The routes then matched on the
 * message text instead, which worked in every test and in none of production.
 *
 * The reason is the gap between the two drivers. The integration suite runs
 * against PGlite, which puts the raise text in error.message, so
 * message.includes("wrong_account") matched and 42 tests agreed the mapping
 * worked. Production runs on neon-http, which throws a NeonDbError whose message
 * is not that text and whose SQLSTATE is on a `code` field. So every raise fell
 * through to the unmapped branch, and a creator submitting somebody else's post,
 * or registering twice, was told "something went wrong at our end".
 *
 * The codes were always the right thing to match on. They are assigned by us,
 * they do not change with wording, and they survive both drivers. The message
 * check stays only as a fallback for PGlite, which does not set `code` for a
 * RAISE without one.
 */

/** Custom SQLSTATEs raised by the campaign's plpgsql functions. */
export const PG = {
  CAMPAIGN_NOT_FOUND: "P0002",
  EMAIL_TAKEN: "P0101",
  PHONE_TAKEN: "P0102",
  REVIEWER_REQUIRED: "P0103",
  UNKNOWN_CREATOR: "P0201",
  UNKNOWN_CHALLENGE: "P0202",
  CHALLENGE_CLOSED: "P0203",
  CHALLENGE_NOT_OPEN: "P0204",
  CHALLENGE_ENDED: "P0205",
  PLATFORM_NOT_REGISTERED: "P0206",
  ALREADY_SUBMITTED_FOR_PLATFORM: "P0207",
  URL_ALREADY_SUBMITTED: "P0208",
  WRONG_ACCOUNT: "P0209",
  /** review() refused because a newer submission superseded this one. */
  SUPERSEDED: "P0210",
  /*
   * P0211 (handle_not_verified) existed from 0022 to 0034 and was retired when
   * the team removed the verification step. The number stays reserved so a
   * future code does not reuse it and confuse an old log.
   */
  /** The enrolment was voided by an admin. */
  ENROLMENT_NOT_ACTIVE: "P0212",
  /** Another submission is already approved for this same post. */
  POST_ALREADY_CREDITED: "P0213",
  ADMIN_UNDELETABLE: "P0301",
  /** Postgres' own, for a constraint we did not raise ourselves. */
  UNIQUE_VIOLATION: "23505",
  /** award_points refused: the per-creator manual total would be exceeded. */
  MANUAL_CAP_EXCEEDED: "P0508",
  CHECK_VIOLATION: "23514",
  UNDEFINED_FUNCTION: "42883",
  /* Rovv's campaign (0073). P1xxx is Rovv's range. */
  ROVV_CLOSED: "P1001",
  ROVV_PAUSED: "P1002",
  /** This email already has an entry with another TikTok username, or one already reviewed. */
  ROVV_ENTRY_TAKEN: "P1003",
  /** Somebody else has entered this video. */
  ROVV_VIDEO_TAKEN: "P1004",
  ROVV_BAD_STATUS: "P1005",
  /** A winner is unpicked before being marked anything but eligible. */
  ROVV_WINNER_STAYS_ELIGIBLE: "P1006",
  ROVV_ENTRY_NOT_FOUND: "P1007",
  ROVV_NOT_ELIGIBLE: "P1008",
  ROVV_WINNERS_FULL: "P1009",
  /** A winner who has been emailed stays a winner. */
  ROVV_WINNER_ALREADY_TOLD: "P1010",
  /** A winner whose email is being sent right now cannot be unpicked. */
  ROVV_WINNER_BEING_TOLD: "P1011",
  /** The entrant replaced the entry after the reviewer loaded it. */
  ROVV_ENTRY_CHANGED: "P1012",
  /** A winner's ticket code cannot change once their email has gone (0074). */
  ROVV_CODE_LOCKED: "P1013",
  /** Only a winner has a ticket code. */
  ROVV_CODE_NEEDS_WINNER: "P1014",
  /** Another winner already holds that code. */
  ROVV_CODE_TAKEN: "P1015",
  /** Not the shape of a ticket code. */
  ROVV_BAD_CODE: "P1016",
  /** A pasted list of codes has the same code in it twice. */
  ROVV_CODES_REPEATED: "P1017",
  /** Another reviewer ruled on the entry since the card was loaded (0075). */
  ROVV_RULED_MEANWHILE: "P1018",
  /** Another entry under this TikTok username has already won. */
  ROVV_ALREADY_WON: "P1019",
  /** This entrant has already been sent the results email, so cannot be picked. */
  ROVV_RESULTS_SENT: "P1020",
  ADMIN_REQUIRED: "P0401",
  REASON_REQUIRED: "P0402",
} as const;

/**
 * The SQLSTATE, dug out of whatever shape the driver threw.
 *
 * neon-http puts it on `code`. Drizzle sometimes wraps the driver error, so
 * `cause` is checked too, and NeonDbError keeps the original on `sourceError`.
 * None of these is guaranteed, which is why all of them are tried rather than
 * assuming the one that happened to be true when this was written.
 */
export function pgErrorCode(error: unknown): string | null {
  const seen = new Set<unknown>();

  const dig = (value: unknown, depth: number): string | null => {
    if (!value || typeof value !== "object" || depth > 4 || seen.has(value)) {
      return null;
    }
    seen.add(value);

    const record = value as Record<string, unknown>;
    const code = record.code;
    // A SQLSTATE is five characters. Guarding on that stops an unrelated
    // `code` field, say a fetch error's "ECONNRESET", being read as one.
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;

    return (
      dig(record.cause, depth + 1) ??
      dig(record.sourceError, depth + 1) ??
      dig(record.originalError, depth + 1)
    );
  };

  return dig(error, 0);
}

/**
 * Drizzle's wrapper around a failed query, by class or, failing that, by
 * shape: a second copy of drizzle-orm in a bundle would make instanceof
 * miss, and missing it is the leak below.
 */
function isDrizzleQueryError(error: unknown): error is Error & { cause?: unknown } {
  if (error instanceof DrizzleQueryError) return true;
  return (
    error instanceof Error &&
    "query" in error &&
    "params" in error &&
    error.message.startsWith("Failed query:")
  );
}

/**
 * Best-effort text, for logging and for the PGlite fallback.
 *
 * Never Drizzle's own message. Every query that fails through Drizzle,
 * neon-http in production and PGlite in the suite alike, is rethrown as a
 * DrizzleQueryError whose message is "Failed query: <sql>\nparams: <every
 * bound value>". So one failed entry insert put the entrant's name, email,
 * TikTok username, referral code and user agent in the function log, and
 * the redactor knows the shape of only some of those. The driver's error it
 * wraps, on `cause`, is the part that says what went wrong, and it is where
 * the raise text is that the PGlite fallback in isPgError matches on.
 * pgErrorCode needs nothing from here: it already digs through `cause`.
 */
export function pgErrorMessage(error: unknown): string {
  return readMessage(error, 0);
}

function readMessage(error: unknown, depth: number): string {
  if (isDrizzleQueryError(error)) {
    const cause = error.cause;
    // Nothing underneath to read: say that much, never the query or params.
    if (cause === undefined || cause === null || cause === error || depth > 4) {
      return "query failed (no driver error)";
    }
    return readMessage(cause, depth + 1);
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Does this error mean `name`, by either route?
 *
 * `code` is the real answer and is checked first. The message check is there
 * for PGlite, where a RAISE without an explicit SQLSTATE surfaces as text and
 * no code at all, which is what the integration suite exercises.
 */
export function isPgError(
  error: unknown,
  code: string,
  raiseName?: string,
): boolean {
  if (pgErrorCode(error) === code) return true;
  if (!raiseName) return false;
  return pgErrorMessage(error).includes(raiseName);
}
