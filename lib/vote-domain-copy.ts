/**
 * What the console says about blocked domains, and the one pure rule behind
 * it.
 *
 * Both halves of the console need these words: the vote panel (a client
 * component) asks before it blocks or removes a farm, and the Blocked domains
 * card asks before it lifts one. lib/vote-domain.ts cannot serve either, being
 * server-only for the public suffix list and the disposable list it carries,
 * so the sentences live here, where a client component may import them and a
 * unit test can pin them without rendering anything. Nothing here reads a
 * database or knows a secret.
 *
 * Voters never see any of this. The only thing a voter is ever told about a
 * domain is UNUSABLE_EMAIL, which says "use a personal email" and nothing
 * about blocks, farms or review.
 */

/**
 * School, university and government mail: .edu, .gov and .mil themselves,
 * and the country forms such as .edu.ng, .gov.ng, .ac.uk and .sch.ng.
 *
 * The same test as vote_domain_protected in 0069, and a test holds the two
 * together. No automatic rule acts on these domains; an owner still can, and
 * the block dialog says out loud who that would turn away.
 */
export function isProtectedDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  return /\.(edu|gov|mil)$/.test(d) || /\.(edu|gov|mil|ac|sch)\.[a-z]{2}$/.test(d);
}

export type HeldReason = "cap" | "blocked" | "forwarder" | null;

/**
 * Why a vote is waiting, in the held list's words.
 *
 * A vote held before 0069 has no reason recorded, and the cap was the only
 * thing that held votes then, so null reads as the cap.
 */
export function heldReasonLabel(reason: HeldReason | undefined): string {
  if (reason === "blocked") return "Domain blocked";
  if (reason === "forwarder") return "Forwarding service";
  return "Over the domain's ten";
}

/** Said when the domain is a school or government one, before any block. */
export function protectedWarning(domain: string): string {
  return `${domain} looks like a school or government domain. Real students and staff will be turned away.`;
}

/**
 * The block dialog's consequence.
 *
 * counted is how many of the domain's votes this round are counting now,
 * which the block turns into held ones. Null when the console cannot know,
 * as for a domain typed into the card before anybody has used it.
 *
 * roundReviewed is for a block started from a round a person has already
 * marked reviewed. block_vote_domain holds nothing in such a round (its
 * tally was certified), so its counted votes keep counting, and the dialog
 * says so and says what does take them out, instead of promising a hold
 * that will not happen.
 *
 * typedHost is what the owner typed when it was a subdomain: the block lands
 * on the registrable domain, which covers every subdomain of it, and the
 * dialog says that before it is confirmed rather than after.
 */
export function blockConsequence(
  domain: string,
  counted: number | null,
  isProtected = false,
  roundReviewed = false,
  typedHost?: string,
): string {
  const one = counted === 1;
  const held =
    counted === null
      ? " Any counted this round are held for you to review."
      : counted === 0
        ? ""
        : roundReviewed
          ? ` This round is already reviewed, so its ${counted} counted ${one ? "vote keeps" : "votes keep"} counting. To take ${one ? "it" : "them"} out of the tally, remove ${one ? "it" : "them"} as fraud.`
          : ` The ${counted} counted this round ${one ? "is" : "are"} held for you to review.`;
  const folded =
    typedHost && typedHost !== domain
      ? `${typedHost} belongs to ${domain}; the block covers all of ${domain}. `
      : "";
  return (
    `${folded}New votes from ${domain} and its subdomains are turned away with a neutral message, and any waiting for a code are held.${held} Voters are never told it is blocked. You can unblock it at any time.` +
    (isProtected ? ` ${protectedWarning(domain)}` : "")
  );
}

/** The Remove-all dialog's consequence, now that removing also blocks. */
export function removeAllConsequence(domain: string, isProtected = false): string {
  return (
    `They stop counting, each address is barred from this round, and ${domain} is blocked for the rest of the campaign: new votes from it are turned away with a neutral message. Removal cannot be undone; the block can.` +
    (isProtected ? ` ${protectedWarning(domain)}` : "")
  );
}

/**
 * The most votes one "Remove all" takes: one statement's worth of ids, and
 * far past any cluster the console has shown. Past it, reloading would send
 * the same ids again, so the answer says what does work: a block holds every
 * counted vote from the domain in one act.
 */
export const REMOVE_ALL_MAX_VOTES = 500;
export const REMOVE_ALL_TOO_MANY =
  "Too many to remove at once; block the domain instead, which holds them all.";

export function removeAllToast(removed: number, domain: string): string {
  return `Removed ${removed} as fraud and blocked ${domain}.`;
}

/**
 * What a block did, from the server's answer.
 *
 * already: the domain was blocked before this press, so nothing was
 * inserted, held or recorded, and "Blocked" would claim an act that did not
 * happen. counted: how many the dialog said were counting; none held while
 * some were counting means they still count (a reviewed round), and the
 * toast says so rather than leaving the owner to assume they were held.
 */
export function blockToast(
  domain: string,
  held: number,
  { counted = null, already = false }: { counted?: number | null; already?: boolean } = {},
): string {
  if (already) return `${domain} was already blocked.`;
  if (held === 0 && counted !== null && counted > 0) {
    return `Blocked ${domain}. Its ${counted} counted ${counted === 1 ? "vote" : "votes"} this round ${counted === 1 ? "keeps" : "keep"} counting.`;
  }
  return held === 0
    ? `Blocked ${domain}.`
    : `Blocked ${domain}. ${held} counted ${held === 1 ? "vote" : "votes"} held for you to review.`;
}

/**
 * The unblock dialog's consequence. held is how many votes the block (or the
 * forwarding rule) holds in rounds not yet reviewed. unblock_vote_domain
 * releases them oldest first, and only while the domain is under its
 * allowance of ten in that round (the block held them before the cap was
 * ever counted); the rest stay held as over the ten.
 */
export function unblockConsequence(domain: string, held: number): string {
  return `New votes from ${domain} are accepted again. Of the ${held} ${held === 1 ? "vote" : "votes"} the block holds, those within its allowance of ten a round are released, oldest first; the rest wait as over the domain's ten. Votes removed as fraud stay removed and count toward that ten. Automatic blocking will not act on ${domain} again.`;
}

export function unblockToast(domain: string, released: number): string {
  return `Unblocked ${domain}. ${released} held ${released === 1 ? "vote" : "votes"} released.`;
}

/**
 * What an automatic block recorded, as one sentence for the card.
 *
 * The evidence is counts and the mail host only, never an address, so it can
 * be shown to anybody who can see the card. Null when it carries neither
 * shape, which a hand-made row could.
 */
export function autoEvidenceSentence(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== "object") return null;
  const e = evidence as Record<string, unknown>;
  const verified = Number(e.verified);
  const machineMade = Number(e.machine_made);
  if (e.kind === "forwarder" && Number.isFinite(verified)) {
    const mx = typeof e.primary_mx === "string" && e.primary_mx ? e.primary_mx : "unknown host";
    return `Forwarding service (${mx}), ${verified} verified votes this round`;
  }
  if (Number.isFinite(machineMade) && Number.isFinite(verified) && verified > 0) {
    return `${machineMade} of ${verified} verified addresses look machine-made`;
  }
  return null;
}
