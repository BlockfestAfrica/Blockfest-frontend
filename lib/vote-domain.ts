import "server-only";
import { Resolver } from "node:dns/promises";
import { sql } from "drizzle-orm";
import { getDomain } from "tldts";
import { isNeverBlock } from "@/lib/campaign-vote";
import { DISPOSABLE_DOMAINS } from "@/lib/data/disposable-domains";
import { getDb } from "@/lib/db/client";
import { logWarning } from "@/lib/log";
import { isProtectedDomain } from "@/lib/vote-domain-copy";

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

/*
 * What a voting domain's mail host is, for the engine's automatic rules
 * (0069).
 *
 * The farm in the incident was one domain whose mail went to Cloudflare Email
 * Routing: a catch-all forwarder, so every address at it landed in one inbox
 * and every vote cost nothing. Nothing about the addresses gave that away as
 * reliably as the MX record did, and SQL cannot ask DNS, so Node asks, once
 * per domain, and caches the answer in vote_domain_mx for verify_vote to
 * read. The rules themselves stay in the engine: this only supplies a fact,
 * and an answer that is wrong or missing leaves the engine where the cap
 * already had it.
 */

/**
 * forwarder: a catch-all forwarding service, or mail hosted by a temp-mail
 *   service. Its votes are held from the first, and three block the domain.
 * major: Google, Microsoft, Yahoo, Apple or Proton hosting. Real schools,
 *   companies and churches live here, so no automatic rule acts on it; the
 *   cap still does.
 * other: any other host, a self-hosted server, or no mail host at all. Only
 *   the machine-made-address rule acts on it.
 * unknown: the lookup failed. Acts on nothing, and is asked again soon.
 */
export type MxKind = "forwarder" | "major" | "other" | "unknown";

export interface MxRecord {
  exchange: string;
  priority: number;
}

/** A way to ask for a domain's MX records. Injected, so tests never touch the network. */
export type ResolveMx = (domain: string) => Promise<MxRecord[]>;

export interface MxClass {
  kind: MxKind;
  /** The host mail actually goes to, or null when there is none or the lookup failed. */
  primaryMx: string | null;
}

/**
 * Forwarding services, matched exactly. Cloudflare only as its routing hosts
 * (route1.mx.cloudflare.net and its numbered siblings), never
 * *.mx.cloudflare.net or the nameservers: many universities and companies
 * use Cloudflare for DNS and have ordinary mailboxes behind it.
 */
const FORWARDER_MX: readonly RegExp[] = [
  /^route\d+\.mx\.cloudflare\.net$/,
  /^mx\d*\.improvmx\.com$/,
  /^mx\d*\.forwardemail\.net$/,
  /^eforward\d*\.registrar-servers\.com$/,
  /^fwd\d*\.porkbun\.com$/,
  /^mx\d*\.simplelogin\.co$/,
  /^mx\d*\.addy\.io$/,
];

/**
 * The big mailbox providers, where one address is one account somebody made.
 *
 * Microsoft under the whole of protection.outlook.com: its business tenants
 * deliver to *.mail.protection.outlook.com, and its consumer domains
 * (hotmail.fr, outlook.fr, live.ca and the other regional ones, which are
 * not on the never-block list) to eur.olc. and nam.olc.protection.outlook.com.
 * Matching only the first left those consumer domains "other", which is
 * exactly what the machine-made rule acts on.
 */
const MAJOR_MX: readonly RegExp[] = [
  /^aspmx\.l\.google\.com$/,
  /^alt\d\.aspmx\.l\.google\.com$/,
  /^aspmx\d\.googlemail\.com$/,
  /^smtp\.google\.com$/,
  /\.protection\.outlook\.com$/,
  /\.yahoodns\.net$/,
  /^mx0\d\.mail\.icloud\.com$/,
  /^mail(sec)?\.protonmail\.ch$/,
];

/**
 * The host mail goes to: the lowest preference, lowercased, without the
 * trailing dot. Only that one is judged. A backup MX is often a third-party
 * relay (a federal university lists one at priority 20), and judging every
 * MX would call that university a forwarding service.
 */
export function primaryMx(records: readonly MxRecord[]): string | null {
  const sorted = [...records].sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.exchange < b.exchange ? -1 : a.exchange > b.exchange ? 1 : 0),
  );
  const host = (sorted[0]?.exchange ?? "").trim().toLowerCase().replace(/\.$/, "");
  return host || null;
}

/**
 * The kind of a mail host. A host that sits under a disposable or relay
 * domain is a forwarder too: temp-mail services host many receiving domains
 * behind one mail server of their own (a quarter of the disposable domains
 * sampled with an MX pointed at one), so a fresh domain the public list has
 * not caught yet still gives itself away by where its mail goes. No host
 * at all (a domain that takes no mail, or does not exist) is "other".
 */
export function mxKind(primary: string | null): Exclude<MxKind, "unknown"> {
  if (!primary) return "other";
  if (FORWARDER_MX.some((pattern) => pattern.test(primary))) return "forwarder";
  if (isRefusedHost(primary)) return "forwarder";
  if (MAJOR_MX.some((pattern) => pattern.test(primary))) return "major";
  return "other";
}

/**
 * Whether a key is worth a lookup at all. Only registrable domains the block
 * table could hold, and never a consumer provider (one inbox, one person) or
 * a school or government domain (no automatic rule acts on those, so their
 * mail host would decide nothing and the lookup would be a slow question
 * asked of every student who votes).
 */
function classifiable(domain: string): boolean {
  return (
    /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) &&
    registrableDomain(domain) === domain &&
    !isNeverBlock(domain) &&
    !isProtectedDomain(domain)
  );
}

/** How long to wait for a lookup before calling the answer unknown. */
export const MX_DEADLINE_MS = 1500;

/**
 * The real lookup: the system's recursive resolver, a one second timeout and
 * two tries, and a hard deadline over both, after which the query is
 * cancelled. .ng nameservers have been measured at three seconds, and a slow
 * answer must never hold up the code mail for long.
 */
export const systemResolveMx: ResolveMx = async (domain) => {
  const resolver = new Resolver({ timeout: 1000, tries: 2 });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      resolver.cancel();
      reject(Object.assign(new Error("mx lookup deadline"), { code: "ETIMEOUT" }));
    }, MX_DEADLINE_MS);
  });
  try {
    return await Promise.race([resolver.resolveMx(domain), deadline]);
  } finally {
    clearTimeout(timer);
  }
};

async function lookUp(domain: string, resolveMx: ResolveMx): Promise<MxClass> {
  try {
    const primary = primaryMx(await resolveMx(domain));
    return { kind: mxKind(primary), primaryMx: primary };
  } catch (error) {
    /*
     * No MX record and no such domain are answers: the domain takes no mail
     * of its own, which is "other". Anything else (a timeout, SERVFAIL, a
     * refusal, a cancelled query) is not an answer, and unknown acts on
     * nothing: a slow nameserver must never be what holds a real vote.
     */
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "ENODATA" || code === "ENOTFOUND") return { kind: "other", primaryMx: null };
    return { kind: "unknown", primaryMx: null };
  }
}

/**
 * Classify a voting domain's mail host, from the cache when it is fresh and
 * from DNS when it is not, and store the answer for verify_vote.
 *
 * Called by the cast route inside after(), before the code is mailed, so the
 * row exists before any code can come back to verify and the cast's answer
 * and timing never depend on DNS. Fresh means a day old at most, or five
 * minutes for unknown, so a lookup that failed is soon tried again.
 *
 * Answers null, and asks nothing, for a key that is not worth a lookup (see
 * classifiable). Never throws, and never logs the domain: whatever went
 * wrong is logged by its error name, and the vote is left to the cap.
 */
export async function classifyVoteDomain(
  key: string,
  { resolveMx }: { resolveMx: ResolveMx },
): Promise<MxClass | null> {
  const domain = key.trim().toLowerCase().replace(/\.$/, "");
  if (!classifiable(domain)) return null;
  try {
    const db = getDb();
    const cached = await db.execute(sql`
      SELECT kind, primary_mx
        FROM vote_domain_mx
       WHERE domain = ${domain}
         AND checked_at > now() - CASE WHEN kind = 'unknown'
                                       THEN interval '5 minutes'
                                       ELSE interval '24 hours' END
    `);
    const hit = cached.rows?.[0] as { kind?: MxKind; primary_mx?: string | null } | undefined;
    if (hit?.kind) return { kind: hit.kind, primaryMx: hit.primary_mx ?? null };

    const found = await lookUp(domain, resolveMx);
    await db.execute(sql`
      INSERT INTO vote_domain_mx (domain, kind, primary_mx, checked_at)
      VALUES (${domain}, ${found.kind}, ${found.primaryMx}, now())
      ON CONFLICT (domain) DO UPDATE
        SET kind = EXCLUDED.kind,
            primary_mx = EXCLUDED.primary_mx,
            checked_at = EXCLUDED.checked_at
    `);
    return found;
  } catch (error) {
    logWarning(
      "campaign/vote",
      `mail host lookup failed, leaving the domain to the cap: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return null;
  }
}
