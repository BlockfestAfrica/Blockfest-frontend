import "server-only";
import { pgErrorCode, pgErrorMessage } from "@/lib/db/errors";

/**
 * Logging that cannot be handed personal data by accident.
 *
 * Function logs are not a private place. They are read in a dashboard, they are
 * retained by the platform, and they outlive the request by a long way. This
 * campaign holds a name, an email address and a phone number for every
 * registrant under the Nigeria Data Protection Act, and it has already had one
 * incident involving registrant data, so the cost of a leak here is not
 * hypothetical.
 *
 * The audit that prompted this said the register route logged the whole SQL
 * statement and every bound parameter. This comment used to say it did not,
 * because only error.message was logged and never .query or .params. That was
 * wrong. Drizzle rethrows every failed query as a DrizzleQueryError whose
 * message is "Failed query: <sql>\nparams: <every value>", so error.message
 * was the parameters: an unexpected failure on a Rovv entry printed the
 * entrant's name, TikTok username, referral code and user agent, none of
 * which any pattern below can recognise. pgErrorMessage now reads the driver
 * error that Drizzle wraps instead (lib/db/errors.ts), and a test passes a
 * real DrizzleQueryError through logError to keep it that way.
 *
 * The narrower version is real too. A Postgres message embeds the offending
 * value in several common cases, for instance
 * `invalid input syntax for type uuid: "..."`, and this codebase's own
 * award_points raises `would_go_negative: holds %`. And the mail client's
 * redact() stripped the API key but not the recipient, so a ZeptoMail 4xx body,
 * which echoes the address, went to the log intact on every send failure.
 *
 * Fixing those two call sites would have left the next one to be written
 * exposed. This makes redaction the default path instead, so a caller has to
 * work to leak rather than work to be safe.
 */

/** Patterns that are personal data, or a credential, wherever they appear. */
const SENSITIVE: Array<[RegExp, string]> = [
  // Email. Before the phone rule, because an address can contain digits.
  [/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],
  /*
   * The access token shape, exactly as minted: 32 bytes base64url. Lookarounds
   * rather than \b, because '-' is not a word character, so \b silently fails
   * to match any token that begins or ends with one. Base64url index 62 is
   * '-', which makes that roughly one token in every thirty, found by the
   * adversarial review rather than by a leak.
   */
  [/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g, "[token]"],
  // The mail provider's key, which the old redact() in the email client caught.
  [/Zoho-enczapikey\s+\S+/gi, "Zoho-enczapikey [redacted]"],
  // Anything that looks like a bearer credential in a header or URL.
  [/(authorization|bearer|api[_-]?key)[=:\s]+\S+/gi, "$1 [redacted]"],
  // An IPv4 address. A throttle bucket is name:<client-ip>, and a client IP is
  // personal data under the NDPA. Before the phone rule, so the dotted quad is
  // consumed as an address rather than four short numbers.
  [/(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])/g, "[ip]"],
  /*
   * An IPv6 address, full or with a "::" gap. The client IP is whatever the
   * visitor's network connected with, and on a network that uses IPv6 a
   * throttle bucket is as easily enter:2c0f:f5c0::1 as a dotted quad.
   * A ':' may come before it, for that bucket's sake, but never a letter or
   * digit, so it starts at the first group. After the IPv4 rule, so an
   * IPv4-mapped address is already [ip] by now and nothing of it is left
   * half matched. A time like 09:00:00 has neither eight groups nor a "::",
   * and a cast like $1::uuid ends in letters that are not hex, so both stay.
   * It may be followed by a colon (a log line's own "address: message"), as
   * long as that colon does not start another hex group.
   */
  [
    /(?<!\w)(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6}::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?|::[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})(?!\w|:[0-9a-f])/gi,
    "[ip]",
  ],
  /*
   * A phone number. Last, and deliberately narrow: 10 to 15 digits with an
   * optional plus, not bounded by other digits. A UUID survives this because
   * its groups are shorter and hex, and those are worth keeping since they are
   * how a row is found again.
   */
  [/(?<!\d)\+?\d{10,15}(?!\d)/g, "[phone]"],
];

/** Strip anything personal from a string bound for a log. */
export function redactPii(text: string): string {
  return SENSITIVE.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text,
  );
}

/**
 * Report a failure without reporting who it happened to.
 *
 * The SQLSTATE is the useful part and carries nothing personal: it is assigned
 * by us, it does not change with wording, and it is what the route matched on
 * to decide the response. The message is kept too, redacted, because a
 * constraint name in it is often the only thing that says which rule fired.
 */
export function logError(context: string, error: unknown): void {
  const code = pgErrorCode(error) ?? "none";
  console.error(`[${context}] ${code}: ${redactPii(pgErrorMessage(error))}`);
}

/** The same, for something that is worth knowing about but not a failure. */
export function logWarning(context: string, detail: string): void {
  console.warn(`[${context}] ${redactPii(detail)}`);
}
