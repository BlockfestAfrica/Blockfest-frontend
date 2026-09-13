/**
 * Campaign rules for Monica: The Money Story.
 *
 * Interim wording. The final text is with the campaign team, and this page
 * exists before it because several of these terms are unenforceable unless they
 * were published before somebody entered. You cannot tell a creator in week
 * three that bought engagement was disqualifying, or ask a winner for identity
 * documents you never mentioned, or repost their work under a licence they were
 * never offered. Publishing a clear v1 now and amending it is the only version
 * of this that works.
 *
 * The version string is captured against each registration, so it is always
 * answerable which text a given creator agreed to.
 *
 * Points still open with the campaign team are marked in the copy rather than
 * guessed at. An invented eligibility age is worse than an honest gap.
 */

export const MONICA_RULES_VERSION = "1.0";

/** ISO date. Rendered in the event's own timezone. */
export const MONICA_RULES_UPDATED = "2026-09-12";

export interface RuleSection {
  /** Anchor, so a clause can be linked to directly in a dispute. */
  id: string;
  title: string;
  paragraphs: string[];
}

export const monicaRules: RuleSection[] = [
  {
    id: "entering",
    title: "Entering",
    paragraphs: [
      "The campaign runs from 14 September to 17 October 2026. It is organised by Blockfest Africa, with Monica as headline sponsor. Blockfest Africa is operated by Tevah Synergy, which is the entity responsible for this competition and for paying prizes.",
      "Entry is free and open to creators aged 18 or over with an account on X, Instagram or TikTok. You register once, with the handles you will be publishing from.",
      "You do not have to live in Nigeria to enter. Prizes are paid in Nigerian naira, though, so you do need an account that can receive naira. Read the payment section before entering if you are outside Nigeria.",
      "You must be the owner of the accounts you register. Entries published from an account you do not control will be rejected, and prizes are paid only to the person who registered.",
    ],
  },
  {
    id: "entries",
    title: "Entries",
    paragraphs: [
      "Each challenge accepts one entry per creator. You may publish that entry on up to three platforms, and it remains one entry.",
      "Publish on your own account, then submit the public link. We do not host your content and we do not need a copy of the file.",
      "Entries are reviewed before they score. We may reject an entry that does not answer the challenge, breaches these rules, or cannot be viewed at the link given.",
      "Where an entry is published on more than one platform, each platform is reviewed separately. One platform being rejected does not reject the others.",
    ],
  },
  {
    id: "points",
    title: "Points",
    paragraphs: [
      "An approved entry earns 100 points for the first approved platform and 50 for each platform after it, to a maximum of 200 for all three.",
      "Additional points may be awarded for work judged exceptional, for reaching a notable audience milestone with an entry, for entries featured by Blockfest Africa or by Monica, for collaborations with other creators, and for winning a wildcard challenge. Each of these is capped at 300 points, except a wildcard win which is capped at 600.",
        "Bonuses are awarded at our discretion. Every one is recorded against your account with the reason, and you can see it on your own page.",
      "Point values may be adjusted during the campaign. Changing a value does not recalculate points already awarded, so a change to the rate never restates what you have already earned.",
        "Points can be taken back in two cases, and only these two: an entry that stops meeting the rules after approval, covered below, and a correction of a mistake we made. A correction is recorded against your account with the reason, the same way an award is.",
      "The leaderboard counts approved entries. Publishing one entry on three platforms earns more points but remains a single entry for that count.",
    ],
  },
  {
    id: "referrals",
    title: "Referrals",
    paragraphs: [
      "You receive a link that brings other creators into the campaign. Each creator you bring in is worth 50 points, credited once, when they have their first approved entry rather than when they register.",
      "You may not refer yourself, or register more than one account. Accounts that appear to exist only to generate referrals will be removed along with any points they produced.",
      "This is separate from Monica's own customer referral bonus, which is a Monica product offer. It has no connection to campaign points, the leaderboard or the prize pool, and taking part in one has no effect on the other.",
    ],
  },
  {
    id: "disclosure",
    title: "Disclosure",
    paragraphs: [
      "Every entry must disclose that it is part of a sponsored campaign. Use a clear label such as #ad or #sponsored where your audience will see it, not buried at the end of a caption.",
      "This is required by Nigerian advertising rules and by the platforms themselves. An entry without disclosure will be rejected.",
    ],
  },
  {
    id: "accuracy",
    title: "What you may and may not say",
    paragraphs: [
      "Monica is a financial product, so accuracy matters more than usual. The Creator Pack lists what may be said about it and what may not.",
      "Do not promise or guarantee returns, profit, savings or any financial outcome. Do not present Monica as investment advice. Do not state fees, rates or timings that are not in the Creator Pack.",
      "Entries making claims we cannot stand behind will be rejected, and repeated breaches may end your participation.",
    ],
  },
  {
    id: "integrity",
    title: "Integrity",
    paragraphs: [
      "Purchased engagement is disqualifying. That includes bought likes, views, followers or comments, and engagement pods or any arrangement to inflate numbers artificially.",
      "We may ask for evidence about an entry, including account analytics, and may reject entries or remove creators where we are not satisfied.",
    ],
  },
  {
    id: "keeping-content-up",
    title: "Keeping your entries up",
    paragraphs: [
      "Approved entries must remain public and unedited until 31 October 2026.",
      "Deleting an entry, making it private, or materially editing it after approval forfeits the points it earned. Fixing a typo is not a material edit. Changing what the entry says about Monica is.",
    ],
  },
  {
    id: "your-content",
    title: "Your content",
    paragraphs: [
      "You own everything you make. Entering does not transfer ownership.",
      "By entering you grant Blockfest Africa and Monica a non-exclusive, worldwide, royalty-free licence to reshare, repost and feature your entries in campaign and event material, with credit to you, for two years from the end of the campaign.",
      "This covers resharing your work as published. It does not permit either of us to edit your entry into something you did not say, or to use it in paid advertising without asking you first.",
    ],
  },
  {
    id: "winners",
    title: "Winners",
    paragraphs: [
      "Weekly awards are announced each Sunday. The same creator cannot win Creator of the Week more than once, so the award reaches more creators across the campaign.",
      "Community Favourite is selected by Blockfest Africa, informed by an advisory public vote. The vote guides the decision and does not determine it, which lets us set aside voting we believe to have been manipulated.",
      "The final leaderboard is settled on total points. Where creators are level, the order is decided by who reached that total first, then by the number of approved entries, and then at our discretion.",
      "Winning a weekly award does not remove you from the final leaderboard.",
    ],
  },
  {
    id: "payment",
    title: "Getting paid",
    paragraphs: [
      "Prizes are paid to the Monica tag you gave when you registered, in Nigerian naira only. Check that tag is right: it is the only detail we use to find you, and we cannot pay a winner we cannot locate. If it is wrong, write to partnership@blockfestafrica.com before the campaign ends.",
      "Before a prize is paid we will ask you to verify your identity: government-issued identification matching the name you registered with, proof that you control the account you published from, and a bank account in that same name. We do not pay third-party accounts.",
      "Results are published with a 72-hour window for creators to raise a dispute before funds move.",
      "Prizes are paid gross, with nothing deducted. Any tax due on what you receive is yours to declare and pay, wherever you are resident.",
    ],
  },
  {
    id: "your-details",
    title: "Your details",
    paragraphs: [
      "Registering means giving us a name, an email address, a phone number and the handles you will publish from. We need those to judge entries, rank a leaderboard and pay a prize, and we ask for as little else as we can.",
      "We also record the IP address and browser you registered from, to stop automated signups, and which version of these rules you accepted.",
      "Monica is the headline sponsor and does not receive your personal details. Monica sees published entries, which are already public, and aggregate results.",
      "What we collect, how long it is kept and what you can ask for are set out in full in the campaign privacy notice, which is linked from the registration form and from the campaign page.",
    ],
  },
  {
    id: "decisions",
    title: "Decisions and changes",
    paragraphs: [
      "We may reject entries, withhold points and remove creators where these rules have been broken. Our decisions are final.",
      `These rules may be amended during the campaign, for example as the final wording is settled. The current version is ${MONICA_RULES_VERSION}, and the version you agreed to is recorded when you register. Material changes will be announced on the campaign page.`,
    ],
  },
];

/**
 * Things the campaign team still has to decide.
 *
 * Rendered on the page when there are any, rather than guessed at. A minimum
 * age invented by a developer is not a term anybody can rely on, and a creator
 * who finds out in week three that they were never eligible has a fair
 * complaint.
 *
 * Empty now: eligibility is 18 and over with no residency requirement, and
 * prizes are paid gross in naira. Both are written into the clauses above. Add
 * to this list rather than leaving a clause vague if something else comes up.
 */
export const monicaRulesOpenPoints: string[] = [];
