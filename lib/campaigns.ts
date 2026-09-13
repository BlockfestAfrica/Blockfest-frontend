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

/** How each platform is written when shown to a creator. */
export const platformLabels: Record<CampaignPlatform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
};

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

/**
 * The event's own timezone, and the only one these dates may be read in.
 *
 * Without pinning it, formatting follows whatever timezone the code happens to
 * run in, and the build runs in UTC. The campaign opens at midnight on the 14th
 * in Lagos, which is 23:00 on the 13th in UTC, so an unpinned formatter
 * prerenders "13 September" onto a page announcing a campaign that starts on
 * the 14th. It formats correctly on a laptop in Lagos or London and wrongly on
 * the server that actually builds the site.
 */
const CAMPAIGN_TIME_ZONE = "Africa/Lagos";

/**
 * The run of a campaign as one line, e.g. "14 September – 17 October 2026".
 *
 * The year appears once, on the end date, because repeating it reads as two
 * separate dates rather than a span. An en dash, not an em dash: this is a
 * range, and it matches how the rest of the site sets dates.
 */
export function campaignRun(campaign: Campaign): string | null {
  if (!campaign.startsAt || !campaign.endsAt) return null;
  const day: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    timeZone: CAMPAIGN_TIME_ZONE,
  };
  const from = new Date(campaign.startsAt).toLocaleDateString("en-GB", day);
  const to = new Date(campaign.endsAt).toLocaleDateString("en-GB", {
    ...day,
    year: "numeric",
  });
  return `${from} \u2013 ${to}`;
}

/**
 * When entries open, worded for a button, e.g. "Monday 14 September".
 *
 * The weekday is included deliberately. "14 September" asks the reader to go
 * and check what day that is; "Monday 14 September" answers it.
 */
export function campaignOpensLabel(campaign: Campaign): string | null {
  if (!campaign.startsAt) return null;
  return new Date(campaign.startsAt).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: CAMPAIGN_TIME_ZONE,
  });
}

export function campaignBySlug(slug: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.slug === slug);
}

/** The campaign a visitor can act on today, if there is one. */
export const liveCampaigns = campaigns.filter((c) => c.status === "live");

// ---------------------------------------------------------------------------
// Monica: The Money Story
// ---------------------------------------------------------------------------

/** The slug lives here so the routes are built from one string. */
/**
 * Which campaign week it is, 1 to 4.
 *
 * Derived from the campaign's own start rather than from a stored value, so it
 * cannot drift from the challenge windows, which are the same four Mondays.
 *
 * Clamped at both ends on purpose. Before the campaign opens this answers 1,
 * which is what the winners screen should be pointed at while the team
 * rehearses; after it closes it answers 4, so the final week stays selected
 * rather than the screen offering a week 5 that no constraint would accept.
 */
export function currentWeekNo(now: Date = new Date()): number {
  const campaign = campaigns.find((c) => c.slug === MONICA_SLUG);
  if (!campaign?.startsAt) return 1;

  const start = new Date(campaign.startsAt).getTime();
  const elapsedDays = Math.floor((now.getTime() - start) / 86_400_000);
  return Math.min(4, Math.max(1, Math.floor(elapsedDays / 7) + 1));
}

export const MONICA_SLUG = "monica-money-story";

/**
 * Lifts the opening-date gate before the campaign starts.
 *
 * Set deliberately, to work through the full registration flow against the real
 * database ahead of launch. The database is wiped before the campaign opens, so
 * anything registered while this is on is throwaway.
 *
 * One flag rather than a server one and a client one, because two flags can
 * disagree and the failure would be silent: a form that renders against an
 * endpoint that refuses it, or worse, the reverse. It is NEXT_PUBLIC_ because
 * both sides read it and there is nothing here worth hiding. It is a boolean,
 * not a key: it does not admit anyone who could not already find this page.
 *
 * Compared against the exact string, so anything unset, misspelt or truthy-ish
 * leaves the gate shut. Turning it off means removing the variable and
 * redeploying, since the value is compiled into the client bundle.
 *
 * After 14 September this flag stops mattering: the date has passed and the
 * gate is open on its own.
 */
export const CAMPAIGN_GATE_FORCED_OPEN =
  process.env.NEXT_PUBLIC_CAMPAIGN_GATE_OPEN === "true";

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
  privacy: `/campaigns/${MONICA_SLUG}/privacy`,
  /** Resolves an access token from a link and asks whose account it opens. */
  enter: `/campaigns/${MONICA_SLUG}/enter`,
  /** Names the account a link opens, and takes the confirming POST. */
  enterConfirm: `/campaigns/${MONICA_SLUG}/enter/confirm`,
  /** The creator's own page. Reads the cookie; never takes a token in the URL. */
  me: `/campaigns/${MONICA_SLUG}/me`,
  leaderboard: `/campaigns/${MONICA_SLUG}/leaderboard`,
  winners: `/campaigns/${MONICA_SLUG}/winners`,
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

/**
 * How many days the campaign runs.
 *
 * Day 1 is 14 September, so day 33 is 16 October and the published end date of
 * 17 October is the close: the final standings, on the Saturday the standings
 * always land on.
 */
export const MONICA_CAMPAIGN_DAYS = 33;

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
 * The brief calls this a 30-day campaign while giving dates that do not make
 * 30 days, so the campaign team settled it: 33. Day 1 is Monday 14 September
 * and day 33 is Friday 16 October, which leaves Saturday 17 October as the
 * close. That lands well rather than awkwardly, because Saturday is already
   * the day weekly winners are announced, so the campaign ends on an
   * announcement rather than mid-week on a stage nobody finished.
 *
 * The extra three days go to the last stage. It is the one with the widest
 * creative brief and the most at stake, so it is the one that benefits.
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
    days: [22, MONICA_CAMPAIGN_DAYS],
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
      "A new brief drops each Monday. How you answer it is yours: a thread, a reel, a skit, a carousel, an explainer, a street interview, an animation.",
  },
  {
    title: "Publish and submit",
    detail:
      "Post it on your own account, then submit the link. Post the same piece on more than one platform and it still counts as one entry, worth more points.",
  },
  {
    title: "Earn and climb",
    detail:
      "Approved entries score. Bonuses go to work that is genuinely good, gets featured, or brings another creator in. The leaderboard moves as entries are approved, and weekly winners are announced every Saturday.",
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
      "You get a link that brings other creators into the campaign. Each one is worth 50 points, credited once the creator you brought in has their first approved entry, so you are rewarded for bringing in people who actually take part rather than for sending sign-ups.",
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

/**
 * When the first weekly winners are announced.
 *
 * Not when the board appears. The board is live from the first approval and
 * refreshes within a minute, which is what the code does and what a creator
 * sees. Three separate places used to say standings were published weekly,
 * which would have read as a broken promise in both directions: a creator
 * checking on the 15th finds a full board the site said would not exist yet,
 * and a creator told the board updates weekly has no reason to come back on
 * Tuesday after an approval.
 */
export const MONICA_FIRST_LEADERBOARD = "Saturday 19 September";

/** Where campaign conversation happens, and how entries are found. */
export const MONICA_HASHTAGS = ["#TheMoneyStory", "#AreYouSkillful"] as const;
