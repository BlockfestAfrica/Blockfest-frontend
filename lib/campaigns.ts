/**
 * Creator campaigns.
 *
 * Blockfest runs sponsor-backed creator campaigns alongside the event itself.
 * Monica: The Money Story is the first; Rovv follows. That is the whole reason
 * /campaigns is an index rather than a single page. A second campaign is
 * already known about, and building for one would mean rebuilding for two.
 *
 * Everything here is static marketing copy that does not move once a campaign
 * opens: the stages, the skills, the prize ladder, the point ladder. It lives
 * in lib/ rather than the database for the same reason the ticket tiers do:
 * it lets /campaigns and the campaign landing pages prerender, and a page that
 * prerenders cannot be taken down by a database that is asleep.
 *
 * What does move during a campaign is not here: the live challenge, the
 * leaderboard, the weekly winners. That comes from the database, fetched by the
 * client into an otherwise static shell.
 */

export type CampaignStatus = "live" | "coming-soon" | "ended";

/** The platforms a creator may publish on. Ordered as the campaign names them. */
export const CAMPAIGN_PLATFORMS = ["x", "instagram", "tiktok"] as const;
export type CampaignPlatform = (typeof CAMPAIGN_PLATFORMS)[number];

export interface Campaign {
  slug: string;
  name: string;
  /** The line that does the selling, e.g. "Are you skillful?". */
  hook: string;
  sponsor: string;
  /** Sponsor logo, reusing the partner asset already in the repo. */
  sponsorLogo?: string;
  sponsorUrl?: string;
  summary: string;
  status: CampaignStatus;
  /** Total reward pool in naira. Undefined until a campaign announces one. */
  rewardPool?: number;
  startsAt?: string;
  endsAt?: string;
}

export const campaigns: Campaign[] = [
  {
    slug: "monica-money-story",
    name: "Monica: The Money Story",
    hook: "Are you skillful?",
    sponsor: "Monica",
    sponsorLogo: "/2026/sponsors/Monica.png",
    sponsorUrl: "https://x.com/monicanigeria",
    summary:
      "A creator competition about the everyday stories behind money: sending it, receiving it, moving it across borders, and how Monica is building a better way through them.",
    status: "live",
    rewardPool: 5_000_000,
    startsAt: "2026-09-14T00:00:00+01:00",
    endsAt: "2026-10-17T23:59:59+01:00",
  },
  {
    slug: "rovv",
    name: "Rovv",
    hook: "Coming soon",
    sponsor: "Rovv",
    summary:
      "The next creator campaign from Blockfest Africa. Details to be announced.",
    status: "coming-soon",
  },
];

export function campaignBySlug(slug: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.slug === slug);
}

/** The campaign a visitor can act on today, if there is one. */
export const liveCampaigns = campaigns.filter((c) => c.status === "live");

// ---------------------------------------------------------------------------
// Monica: The Money Story
// ---------------------------------------------------------------------------

/** The slug lives here so the routes are built from one string. */
export const MONICA_SLUG = "monica-money-story";

export const monicaRoutes = {
  landing: `/campaigns/${MONICA_SLUG}`,
  /** Where the CTA sends people. Never /register: next.config.ts 308-redirects
   *  that to the homepage permanently, and browsers cache permanent redirects,
   *  so the breakage would outlive the fix. */
  register: `/campaigns/${MONICA_SLUG}/register`,
  /** Referral entry point. Sets the ref cookie, then forwards to register. */
  join: `/campaigns/${MONICA_SLUG}/join`,
  rules: `/campaigns/${MONICA_SLUG}/rules`,
  pack: `/campaigns/${MONICA_SLUG}/pack`,
} as const;

export interface CampaignSkill {
  name: string;
  description: string;
}

/** The four things the campaign claims to be testing, in its own order. */
export const monicaSkills: CampaignSkill[] = [
  {
    name: "Storytelling",
    description:
      "Turning an everyday money problem into something people want to talk about.",
  },
  {
    name: "Creativity",
    description:
      "Making someone stop scrolling, in whatever format suits the idea.",
  },
  {
    name: "Education",
    description: "Making something complicated easy to understand.",
  },
  {
    name: "Influence",
    description:
      "Introducing a product without it landing as an advertisement.",
  },
];

export interface CampaignStage {
  number: number;
  name: string;
  /** Inclusive day range within the campaign, as the brief numbers them. */
  days: [number, number];
  question: string;
  focus: string;
  /** Which of the four skills this stage is testing. */
  skills: string[];
}

/**
 * The four stages.
 *
 * Note the arithmetic: the stages run to day 30, but the campaign window of
 * 14 September to 17 October is 33 days. The brief calls it a 30-day campaign
 * throughout while giving those dates, so the stage numbering is kept exactly
 * as written and the extra days sit at the end, where the final challenge and
 * judging fall. Worth settling with the campaign team rather than quietly
 * stretching a stage to cover it.
 */
export const monicaStages: CampaignStage[] = [
  {
    number: 1,
    name: "The Discovery",
    days: [1, 7],
    question: "Who is Monica?",
    focus:
      "Introduce Monica to your audience and make the brand understandable.",
    skills: ["Education", "Storytelling"],
  },
  {
    number: 2,
    name: "The Problem",
    days: [8, 14],
    question: "Why is money still this complicated?",
    focus:
      "Tell real or relatable stories about financial friction: the fees, the waiting, the rates.",
    skills: ["Storytelling", "Creativity"],
  },
  {
    number: 3,
    name: "The Solution",
    days: [15, 21],
    question: "There's a better way.",
    focus:
      "Explore stablecoins, digital finance and what Monica is actually building.",
    skills: ["Education", "Influence"],
  },
  {
    number: 4,
    name: "The Money Story",
    days: [22, 30],
    question: "Tell Monica's story your way.",
    focus: "Maximum creative freedom, and your strongest single piece of work.",
    skills: ["Storytelling", "Creativity", "Education", "Influence"],
  },
];

/**
 * Points for one challenge entry, by how many platforms of it were approved.
 *
 * Written as the total a creator ends up with, not as stacking bonuses. The
 * brief gives both readings and they disagree: section 5.1 says three platforms
 * earns "up to 300", while the table in section 8 lists "+100" for two and
 * "+200" for three, which reads as 100 + 100 + 200 = 400. The campaign team
 * confirmed the intent. Each platform is worth 100, so the ladder is linear
 * and stops at three.
 *
 * Totals rather than deltas is deliberate. Deltas are what let that ambiguity
 * become a silent bug, and they make the admin configuration screen a puzzle.
 * Three approved platforms is worth exactly what this array says, and the
 * scoring code never adds anything up to find out.
 */
export const monicaPointLadder = [
  { platforms: 1, points: 100 },
  { platforms: 2, points: 200 },
  { platforms: 3, points: 300 },
] as const;

export interface PrizeAward {
  label: string;
  amount: number;
  /** How many times this award is given across the campaign. */
  count: number;
  note?: string;
}

/** Weekly awards, given four times each across the four campaign weeks. */
export const monicaWeeklyPrizes: PrizeAward[] = [
  {
    label: "Creator of the Week",
    amount: 300_000,
    count: 4,
    note: "A different creator each week. Nobody wins it twice.",
  },
  {
    label: "Community Favourite",
    amount: 100_000,
    count: 4,
    note: "Shortlisted by Blockfest, informed by a public vote.",
  },
];

/** The final leaderboard, paid once at the end. */
export const monicaFinalPrizes: PrizeAward[] = [
  { label: "1st", amount: 1_500_000, count: 1 },
  { label: "2nd", amount: 800_000, count: 1 },
  { label: "3rd", amount: 500_000, count: 1 },
  { label: "4th", amount: 300_000, count: 1 },
  { label: "5th", amount: 300_000, count: 1 },
];

const sum = (prizes: PrizeAward[]) =>
  prizes.reduce((total, prize) => total + prize.amount * prize.count, 0);

/** ₦1,600,000 across the four weeks. */
export const monicaWeeklyTotal = sum(monicaWeeklyPrizes);

/** ₦3,400,000 on the final leaderboard. */
export const monicaFinalTotal = sum(monicaFinalPrizes);

/**
 * ₦5,000,000, derived rather than asserted.
 *
 * The headline number is the campaign's single most quoted fact and appears on
 * the landing page, in the rules and in the sponsor deck. Deriving it means a
 * change to any prize is either reflected everywhere or caught by the test that
 * checks this equals the advertised pool.
 */
export const monicaRewardPool = monicaWeeklyTotal + monicaFinalTotal;

export interface HowItWorksStep {
  title: string;
  detail: string;
}

/** The loop a creator repeats for the length of the campaign. */
export const monicaHowItWorks: HowItWorksStep[] = [
  {
    title: "Join",
    detail:
      "Register once with your handles. You get the Creator Pack: brand assets, product facts, the claims you may and may not make, hashtags and handles.",
  },
  {
    title: "Take the challenge",
    detail:
      "A new brief drops each weekend. How you answer it is yours: a thread, a reel, a skit, a carousel, an explainer, a street interview, an animation.",
  },
  {
    title: "Publish and submit",
    detail:
      "Post it on your own account, then submit the link. Post the same piece on more than one platform and it still counts as one entry, worth more points.",
  },
  {
    title: "Earn and climb",
    detail:
      "Approved entries score. Bonuses go to work that is genuinely good, gets featured, or brings another creator in. The leaderboard updates every Saturday.",
  },
];

export interface CampaignFaq {
  question: string;
  answer: string;
}

/**
 * Questions a creator asks before entering.
 *
 * Deliberately narrow. Everything here is answerable from the campaign brief;
 * anything turning on legal wording, eligibility or how prize money is paid is
 * left to the rules page rather than half-answered here, because a wrong answer
 * about ₦5,000,000 is worse than a pointer to the page that governs it.
 */
export const monicaFaqs: CampaignFaq[] = [
  {
    question: "Who can enter?",
    answer:
      "Any creator with an audience on X, Instagram or TikTok. You do not need a large following. Judging weighs creativity, storytelling, relevance, consistency and reach together, so the competition is not simply won by the biggest account.",
  },
  {
    question: "Does it cost anything?",
    answer: "No. Entering is free, and you keep everything you make.",
  },
  {
    question: "What counts as an entry?",
    answer:
      "One piece of content answering the current challenge, published on your own account and submitted as a link. We review it, and once approved it scores.",
  },
  {
    question: "What if I post the same thing on all three platforms?",
    answer:
      "That is encouraged and it is worth more. Each approved platform is worth 100 points, so the same piece across X, Instagram and TikTok earns 300. It still counts as one challenge entry, not three.",
  },
  {
    question: "How do referrals work?",
    answer:
      "You get a link that brings other creators into the campaign. Points are credited once the creator you brought in has their first approved entry, so you are rewarded for bringing in people who actually take part.",
  },
  {
    question: "Is this the same as Monica's referral bonus?",
    answer:
      "No, and the two are kept entirely separate. Monica runs its own customer referral bonus as a product. It has nothing to do with campaign points, the leaderboard or the prize pool.",
  },
  {
    question: "Do I have to say it is an ad?",
    answer:
      "Yes. Disclose the partnership on every entry. The Creator Pack tells you how, and which claims you may and may not make about a financial product.",
  },
  {
    question: "Who owns the content I make?",
    answer:
      "You do. By entering you allow Blockfest Africa and Monica to reshare it with credit. The full terms are on the rules page.",
  },
];

/** When the first standings are published. Day 1 has nobody on the board. */
export const MONICA_FIRST_LEADERBOARD = "Saturday 19 September";

/** Where campaign conversation happens, and how entries are found. */
export const MONICA_HASHTAGS = ["#TheMoneyStory", "#AreYouSkillful"] as const;
