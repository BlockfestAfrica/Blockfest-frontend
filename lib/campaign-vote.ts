import "server-only";
import { createHash, randomInt } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { logWarning } from "@/lib/log";

/**
 * The shared pieces of the public Community Favourite vote.
 *
 * The rules themselves live in the database engine from migration 0046: one
 * counted vote per canonical email per round, the code bound to the cast, the
 * domain cap judged at verify time. Nothing here re-implements any of that.
 * This module holds what the two routes need in common so the cast side and
 * the verify side cannot drift apart: the same hash of the same code, the
 * same allowlist, the same cap.
 *
 * Enforcement stays in SQL. What the engine cannot do for itself lives in
 * Node and is handed to it: the public suffix list that names a vote's
 * registrable domain, the bundled disposable list the cast route refuses
 * from, and the DNS lookup that classifies a domain's mail host (cached in
 * vote_domain_mx). Those are data lookups, not rules; every hold and every
 * block, automatic ones included, is still decided by the engine under its
 * lock (0069). A Node answer that is missing leaves the engine where the cap
 * already had it.
 */

/**
 * Consumer providers where one inbox is one person, exempt from the domain
 * cap. Ten gmail.com voters in a round is an ordinary Tuesday; ten voters
 * from one corporate or catch-all domain is the bulk-inbox attack the cap
 * exists for. The engine takes the verdict as a boolean, so membership here
 * is the whole decision.
 *
 * An array rather than a Set because the admin review surface consumes it
 * as a list; the Set below is the lookup this module answers with.
 */
export const ALLOWLISTED_DOMAINS: readonly string[] = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
];

const ALLOWLIST = new Set(ALLOWLISTED_DOMAINS);

/**
 * Domains no block may ever land on, by an owner or by a machine: the nine
 * the cap exempts, plus the Yahoo, Microsoft, Apple, AOL and Proton alias
 * domains the cap does not exempt. Each is one inbox per person shared by
 * thousands of real voters, so a block would turn away a crowd to stop one
 * farmer. Their votes are still capped and still removable one at a time.
 *
 * Wider than ALLOWLISTED_DOMAINS on purpose, and the cap allowlist is not
 * widened with it: ten ymail.com votes in a round is unusual enough to hold
 * for a look, but never enough to refuse the domain. The same list is
 * vote_domain_never_block() in 0069, which the block table's CHECK uses, and
 * a test holds the two together.
 */
export const NEVER_BLOCK_DOMAINS: readonly string[] = [
  ...ALLOWLISTED_DOMAINS,
  "ymail.com",
  "rocketmail.com",
  "yahoo.co.uk",
  "hotmail.co.uk",
  "live.co.uk",
  "msn.com",
  "aol.com",
  "me.com",
  "mac.com",
  "pm.me",
];

const NEVER_BLOCK = new Set(NEVER_BLOCK_DOMAINS);

/**
 * Whether a domain, or any domain it sits under, is one no block may touch.
 * Every parent, because mail.gmail.com normalises to gmail.com for a block
 * and a check on the host alone would let a subdomain through.
 */
export function isNeverBlock(domain: string): boolean {
  let probe = domain.trim().toLowerCase().replace(/\.$/, "");
  while (probe.includes(".")) {
    if (NEVER_BLOCK.has(probe)) return true;
    probe = probe.slice(probe.indexOf(".") + 1);
  }
  return false;
}

/**
 * Counted votes one non-allowlisted domain may hold in a round before the
 * next verified vote from it is parked for a person to look at. Held is not
 * a refusal: the engine keeps the vote and a human admits or removes it.
 */
export const DOMAIN_CAP = 10;

/**
 * The one field a voter gives us. Same recipe as the registration email
 * field, because the same string has to survive the same canonicalisation.
 */
export const voteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("That email address does not look right.")
  .max(254);

/**
 * Six digits from a CSPRNG, leading zeros kept.
 *
 * randomInt over the full 0 to 999999 range, never Math.random: the code is
 * the only thing standing between an inbox and a counted vote, so it has to
 * be unguessable within its fifteen minute life, and padStart is what stops
 * a code below 100000 arriving as five digits that fail the input's pattern.
 */
export function sixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * What the database stores instead of the code.
 *
 * Bound to the canonical email as well as the code, so a code mailed to one
 * inbox can never verify a vote cast under a different address, even if both
 * were somehow issued the same six digits. The prefix keeps this hash in its
 * own namespace: no other sha256 in the codebase can collide with it by
 * hashing the same raw material.
 */
export function hashCode(emailCanonical: string, code: string): string {
  return createHash("sha256")
    .update(`vote-code:${emailCanonical}:${code}`)
    .digest("hex");
}

/**
 * The address hashed rather than stored. An IP is personal data and the vote
 * table only ever needs to answer "same place?", never "which place?". An
 * absent address hashes the empty string so throttle keys and the cast
 * payload stay well formed; Netlify sets its header itself, so absence means
 * the platform changed, not that somebody stripped it.
 */
export function hashIp(ip: string | null | undefined): string {
  return createHash("sha256").update(ip ?? "").digest("hex");
}

/**
 * Whether the address's domain is exempt from the cap.
 *
 * Expects the canonical form, which is already lowercased; the fold here is
 * defensive, so a caller handing over a raw address fails safe rather than
 * treating GMAIL.COM as a corporate domain.
 */
export function isAllowlisted(emailCanonical: string): boolean {
  const at = emailCanonical.lastIndexOf("@");
  if (at < 0) return false;
  return ALLOWLIST.has(emailCanonical.slice(at + 1).toLowerCase());
}

/**
 * The vote throttle: same token bucket as lib/throttle, opposite failure
 * mode, and the difference is deliberate.
 *
 * The registration limits fail open because they only slow enumeration, and
 * every rule that guards points or money is enforced elsewhere; turning a
 * database blip into a launch-morning outage there buys nothing. These
 * buckets gate outbound mail and code guessing. A throttle that cannot be
 * read failing open turns the same blip into an unmetered mail sender
 * pointed at any inbox an attacker types, and a spammed stranger does not
 * care that our database was briefly slow. So an unreadable bucket refuses,
 * politely, and the voter tries again in a minute.
 */
export async function allowVoteKey(
  key: string,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const result = await getDb().execute(
      sql`SELECT take_token(${`${name}:${key}`}, ${limit}, ${windowSeconds}) AS ok`,
    );
    const ok = (result.rows?.[0] as { ok?: boolean } | undefined)?.ok;
    if (ok === false) {
      // The key is not logged: it carries a canonical email, and the bucket
      // name already says which limit fired.
      logWarning("throttle", `${name} limit reached`);
    }
    return ok === true;
  } catch (error) {
    // The error NAME only, for the same reason lib/throttle gives: a wrapped
    // driver message can carry the bucket key, which here contains an email
    // address, into a log that promises not to hold one.
    logWarning(
      "throttle",
      `${name} could not be read, refusing: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return false;
  }
}
