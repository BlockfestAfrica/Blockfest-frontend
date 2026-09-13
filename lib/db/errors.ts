import "server-only";

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

/** Best-effort text, for logging and for the PGlite fallback. */
export function pgErrorMessage(error: unknown): string {
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
