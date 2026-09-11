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
export const MONICA_RULES_UPDATED = "2026-09-11";

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
      "The campaign runs from 14 September to 17 October 2026. It is organised by Blockfest Africa, with Monica as headline sponsor.",
      "Entry is free and open to creators with an account on X, Instagram or TikTok. You register once, with the handles you will be publishing from.",
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
      "An approved entry earns 100 points per approved platform, to a maximum of 300 for all three.",
      "Additional points may be awarded for work judged exceptional, for entries we feature, for collaborations with other creators, and for winning a wildcard challenge. These are awarded at our discretion and the amount is recorded against your account.",
      "Point values may be adjusted during the campaign. Points already awarded are not recalculated, so an adjustment never changes a total you have already earned.",
      "The leaderboard counts approved entries. Publishing one entry on three platforms earns more points but remains a single entry for that count.",
    ],
  },
  {
    id: "referrals",
    title: "Referrals",
    paragraphs: [
      "You receive a link that brings other creators into the campaign. Points are credited when the creator you referred has their first approved entry, not when they register.",
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
      "Before a prize is paid we will ask you to verify your identity: government-issued identification matching the name you registered with, proof that you control the account you published from, and a bank account in that same name. We do not pay third-party accounts.",
      "Results are published with a 72-hour window for creators to raise a dispute before funds move.",
      "You are responsible for any tax due on a prize.",
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
 * Shown on the page rather than guessed at. A minimum age invented by a
 * developer is not a term anybody can rely on, and a creator who finds out in
 * week three that they were never eligible has a fair complaint.
 */
export const monicaRulesOpenPoints = [
  "Minimum age and whether entry is limited to residents of Nigeria.",
  "The legal entity running the competition, and whether prizes are paid gross or net of Nigerian withholding tax.",
];
