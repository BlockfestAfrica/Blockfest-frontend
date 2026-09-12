/**
 * The Creator Pack for Monica: The Money Story.
 *
 * Interim wording, and published for the same reason the rules were. The rules
 * already tell creators that this document decides what may be said about a
 * regulated financial product and that entries breaching it will be rejected.
 * A binding document that does not exist is worse than an incomplete one: it
 * means rejecting somebody under a standard they were never able to read.
 *
 * So what is here is the part that does not depend on Monica: the disclosure
 * requirement, and the claims that are prohibited under Nigerian advertising
 * and financial promotion rules regardless of what any product does. What is
 * deliberately absent is the product detail, because inventing a fee, a rate or
 * a transfer time for a payments company would be the single worst thing this
 * page could do. Those are listed as open points instead.
 *
 * The safe default is stated plainly at the top of the page: describe your own
 * experience, and do not state a number you cannot point at.
 */

export const MONICA_PACK_VERSION = "1.0";

/** ISO date. Rendered in the event's own timezone. */
export const MONICA_PACK_UPDATED = "2026-09-12";

export interface PackSection {
  /** Anchor, so a point can be linked to directly when an entry is queried. */
  id: string;
  title: string;
  paragraphs: string[];
}

/**
 * The one rule that decides most questions.
 *
 * Kept separate and shown first, because a creator who reads nothing else
 * should still come away with the thing that keeps them out of trouble.
 */
export const monicaPackPrinciple =
  "Talk about your own experience of money, and about Monica as a way to move it. Do not state a number, a rate, a fee or a timing that you cannot point at in this pack. If you are unsure whether something is a claim, it is a claim.";

export const monicaPackAllowed: string[] = [
  "Your own story about money: sending it, receiving it, waiting for it, moving it across borders, and what that felt like.",
  "That Monica is a way to send and receive money, described in your own words.",
  "Your own genuine experience of using Monica, described as your experience rather than as a general result.",
  "Publicly available information from Monica's own channels, quoted accurately and not reframed as a promise.",
  "Humour, drama, skits and opinion. The campaign is looking for a story told well, and none of this pack asks you to sound like a bank.",
];

export const monicaPackProhibited: string[] = [
  "Any promise or guarantee of returns, profit, savings or a financial outcome, including phrasing like \"you will save\", \"guaranteed\" or \"risk free\".",
  "Presenting Monica, or anything in your entry, as investment or financial advice.",
  "Fees, exchange rates, transfer times, limits or charges that are not confirmed in this pack.",
  "Comparisons that name another provider and claim Monica is cheaper, faster or better, unless the comparison is in this pack.",
  "Anything suggesting Monica is a bank, or is insured, licensed or guaranteed in a way it has not stated itself.",
  "Urgency or pressure framing: limited time, act now, last chance, or an implication that somebody will lose out by waiting.",
  "Targeting or appearing to target anyone under 18.",
  "Claims about other people's results, or invented testimonials.",
];

/**
 * Disclosure. Separated from the prohibitions because it is the one thing a
 * creator has to actively do rather than avoid, and the rules already reject
 * entries that omit it.
 */
export const monicaPackDisclosure = {
  labels: ["#ad", "#sponsored", "Paid partnership with Monica"],
  paragraphs: [
    "Every entry must show that it is part of a sponsored campaign. This is required by Nigerian advertising rules and by the platforms themselves, and an entry without it will be rejected.",
    "Put it where your audience will actually see it: in the caption near the top, or on screen early in a video, or using the platform's own paid partnership label. Buried at the end of a caption, hidden behind a \"more\" link, or lost in a block of other hashtags does not count.",
    "Use the platform's built-in disclosure tool as well where it has one. It does not replace the label in your caption, and using both is the safest position.",
  ],
};

export const monicaPackSections: PackSection[] = [
  {
    id: "why-this-matters",
    title: "Why this pack exists",
    paragraphs: [
      "Monica is a financial product, so accuracy matters more than it would in an ordinary brand campaign. A claim about money is regulated whether or not the person making it knew that.",
      "This pack protects you as much as it protects Monica. An entry that stays inside it cannot be rejected for what it said, and a creator who follows it is not carrying a risk they did not sign up for.",
      "It applies to the entry itself and to anything attached to it: captions, on-screen text, voiceover, comments you pin, and replies you make about the entry.",
    ],
  },
  {
    id: "if-unsure",
    title: "If you are not sure",
    paragraphs: [
      "Ask before you publish, not after. An entry can be adjusted in draft in a minute and cannot be adjusted after it has been rejected.",
      "Questions go to partnership@blockfestafrica.com and are answered as quickly as we can. Asking never counts against you, and it is not treated as a sign that anything is wrong with your entry.",
      "If you cannot get an answer in time, leave the claim out. An entry is judged on the story, the craft and the idea, and never on how much product detail it managed to include.",
    ],
  },
  {
    id: "what-happens",
    title: "What happens if an entry breaches this",
    paragraphs: [
      "The entry is rejected and does not score. Where the entry was published on more than one platform, each platform is reviewed separately, so one rejection does not reject the others.",
      "You will be told which point it breached, so it can be avoided next time. Repeated breaches may end your participation, as the rules set out.",
      "A rejection under this pack is about the claim, not about you. It carries no other consequence and does not affect entries you have already had approved.",
    ],
  },
];

/**
 * What is still with Monica.
 *
 * Named rather than guessed at, and rendered prominently on the page. A
 * creator who can see exactly which details are missing knows what to ask
 * about, which is a far better position than one who cannot tell whether the
 * silence is deliberate.
 */
export const monicaPackOpenPoints: string[] = [
  "The approved description of what Monica does and who it is for, in Monica's own words.",
  "Any fees, exchange rates, transfer times or limits that creators may state, with the exact wording for each.",
  "Whether named comparisons with other providers are permitted, and if so which.",
  "Monica's brand assets, along with how the name and logo may be shown.",
  "Any wording Monica requires verbatim, such as a regulatory or licensing statement.",
];
