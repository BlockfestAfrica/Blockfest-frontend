/**
 * The Creator Pack for Monica: The Money Story.
 *
 * The product facts here come from Monica's own published Terms of Service,
 * Privacy Policy and Compliance Statement, all dated 29 May 2026. Nothing is
 * inferred: where those documents are silent, the point stays in the open list
 * rather than being filled in with something plausible.
 *
 * The distinctions this document exists to protect are narrower than they look,
 * and all of them are the kind a creator would get wrong in good faith:
 *
 * Monica says it is "aligned with" the SEC Virtual Asset Service Provider
 * framework. It does not say licensed, registered, approved or regulated by,
 * and its own Compliance Statement says it holds no banking licence. Upgrading
 * "aligned with" to "licensed by" is a false statement about a financial
 * business and is the single most likely claim in this campaign to cause real
 * trouble.
 *
 * Monica is a one-way off ramp: crypto to naira, and not the reverse. An entry
 * saying you can buy crypto on Monica is describing a product that does not
 * exist.
 *
 * Monica is not a custodian. Its own terms say title passes to Monica's
 * treasury on confirmation and the customer's claim is a contractual naira
 * receivable. So "store your crypto with Monica" is wrong, and so is anything
 * implying funds are held safely on your behalf.
 *
 * And nothing is insured. The terms say so twice, in the risk disclosure and in
 * the Compliance Statement.
 */

export const MONICA_PACK_VERSION = "1.1";

/** ISO date. Rendered in the event's own timezone. */
export const MONICA_PACK_UPDATED = "2026-09-12";

/** Where Monica's own wording lives, so a claim can be checked at source. */
export const MONICA_SOURCE_URL = "https://monica.cash";

/** The documents these facts were taken from, and when they were published. */
export const MONICA_SOURCE_DATE = "29 May 2026";

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
  "Talk about your own experience of money, and about Monica as a way to turn crypto into naira. Do not state a number, a rate, a fee, a timing or a regulatory status that is not written below. If you are unsure whether something is a claim, it is a claim.";

export interface PackFact {
  label: string;
  detail: string;
}

/**
 * Confirmed product facts, safe to state as written.
 *
 * Taken from Monica's published documents. Phrasing matters more than usual
 * here: several of these are correct only in the exact form given.
 */
export const monicaPackFacts: PackFact[] = [
  {
    label: "What Monica is",
    detail:
      "A one-way crypto to naira off ramp for people in Nigeria. You send supported crypto, it is converted at the rate shown, and the naira lands in your own Nigerian bank account.",
  },
  {
    label: "Who operates it",
    detail:
      "Monica Technologies Limited, a company incorporated in Nigeria with its registered office in Lagos.",
  },
  {
    label: "Fees",
    detail:
      "0% platform fee on the conversion and 0% fee on the naira withdrawal. Say it that way. The blockchain network fee, or gas, is still paid by the sender and is set by the network rather than by Monica, so no fees at all is not accurate.",
  },
  {
    label: "Supported crypto",
    detail:
      "Bitcoin, Ethereum, Solana, Tron and BNB, plus the stablecoins USDT and USDC, across the Bitcoin, ERC20, TRC20, BEP20, Solana and Base networks. Monica may change this list, so check before naming an asset.",
  },
  {
    label: "How the naira arrives",
    detail:
      "By NIBSS instant transfer, to a Nigerian bank account verified as being in your own name.",
  },
  {
    label: "Who can use it",
    detail:
      "People aged 18 or over who are ordinarily resident in Nigeria and hold a Nigerian bank account in their own name.",
  },
  {
    label: "Verification",
    detail:
      "Tier 1 verifies your Nigerian bank account and allows withdrawals up to 500,000 naira per withdrawal. Tier 2 adds your NIN and allows up to 1,000,000 naira per withdrawal. Other daily, weekly and monthly caps apply and are shown in the app.",
  },
  {
    label: "Regulatory position, exact wording",
    detail:
      "Monica describes itself as aligned with the Nigerian SEC's Virtual Asset Service Provider framework. Use that phrase. It is not licensed, registered, approved or regulated by the SEC or the CBN, and it holds no banking licence.",
  },
  {
    label: "The card",
    detail:
      "Verified users may apply for a virtual dollar card issued through a partner. It is subject to that partner's own terms, so do not describe its limits, rates or features.",
  },
];

export const monicaPackAllowed: string[] = [
  "Your own story about money: sending it, receiving it, waiting for it, watching a transfer cost more than it should, and what that felt like.",
  "That Monica turns crypto into naira in your Nigerian bank account, described in your own words.",
  "Your own genuine experience of using Monica, told as your experience rather than as a result anybody else should expect.",
  "Any fact in the confirmed list above, stated in the form given there.",
  "Anything Monica has published on its own site or channels, quoted accurately and not reframed as a promise.",
  "Humour, drama, skits and opinion. The campaign is looking for a story told well, and nothing here asks you to sound like a bank.",
];

export const monicaPackProhibited: string[] = [
  "Saying Monica is licensed, registered, approved or regulated by the SEC, the CBN or anybody else. Its own wording is aligned with the SEC's VASP framework, and that is the only form to use.",
  "Saying Monica is a bank, or that money held with it is insured, protected or guaranteed. It holds no banking licence and nothing is NDIC insured.",
  "Saying you can buy crypto on Monica, or hold, store or keep crypto in a Monica wallet. It converts one way, crypto to naira, and it is not a custodian.",
  "Any promise or guarantee of returns, profit, savings or a financial outcome, including phrasing like you will save, guaranteed, or risk free.",
  "Presenting Monica, or anything in your entry, as investment or financial advice.",
  "Rates, transfer times, limits or charges that are not in the confirmed list above, including saying the conversion is free with no mention of network fees.",
  "Comparisons naming another provider and claiming Monica is cheaper, faster or better, unless you have asked and been told in writing that you may.",
  "Urgency or pressure framing: limited time, act now, last chance, or implying somebody loses out by waiting.",
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
    "Put it where your audience will actually see it: in the caption near the top, or on screen early in a video, or using the platform's own paid partnership label. Buried at the end of a caption, hidden behind a more link, or lost in a block of other hashtags does not count.",
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
    id: "outside-nigeria",
    title: "If you are not in Nigeria",
    paragraphs: [
      "The campaign is open to creators anywhere. Monica is not: its terms require you to be ordinarily resident in Nigeria with a Nigerian bank account in your own name.",
      "So if you are outside Nigeria you can enter every challenge, but you cannot open an account and you cannot speak from personal experience of using it. Tell the story from where you actually stand, which is usually the more interesting angle anyway: the money problem is not a Nigerian invention.",
      "Do not describe using the app if you have not used it. An invented first-person account is a fabricated testimonial and will be rejected.",
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
 * Shorter than it was, because Monica's published documents answered most of
 * it. What remains is genuinely absent from those documents rather than merely
 * unconfirmed by us.
 */
export const monicaPackOpenPoints: string[] = [
  "Monica's brand assets, and how the name and logo may be shown.",
  "Whether creators may name another provider in a comparison, and if so which.",
  "Any wording Monica requires verbatim in an entry, such as a risk or regulatory line.",
  "Whether the marketing figures on Monica's own site, such as payout speed and user numbers, may be repeated by creators.",
];
