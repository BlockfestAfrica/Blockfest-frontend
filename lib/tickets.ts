// Blockf3st Africa '26 — Lagos ticketing.
// Single source of truth for tier pricing, inclusions and the checkout link.

/**
 * Every "Get ticket" CTA points here. Keep this bare: it is the canonical URL
 * used in JSON-LD, /llms.txt and the event data. Use ticketUrl() for links a
 * human clicks, so the sale can be attributed.
 */
export const TICKET_PLATFORM_URL = "https://meetumo.ai/e/blockfest-africa-2026";

/**
 * The same URL, tagged so the ticket platform can tell which surface earned the
 * click. Without this every sale looks identical whether it came from the
 * announcement bar, the hero or a specific tier card.
 *
 * `source` is the human label already passed to TicketCTA for on-site
 * analytics, so the two systems agree on naming.
 */
export function ticketUrl(source: string): string {
  const url = new URL(TICKET_PLATFORM_URL);
  url.searchParams.set("utm_source", "blockfestafrica.com");
  url.searchParams.set("utm_medium", "website");
  url.searchParams.set("utm_campaign", "lagos-2026");
  url.searchParams.set(
    "utm_content",
    source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
  return url.toString();
}

/** Early bird pricing ends at the close of this day (WAT). */
export const EARLY_BIRD_ENDS = {
  iso: "2026-08-30T23:59:59+01:00",
  display: "August 30, 2026",
} as const;

/** Consent notice shown at checkout — mirrored here so both read the same. */
export const PHOTOGRAPHY_NOTICE =
  "Photos, videos and livestreams will be captured throughout Blockfest Africa 2026. By attending, you consent to appearing in event photography and recordings, which may be used across our website, social media, marketing materials and post-event publications.";

/** Tickets stop being transferable at this point. */
export const TRANSFER_DEADLINE = {
  iso: "2026-10-16T18:00:00+01:00",
  display: "October 16, 2026 at 6:00 PM WAT",
  /** Date alone, for footnotes where the time would crowd the line. */
  displayShort: "October 16, 2026",
} as const;

export type TicketGroupId = "conference" | "workshop" | "vip";

export interface TicketGroup {
  id: TicketGroupId;
  title: string;
  description: string;
  icon: "presentation" | "wrench" | "crown";
}

export interface TicketTier {
  id: string;
  name: string;
  group: TicketGroupId;
  /** What you pay today. */
  price: number;
  /** Struck-through price when a discount is running. */
  standardPrice?: number;
  /** Badge copy for the discount, e.g. "25% OFF". Omitted when there is none. */
  discountLabel?: string;
  /** Which days the pass covers, e.g. "Day 2 · Conference". */
  days: string;
  includes: string[];
  /** Stated plainly on the card. A day-limited pass must say what it is not. */
  excludes?: string[];
  /** Sells the most. Distinct from `featured`, which marks the pick of a group. */
  bestSeller?: boolean;
  bestFor: string;
  /** Highlighted as the recommended pick within its group. */
  featured?: boolean;
}

export const ticketGroups: TicketGroup[] = [
  {
    id: "conference",
    title: "Conference Day",
    icon: "presentation",
    description:
      "Friday, October 23. Main stage and exhibition floor.",
  },
  {
    id: "workshop",
    title: "Workshop & The Back Room",
    icon: "wrench",
    description:
      "Thursday, October 22. Workshops in the morning, the closed-door founder and investor room in the evening.",
  },
  {
    id: "vip",
    title: "VIP & All Access",
    icon: "crown",
    description:
      "Priority entry, the speakers lounge, and the rooms where introductions happen.",
  },
];

export const ticketTiers: TicketTier[] = [
  // ——— Day 2: Conference ———
  {
    id: "buidl-pass",
    name: "BUIDL PASS",
    group: "conference",
    price: 7_500,
    standardPrice: 10_000,
    discountLabel: "25% OFF",
    days: "Day 2 · Conference Day",
    includes: ["Access to the main stage and exhibition area"],
    bestFor:
      "Students, beginners, career switchers, and anyone exploring Web3, AI or tech for the first time.",
  },
  {
    id: "bridge-pass",
    name: "BRIDGE PASS",
    bestSeller: true,
    group: "conference",
    price: 15_000,
    standardPrice: 20_000,
    discountLabel: "25% OFF",
    days: "Day 2 · Conference Day",
    includes: ["Access to the main stage and exhibition area", "Lunch"],
    bestFor:
      "Operators, engineers and marketers past the basics, who want the sessions that move their work forward and the lunch where conversations start.",
  },
  {
    id: "become-pass",
    name: "BECOME PASS",
    group: "conference",
    price: 26_250,
    standardPrice: 35_000,
    discountLabel: "25% OFF",
    days: "Day 2 · Conference Day",
    includes: [
      "Access to the main stage and exhibition area",
      "Lunch",
      "Event merch",
    ],
    bestFor:
      "Professionals, creators and growth operators who want the complete conference day without the VIP price.",
    featured: true,
  },
  {
    id: "corporate-circle",
    name: "CORPORATE CIRCLE",
    group: "conference",
    price: 150_000,
    standardPrice: 175_000,
    days: "Day 2 · Conference Day · 5 BECOME PASS tickets",
    includes: [
      "Access to the main stage and exhibition area",
      "Lunch",
      "Event merch",
      "5 × BECOME PASS tickets",
    ],
    bestFor:
      "Companies sending a delegation. One purchase covers five people.",
  },

  // ——— Day 1: Workshop & The Back Room ———
  {
    id: "buidl-plus",
    name: "BUIDL PLUS",
    group: "workshop",
    price: 11_250,
    standardPrice: 15_000,
    discountLabel: "25% OFF",
    days: "Day 1 Morning · Workshop + Day 2 · Conference",
    includes: [
      "Everything in the BUIDL PASS",
      "Access to the workshop and breakfast on Day 1",
    ],
    bestFor:
      "Developers, designers, marketers, technical founders and community managers who learn best by doing.",
  },
  {
    id: "become-plus",
    name: "BECOME PLUS",
    group: "workshop",
    price: 30_000,
    standardPrice: 40_000,
    discountLabel: "25% OFF",
    days: "Day 1 Morning · Workshop + Day 2 · Conference",
    includes: [
      "Everything in the BECOME PASS",
      "Access to the workshop and breakfast on Day 1",
    ],
    bestFor:
      "Builders and creators who want the hands-on workshop plus the full conference day, merch and lunch included.",
    featured: true,
  },
  {
    id: "founder-circle",
    name: "FOUNDER CIRCLE",
    group: "workshop",
    price: 33_750,
    standardPrice: 45_000,
    discountLabel: "25% OFF",
    days: "Day 1 Evening · The Back Room only",
    includes: [
      "Access to pitch for funding",
      "Direct access to investors and high-growth startups",
      "A personalised experience away from the crowd",
    ],
    excludes: ["The Day 2 conference and exhibition floor"],
    bestFor:
      "Founders, angel investors, fund managers and ecosystem operators. The closed room where funding conversations happen.",
  },

  // ——— VIP & All Access ———
  {
    id: "prime-pass",
    name: "PRIME PASS",
    group: "vip",
    price: 150_000,
    days: "Day 2 VIP · Conference Day only",
    includes: [
      "Access to the main stage and exhibition area",
      "Event merch",
      "Access to the VIP and speakers room",
      "Buffet lunch",
      "Priority check-in and private entry",
    ],
    bestFor:
      "Executives and investors coming for Day 2 alone who want priority entry and the speakers lounge.",
  },
  {
    id: "exec-pass",
    name: "EXEC PASS",
    group: "vip",
    price: 160_000,
    days: "Day 1 Morning · Workshop + Day 2 VIP · Conference",
    includes: [
      "Access to the workshop and breakfast on Day 1",
      "Access to the main stage and exhibition area on Day 2",
      "Event merch",
      "Access to the VIP and speakers room",
      "Buffet lunch",
      "Priority check-in and private entry",
    ],
    bestFor:
      "Founders and executives who want the workshops and VIP conference access across both days.",
  },
  {
    id: "all-access",
    name: "ALL ACCESS PASS",
    group: "vip",
    price: 185_000,
    days: "Day 1 Workshop & Back Room + Day 2 VIP Conference + Day 3 Mixer",
    includes: [
      "Access to the workshop and breakfast on Day 1",
      "Access to the main conference and exhibition area on Day 2",
      "Exclusive access to angel investors, fund managers and VCs",
      "Event merch",
      "Access to the VIP and speakers room",
      "Buffet lunch",
      "Priority check-in and private entry",
      "Industry mixer",
    ],
    bestFor:
      "Founders, investors and senior operators who plan to be in Lagos for all three days.",
    featured: true,
  },
];

/** What BlockFest is built for — the buidl / bridge / become framing. */
export const ticketPillars = [
  {
    word: "BUIDL",
    description: "companies, products, careers, and communities.",
  },
  {
    word: "BRIDGE",
    description: "Africa with global capital, technology, and opportunity.",
  },
  {
    word: "BECOME",
    description: "part of the network shaping the continent's next decade.",
  },
] as const;

/** Who the room is built for. Icon keys resolve to lucide components. */
export const idealAudience = [
  {
    title: "Founders",
    icon: "rocket",
    description:
      "Building global companies and ready to raise from anyone, anywhere.",
  },
  {
    title: "Engineers",
    icon: "code",
    description:
      "Building AI, Web3 and infrastructure products that compete on a global stage.",
  },
  {
    title: "Investors",
    icon: "trending-up",
    description:
      "Deploying capital into Africa's fastest-growing companies, before the round is announced.",
  },
  {
    title: "Corporate Leaders & Professionals",
    icon: "briefcase",
    description:
      "Breaking into global careers, high-growth companies and the rooms where opportunities are created.",
  },
  {
    title: "Ecosystem Operators",
    icon: "network",
    description: "Scaling teams, products, and revenue across multiple markets.",
  },
  {
    title: "Creators & Artistes",
    icon: "palette",
    description:
      "Turning culture into capital through music, media, fashion and digital ownership.",
  },
  {
    title: "Policymakers & Regulators",
    icon: "landmark",
    description:
      "Designing frameworks for innovation, investment and cross-border digital trade.",
  },
  {
    title: "Marketers & Growth Operators",
    icon: "megaphone",
    description:
      "Driving adoption, distribution and revenue for products, startups and global brands.",
  },
  {
    title: "Designers",
    icon: "pen-tool",
    description:
      "Shaping the interfaces and experiences defining the next generation of African technology.",
  },
  {
    title: "Media & Storytellers",
    icon: "mic",
    description:
      "Documenting the people and companies shaping Africa's next technology chapter.",
  },
  {
    title: "Students & Emerging Talent",
    icon: "graduation-cap",
    description:
      "Building the skills and network needed to compete globally.",
  },
] as const;

/** Naira formatting — no decimals, e.g. ₦26,250. */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

/** Cheapest ticket on sale — used for schema.org offers and hero copy. */
export const lowestTicketPrice = Math.min(
  ...ticketTiers.map((tier) => tier.price)
);

export function tiersInGroup(groupId: TicketGroupId): TicketTier[] {
  return ticketTiers.filter((tier) => tier.group === groupId);
}

/**
 * Passes that actually carry the 25% early-bird cut.
 *
 * CORPORATE CIRCLE is discounted off its standard rate but is not an early
 * bird, and the four VIP passes have one price, so "early bird" copy must say
 * how many passes it covers rather than implying all ten.
 */
export const earlyBirdTiers = ticketTiers.filter((tier) => tier.discountLabel);
export const EARLY_BIRD_COUNT = earlyBirdTiers.length;
