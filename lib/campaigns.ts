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
  /**
   * A photograph for the campaign card, under a legibility gradient. The
   * marketing team asked for pictures to give the cards life; until a real
   * photo lands at this path the card stands on its gradient treatment, so
   * an absent file must never be referenced here.
   */
  cardImage?: string;
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
    /* Monica's own campaign art. The right half of the poster, the phone and
       the coins, is what the card's object-right crop shows; the poster's own
       headline sits on the left, under the solid side of the gradient. */
    cardImage: "/images/monica/monica-card.jpg",
    sponsor: "Monica",
    sponsorLogo: "/2026/sponsors/Monica.png",
    sponsorUrl: "https://x.com/monicanigeria",
    /*
     * One sentence, because this is a card on a phone. The longer version,
     * which listed sending, receiving and moving money across borders, pushed
     * the card past a screen and said nothing the campaign page does not say
     * better a tap later.
     */
    summary:
      "A creator competition about the everyday stories behind money, and how Monica is building a better way through them.",
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
    summary: "The next campaign. Details to be announced.",
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
 * Which campaign stage it is, 1 to 5.
 *
 * Derived from the campaign's own start rather than from a stored value, so it
 * cannot drift from the challenge windows, which are the same five Mondays.
 * The stages run Monday to Saturday with Sunday between them, so they are not
 * contiguous, but they still begin exactly seven days apart and the arithmetic
 * is unchanged.
 *
 * Clamped at both ends on purpose. Before the campaign opens this answers 1,
 * which is what the winners screen should be pointed at while the team
 * rehearses; after it closes it answers 5, so the final stage stays selected
 * rather than the screen offering a stage no constraint would accept.
 */
export function currentWeekNo(now: Date = new Date()): number {
  const campaign = campaigns.find((c) => c.slug === MONICA_SLUG);
  if (!campaign?.startsAt) return 1;

  const start = new Date(campaign.startsAt).getTime();
  const elapsedDays = Math.floor((now.getTime() - start) / 86_400_000);
  return Math.min(5, Math.max(1, Math.floor(elapsedDays / 7) + 1));
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
  /* The pack page is retired; the pack lives in the team's shared doc.
     External, so every consumer renders it target _blank. */
  pack: "https://app.notion.com/p/MONICA-THE-MONEY-STORY-3dbd155078a180a6b1a3e811f433b0ab",
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
export const MONICA_CAMPAIGN_DAYS = 34;

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
 * The five stages.
 *
 * Each runs Monday to Saturday, with the Sunday between them kept clear: that
 * is when the week's entries are reviewed and the weekly winners announced, so
 * a stage never ends on the day its own result is published.
 *
 * Day 1 is Monday 14 September and day 34 is Saturday 17 October. The four
 * Sundays in between are days 7, 14, 21 and 28, which is why the ranges below
 * have gaps in them rather than running end to end.
 *
 * Weekly prizes are decided after stages 1 to 4. Stage 5 is the finale: it
 * carries the final prize rather than a fifth weekly one, which is why the
 * weekly pool is still described as four rounds.
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
    name: "The Proof",
    days: [22, 28],
    question: "Show it working.",
    focus:
      "Make it concrete: what changes for somebody who actually uses it.",
    skills: ["Influence", "Education"],
  },
  {
    number: 5,
    name: "The Money Story",
    days: [29, MONICA_CAMPAIGN_DAYS],
    question: "Tell Monica's story your way.",
    focus: "Maximum creative freedom, and your strongest single piece of work.",
    skills: ["Storytelling", "Creativity", "Education", "Influence"],
  },
];

/**
 * Points for one challenge entry, by how many platforms of it were approved.
 *
 * Written as the total a creator ends up with, not as stacking bonuses.
 *
 * The first platform is worth 100 and every platform after it is worth 50. The
 * second posting is not the same work as the first: the creator writes one
 * piece and repurposes it, which is what the campaign asks for and why it does
 * not pay three times over. Two platforms is 150, three is 200.
 *
 * The database holds these as increments above base_points, which is how
 * recompute_entry_award reads them, so the two representations are related but
 * not identical. 0030_platform_ladder.sql carries the mapping.
 */
export const monicaPointLadder = [
  { platforms: 1, points: 100 },
  { platforms: 2, points: 150 },
  { platforms: 3, points: 200 },
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
    note: "Shortlisted by Blockfest. Winner decided by public vote.",
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

/** ₦1,600,000 across the four weekly rounds, after stages 1 to 4. */
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
      "Register once with your social handles and get access to the Creator Pack: brand assets, product information, approved claims, hashtags and social handles.",
  },
  {
    title: "Take the challenge",
    detail:
      "A new challenge drops every Monday. How you answer it is up to you: a thread, a reel, a skit, a carousel, an explainer, a street interview, an animation, or something we have not thought of yet.",
  },
  {
    title: "Publish and submit",
    detail:
      "Publish your content on your own X, Instagram or TikTok account, then submit the link. Post it on more than one platform and it still counts as one entry, but earns more points.",
  },
  {
    title: "Earn and climb",
    detail:
      "Every approved entry earns points, with more for multi-platform posts, standout content, engagement milestones, features, creator referrals and wildcards. Your points move you up the leaderboard, and weekly winners are announced every Sunday.",
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
      "The challenge is open to all creators with an audience on X, Instagram and TikTok. You do not need a minimum follower count to participate.",
  },
  {
    question: "Does it cost anything?",
    answer: "No. It is completely free to enter.",
  },
  {
    question: "What counts as an entry?",
    answer:
      "An entry is an original piece of content created in response to the active weekly challenge and published on your own X, Instagram or TikTok account, then submitted through the campaign platform.",
  },
  {
    question: "Can I post the same content on multiple platforms?",
    answer:
      "Yes. You can publish the same challenge entry on X, Instagram and TikTok. It still counts as one entry, but posting across multiple platforms earns additional points.",
  },
  {
    question: "How do I earn points?",
    answer:
      "You earn points for approved challenge entries, with additional points available for multi-platform submissions, engagement milestones, standout content, features, creator referrals, collaborations and wildcard challenges. See the campaign rules for the full points breakdown.",
  },
  {
    question: "How do creator referrals work?",
    // 10 since migration 0041 adopted the team's revised figure: it is
    // what the rules promise and what the database pays, and the three
    // must never disagree.
    answer:
      "Every creator gets a unique referral link. Share it with other creators and earn 10 points when a creator you refer joins the campaign and their first entry is approved. There is no limit to the number of creators you can refer.",
  },
  {
    question: "Is this the same as Monica's referral bonus?",
    answer:
      "No. The Money Story creator referral is a campaign points mechanic. It is completely separate from Monica's customer referral programme and its referral rewards.",
  },
  {
    question: "How is Community Favourite chosen?",
    answer:
      "Blockfest shortlists eligible entries from the week's challenge, and the shortlist goes to a public vote on the winners page. You vote with your email address, and a six digit code sent to it verifies your vote. It is one vote per email address each round, and the creator with the most valid votes wins Community Favourite and the weekly prize.",
  },
  {
    question: "How do I vote for Community Favourite?",
    answer:
      "Open the winners page on Sunday, pick your favourite from the shortlist and enter your email address. A six digit code arrives in your inbox; type it in and your vote is cast. Votes close on Sunday evening.",
  },
  {
    question: "How is Creator of the Week chosen?",
    answer:
      "Creator of the Week is selected by the Blockfest team based on the quality of the creator's work across the campaign criteria, including storytelling, creativity, education, influence, engagement and overall execution.",
  },
  {
    question: "Can I win more than one weekly award?",
    answer:
      "You can win Creator of the Week only once. You can still remain eligible for other awards and the final leaderboard.",
  },
  {
    question: "Do I have to disclose that my content is sponsored?",
    answer: "Yes, where required.",
  },
  {
    question: "Who owns the content I make?",
    answer:
      "You do. By entering you allow Blockfest Africa and Monica to reshare it with credit. The full terms are on the rules page.",
  },
  {
    question: "When does the campaign end?",
    answer:
      "The campaign runs from 14 September to 17 October 2026. The final challenge closes on 17 October, after which final leaderboard judging takes place.",
  },
  {
    question: "How can I get my Monica tag?",
    answer:
      "Your Monica tag is your unique username on Monica. To get yours, download the Monica app and create your account. Your tag will be assigned to you and can be found in your Monica profile. You need your Monica tag to receive rewards.",
  },
  {
    question: "How are the final winners chosen for the grand prize?",
    answer:
      "The final winners are based on the final verified leaderboard. The top five creators with the most points win the grand prizes, subject to final verification.",
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
export const MONICA_FIRST_LEADERBOARD = "Sunday 20 September";

/** Where campaign conversation happens, and how entries are found. */
export const MONICA_HASHTAGS = ["#TheMoneyStory", "#AreYouSkillful"] as const;
