/**
 * The privacy notice for Monica: The Money Story.
 *
 * Written because the registration form collects a name, an email address, a
 * phone number, up to three social handles, a Monica tag, an audience size
 * and a location, and the endpoint additionally records the client IP address
 * and user agent, which the form never mentions at all. Nothing on the site
 * told anybody any of that, what it was for, or who holds it.
 *
 * Section 27 of the Nigeria Data Protection Act requires that information at
 * the point of collection, not afterwards on request. It is also simply the
 * decent thing here: this site has already leaked a file of attendee records,
 * and asking a new set of people for their phone numbers without saying what
 * happens to them is not a position worth defending.
 *
 * Two lawful bases, kept apart deliberately. Running the campaign is a
 * contract: somebody enters, and their details are needed to judge entries,
 * rank a leaderboard and pay a prize. Hearing about future campaigns is not
 * part of that and cannot ride on it, so it is separate, optional, unticked,
 * and refusing it changes nothing about the entry.
 *
 * The retention wording is deliberate. "Kept indefinitely" is not defensible
 * under the NDPA, which expects a period tied to a purpose. Keeping campaign
 * records for a defined period after the campaign, and marketing details only
 * while somebody still wants them, reaches the same practical place and is
 * defensible, because the thing that makes open-ended retention lawful is the
 * standing ability to end it.
 *
 * Voters are covered here too, since 1.1. The Community Favourite vote takes
 * an email address from people who never registered as creators and were never
 * shown the registration form, so the only notice they can rely on is this
 * one, and a notice that described creators alone would read as a complete
 * account while omitting them.
 */

export const MONICA_PRIVACY_VERSION = "1.1";

/** ISO date. Rendered in the event's own timezone. */
export const MONICA_PRIVACY_UPDATED = "2026-09-14";

/** Where a request about personal data goes. */
export const PRIVACY_CONTACT = "partnership@blockfestafrica.com";

export interface PrivacySection {
  /** Anchor, so a specific answer can be linked to in a request or complaint. */
  id: string;
  title: string;
  paragraphs: string[];
}

/**
 * Exactly what is collected, in the order the form asks for it, with the two
 * items the form never shows listed as plainly as the rest. A notice that
 * quietly omits the IP address is worse than no notice, because it reads as a
 * complete list.
 */
export interface CollectedItem {
  what: string;
  why: string;
  /** True where the person never typed it and would not otherwise know. */
  automatic?: boolean;
}

export const monicaPrivacyCollected: CollectedItem[] = [
  {
    what: "How pages are used, and a visit counter",
    why: "A privacy-friendly measurement script counts page views so we know which parts of the campaign people actually reach. It runs on public pages only: never on your own page, the entry links, the registration result or the console, because those carry your details or your sign-in link. It stores a random identifier in your browser to tell a returning visit from a new one, and no advertising network receives it.",
    automatic: true,
  },
  {
    what: "Cookies this site sets",
    why: "A sign-in cookie that keeps you on your own page after you open your personal link, a short-lived cookie while you confirm that link, and a referral cookie if you arrived through somebody's code. They are read by this site only, and nothing here is sold or shared for advertising.",
    automatic: true,
  },
  {
    what: "Your name",
    why: "To identify your entries, announce winners, and pay a prize to the right person.",
  },
  {
    what: "Your email address",
    why: "To tell you about challenges, the outcome of a review, and anything that affects your entry.",
  },
  {
    what: "Your phone number",
    why: "To reach you about a prize payment, which is the point where email alone is not enough.",
  },
  {
    what: "Your social handles on X, Instagram and TikTok",
    why: "To confirm a submitted post is yours, since an entry is judged only if it came from an account you registered.",
  },
  {
    what: "Your Monica tag",
    why: "Your username on Monica. It is how prize money reaches you if you win, so it is the one detail we use to identify a winner for payment.",
  },
  {
    what: "Your audience size and where you are, if you give them",
    why: "Optional. Used only in aggregate, to understand the shape of the campaign.",
  },
  {
    what: "Your IP address",
    why: "Recorded automatically when you register, to stop automated signups and abuse of the form.",
    automatic: true,
  },
  {
    what: "Your browser's user agent",
    why: "Recorded automatically for the same reason, and to diagnose a failed registration.",
    automatic: true,
  },
  {
    what: "Which version of the rules you accepted, and when",
    why: "Recorded so it is always answerable which wording you agreed to, since the rules can be amended during the campaign.",
    automatic: true,
  },
];

export const monicaPrivacySections: PrivacySection[] = [
  {
    id: "who",
    title: "Who holds this",
    paragraphs: [
      "Blockfest Africa, operated by Tevah Synergy, is the data controller for this campaign. That means Tevah Synergy decides what is collected and what happens to it, and is the entity answerable for it.",
      `Anything about your personal data goes to ${PRIVACY_CONTACT}, including the requests set out below.`,
    ],
  },
  {
    id: "basis",
    title: "Why we are allowed to hold it",
    paragraphs: [
      "For running the campaign, the basis is the agreement between us. You enter, and we cannot judge an entry, rank a leaderboard or pay a prize without knowing who you are and how to reach you. If you do not want to provide these details, the consequence is simply that you cannot enter.",
      "For hearing about future campaigns, the basis is your consent, given separately at registration. It is optional, it is not ticked by default, and refusing it has no effect at all on your entry, your score or your chance of a prize.",
      "For the IP address and user agent, the basis is our legitimate interest in keeping the form from being abused by automated signups. They are not used to profile you and are not used for marketing.",
    ],
  },
  {
    id: "sharing",
    title: "Who else sees it",
    paragraphs: [
      "Monica is the headline sponsor of this campaign and does not receive your personal details. Monica sees published entries, which are public posts on your own accounts, and aggregate results. Your name, email address, phone number and location are not passed to Monica.",
      "Your details are not sold, and are not shared with anyone else for their own marketing.",
      "They are held on services we use to run the site and the campaign, including our hosting and database provider and the service that sends our email. Those providers process the data on our instructions and for no purpose of their own.",
      "We may disclose information where the law requires it, or where it is necessary to establish or defend a legal claim, such as a dispute over a prize.",
    ],
  },
  {
    id: "public",
    title: "What becomes public",
    paragraphs: [
      "Your social handles and your entries are already public, because the campaign runs on your own accounts. Submitting a link does not make anything public that was not already.",
      "If you appear on a leaderboard or win, we will show the name and handle you registered with. We will not publish your email address, phone number or location.",
    ],
  },
  {
    id: "voting",
    title: "If you vote for Community Favourite",
    paragraphs: [
      "Anyone can vote for Community Favourite, not only registered creators, so this section is for voters. Casting a vote collects your email address, which we use to send you a verification code and to enforce one vote per email address per round. A vote counts only once its address is verified.",
      "Alongside the vote we record a hashed form of your IP address and your browser's user agent. These are signals a person reviews when a round's votes look manipulated. They are never used as automatic gates, and no vote is rejected by a machine on the strength of them.",
      "The verification code itself is stored only as a hash, so we cannot read it back, and it is cleared as soon as it is used.",
      "Vote records are kept for the campaign's dispute window, so a contested result can be checked against the votes that produced it. A vote removed in review keeps its record, with the reason for the removal, for the same purpose.",
    ],
  },
  {
    id: "keeping",
    title: "How long it is kept",
    paragraphs: [
      "Campaign records, meaning your registration, entries, scores and any prize paid, are kept for 24 months after the campaign ends on 17 October 2026. That covers a dispute raised late, and the tax and accounting record of a payment. After that they are deleted or anonymised.",
      "If you opted in to hearing about future campaigns, your name and email address are kept for that purpose until you tell us to stop. Every message we send for that reason includes a way to stop it, and you can ask at any time in one line to the address above. We act on it and do not ask why.",
      "IP addresses and user agents collected for abuse prevention are kept for 12 months and then deleted.",
    ],
  },
  {
    id: "rights",
    title: "What you can ask for",
    paragraphs: [
      "Under the Nigeria Data Protection Act you can ask us for a copy of what we hold about you, ask us to correct anything wrong, ask us to delete it, object to a particular use, or withdraw a consent you gave.",
      "Withdrawing marketing consent is immediate and costs you nothing. Asking for deletion during the campaign will usually mean withdrawing from it, because we cannot judge entries from somebody whose registration no longer exists, and we will say so before acting rather than deleting anything by surprise.",
      `Write to ${PRIVACY_CONTACT} and we will respond within 30 days. If you are not satisfied with how we handled it, you can complain to the Nigeria Data Protection Commission.`,
    ],
  },
  {
    id: "security",
    title: "How it is protected",
    paragraphs: [
      "Data is held in an access-controlled database, reached only over encrypted connections, and only people working on the campaign can see it.",
      "We ask for as little as we can. That is why the form has only two optional fields, and why we do not ask for a date of birth, an address or a bank detail at registration. Payment details are collected only from winners, at the point a prize is actually being paid.",
    ],
  },
];
