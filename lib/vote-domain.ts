import "server-only";
import { getDomain } from "tldts";

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
