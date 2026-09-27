import "server-only";
import { getDomain } from "tldts";
import { DISPOSABLE_DOMAINS } from "@/lib/data/disposable-domains";

/**
 * Which domain a vote belongs to, for every rule that is judged per domain.
 *
 * The domain cap, the fraud count that keeps a swept farm capped (0068),
 * "Remove all as fraud" and the console's domain clusters all used to key on
 * the full host after the @. A catch-all farm with a wildcard MX, or
 * subdomain routing on the same Cloudflare zone, could then give every
 * subdomain a fresh allowance of ten for nothing: after eleven oemails.com
 * votes were removed as fraud, ten each from a., b. and c.oemails.com all
 * still counted. So every one of those rules now keys on the registrable
 * domain, the part a person has to buy.
 *
 * Private suffixes are deliberately NOT honoured (allowPrivateDomains is
 * false). Under the private section of the public suffix list, free dynamic
 * DNS services such as dynv6.net count as suffixes, so x.0-mailer.dynv6.net
 * would key on 0-mailer.dynv6.net and every new free name would be a new
 * allowance. Folding them into dynv6.net closes that lane; the cost is that
 * unrelated people on one free DNS service share an allowance, which holds
 * their extra votes for review and refuses nobody.
 *
 * Campus subdomains fold the same way: live.unilag.edu.ng keys on
 * unilag.edu.ng. A big campus rally therefore meets the cap sooner, and the
 * votes past it are held for a person, never refused.
 */

/**
 * The registrable domain of a host, or null when there is none: a bare
 * public suffix (edu.ng, com.ng), an IP address, or a single label.
 *
 * Null is an answer in its own right. A rule that acts on "this domain and
 * everything under it" must never be handed edu.ng, because that would be
 * every Nigerian university at once.
 */
export function registrableDomain(host: string): string | null {
  return getDomain(host.trim().toLowerCase(), { allowPrivateDomains: false });
}

/**
 * The key one vote is judged under: the registrable domain of the address's
 * host, or the host itself when it has none.
 *
 * Takes a canonical email or a bare host, because the verify route holds the
 * one and the console's cluster query the other, and two helpers that had to
 * agree would be one more place for them not to. The engine re-checks the key
 * it is given (it must be the host or a parent of it), so a wrong answer here
 * falls back to the old per-host rule rather than to somebody else's domain.
 */
export function voteDomainKey(emailOrHost: string): string {
  const host = emailOrHost
    .slice(emailOrHost.lastIndexOf("@") + 1)
    .trim()
    .toLowerCase();
  return registrableDomain(host) ?? host;
}

/**
 * The one answer a cast gets when its domain is refused.
 *
 * Its own sentence, not the schema's "does not look right": the ballot's
 * email field has already accepted the address as well formed, so telling a
 * real person it looks wrong leaves them retyping a correct address until
 * they give up, and a script already knows its addresses are well formed, so
 * the other wording hid nothing from it. This one tells a real voter what
 * will work. It never says blocked, fraud or review, and it is the same
 * bytes for a blocked domain, a disposable one and an alias relay, so the
 * answer says which domains are refused but never why.
 */
export const UNUSABLE_EMAIL =
  "We can't send a code to that address. Please use a personal email such as Gmail, Yahoo, Outlook or iCloud.";

/**
 * What a cast from a blocked domain hears: refused with UNUSABLE_EMAIL (the
 * owner's ask), or "hold", which lets the cast through, mails the code and
 * leaves verify_vote to hold the vote quietly.
 *
 * The trade, for whoever flips this: refusing tells a farm at its next
 * attempt that the domain is burned, and it moves on; holding hides even
 * that, but a real voter on a wrongly blocked domain then believes their vote
 * counted. The engine holds the vote either way, so this changes only what is
 * said, never what counts.
 */
export const BLOCKED_DOMAIN_ANSWER: "refuse" | "hold" = "refuse";

/**
 * Alias relays: one person, unlimited addresses, each forwarding to the same
 * inbox. None of them is on the public disposable list (they are not
 * throwaway, they are permanent), and every one of them makes "one inbox, one
 * vote" purchasable for nothing. Kept by hand; a line removed here is the
 * undo.
 */
export const RELAY_DOMAINS: readonly string[] = [
  "duck.com",
  "mozmail.com",
  "simplelogin.com",
  "simplelogin.co",
  "aleeas.com",
  "slmail.me",
  "passmail.net",
  "passinbox.com",
  "anonaddy.com",
  "anonaddy.me",
  "addy.io",
];

/**
 * Real domains the public list has wrong, to be accepted anyway. Empty, and
 * the one-line undo when a voter reports being turned away: add the listed
 * entry here and deploy. It is applied to the bundled list, so the next
 * refresh of that list cannot bring the mistake back.
 */
export const DISPOSABLE_EXCEPTIONS: readonly string[] = [];

let refused: Set<string> | null = null;

/** The bundled list plus the relays, less the exceptions, built on first use. */
function refusedDomains(): Set<string> {
  if (!refused) {
    const set = new Set(DISPOSABLE_DOMAINS.split("\n"));
    for (const domain of DISPOSABLE_EXCEPTIONS) set.delete(domain);
    for (const domain of RELAY_DOMAINS) set.add(domain);
    refused = set;
  }
  return refused;
}

/**
 * Whether a cast from this host is refused outright, because the host, or
 * any domain it sits under, is a disposable inbox service or an alias relay.
 *
 * Every parent, not only the host: nearly a thousand entries on the public
 * list are themselves subdomains (0-mailer.dynv6.net), and a farm on
 * mailinator.com is just as happy at x.mailinator.com. No entry is a public
 * suffix (the refresh script refuses one), so walking up to the last dotted
 * parent can never refuse a whole country's domains.
 */
export function isRefusedHost(host: string): boolean {
  const list = refusedDomains();
  let probe = host.trim().toLowerCase().replace(/\.$/, "");
  while (probe.includes(".")) {
    if (list.has(probe)) return true;
    probe = probe.slice(probe.indexOf(".") + 1);
  }
  return false;
}

/**
 * The domain an owner's block lands on: the registrable domain of whatever
 * was typed, so x.oemails.com blocks oemails.com and everything under it, the
 * same key the cap and "Remove all" use. Null for a public suffix (edu.ng,
 * com.ng) or an IP address: a block on those would be every domain under
 * them, and the route refuses it rather than guessing.
 *
 * An address pasted whole is read for its domain, because that is what an
 * owner copying from the vote list will paste.
 */
export function normaliseBlockDomain(input: string): string | null {
  const host = input.slice(input.lastIndexOf("@") + 1).trim().toLowerCase().replace(/\.$/, "");
  if (!host) return null;
  return registrableDomain(host);
}

export { isProtectedDomain } from "@/lib/vote-domain-copy";
