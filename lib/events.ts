// Event types and data for Blockfest Africa events

import { TICKET_PLATFORM_URL } from "./tickets";

export interface BlockfestEvent {
  id: string;
  year: number;
  name: string;
  tagline: string;
  theme: string;
  location: {
    city: string;
    country: string;
    countryCode: string;
    venue?: string;
    address?: string;
  };
  date: {
    start: string; // ISO date string
    end?: string;
    displayDate: string;
  };
  registrationUrl?: string;
  recapUrl?: string; // link to the post-event recap page, when completed
  status: "upcoming" | "completed" | "cancelled";
  stats?: EventStats;
  sponsorshipPackages?: SponsorshipPackage[];
  highlights?: string[];
}

// A programming track for an edition (e.g. Lagos '26 tracks).
export interface EventTrack {
  title: string;
  description: string;
}

// A phase in the festival timeline (hackathon, conference day, mixer, ...).
export interface FestivalPhase {
  dates: string;
  title: string;
  location: string;
  description: string;
}

export interface EventStats {
  totalRegistrations?: number;
  totalAttendees?: number;
  physicalAttendees?: number;
  virtualAttendees?: number;
  speakers?: number;
  exhibitors?: number;
  countriesRepresented?: number;
  twitterImpressions?: number;
  tiktokImpressions?: number;
  instagramImpressions?: number;
  youtubeViewers?: number;
}

export interface SponsorshipPackage {
  name: string;
  price: number;
  currency: string;
  emoji?: string;
  features: string[];
  spotsAvailable?: number;
}

// Blockfest 2025 - Lagos (Completed)
export const blockfest2025Lagos: BlockfestEvent = {
  id: "blockfest-2025-lagos",
  year: 2025,
  name: "Blockfest Africa 2025",
  tagline: "BUIDL • BRIDGE • BECOME",
  theme: "Africa's Biggest Web3 Festival",
  location: {
    city: "Lagos",
    country: "Nigeria",
    countryCode: "NG",
    venue: "Landmark Event Center",
    address: "Landmark Event Center, Lagos, Nigeria",
  },
  date: {
    start: "2025-10-11T08:00:00+01:00",
    end: "2025-10-11T18:00:00+01:00",
    displayDate: "October 11th, 2025",
  },
  status: "completed",
  stats: {
    totalRegistrations: 15000,
    totalAttendees: 12000,
    physicalAttendees: 5000,
    virtualAttendees: 7200,
    speakers: 20,
    exhibitors: 20,
    countriesRepresented: 54,
    twitterImpressions: 2200000,
    tiktokImpressions: 400000,
    instagramImpressions: 100000,
    youtubeViewers: 7200,
  },
  highlights: [
    "Over 12,000 attendees from 54+ countries",
    "20+ world-class speakers",
    "Director General of SEC Nigeria delivered keynote",
    "Lagos State Commissioner for Youth & Social Development in attendance",
    "2.2M+ Twitter impressions",
    "Historic gathering of Africa's Web3 ecosystem",
  ],
};

// Blockfest 2026 - South Africa / Cape Town (Upcoming)
export const blockfest2026SouthAfrica: BlockfestEvent = {
  id: "blockfest-2026-cape-town",
  year: 2026,
  name: "Blockf3st Africa '26 - Cape Town",
  tagline: "Web3 In Motion - From Pipelines to Platforms",
  theme: "The Superbowl of Web3",
  location: {
    city: "Cape Town",
    country: "South Africa",
    countryCode: "ZA",
    venue: "Cape Town, South Africa",
  },
  date: {
    start: "2026-05-05T10:00:00+02:00",
    end: "2026-05-11T18:00:00+02:00",
    displayDate: "May 5-11, 2026",
  },
  recapUrl: "/blockfest-south-africa-2026",
  status: "completed",
  // TODO: replace these placeholder figures with the final Cape Town roadshow numbers.
  stats: {
    physicalAttendees: 500,
    countriesRepresented: 5,
    speakers: 15,
  },
  sponsorshipPackages: [
    {
      name: "Diamond",
      price: 15000,
      currency: "USD",
      emoji: "💎",
      features: [
        "10 minutes product keynote to 5,000+ attendees",
        "4m by 2m custom made booth",
        "2 minutes promotional video",
        "Exclusive meeting room + pre event VIP dinner",
        "Logo on livestream, stage, swag bags and Road to Blockf3st 2026 events",
        "Guaranteed media coverage in more than 6 publications",
        "10 social media mentions and 1 X (Twitter) space",
        "Post event tweet analytics of Blockf3st's X sponsorship post",
      ],
    },
    {
      name: "Gold",
      price: 10000,
      currency: "USD",
      emoji: "🥇",
      features: [
        "7 minutes product keynote to 5,000+ attendees",
        "2m by 2m custom made booth",
        "2 minutes promotional video",
        "Exclusive meeting room + pre event VIP dinner",
        "Logo on livestream, stage, swag bags and Road to Blockf3st 2026 events",
        "Guaranteed media coverage in 3 publications",
        "5 social media mentions and 1 X (Twitter) space",
        "Post event tweet analytics of Blockf3st's X sponsorship post",
      ],
    },
    {
      name: "Silver",
      price: 5000,
      currency: "USD",
      emoji: "🥈",
      features: [
        "5 minutes product keynote to 5,000+ attendees",
        "3m by 4m custom made booth",
        "Logo on livestream at the back of the hall",
        "Guaranteed media coverage in 2 publications",
      ],
    },
    {
      name: "Exclusive Mixer",
      price: 5000,
      currency: "USD",
      emoji: "🍸",
      features: [
        "200-300 high net worth attendees (founders, government officials, KOLs etc)",
        "Pre-qualified introductions to key prospects",
        "Perfect for deal making and partnerships",
        "Friday, 8th of May 2026",
      ],
    },
  ],
  highlights: [
    "Blockf3st Africa's first South African roadshow",
    "A week of builder meetups, sessions and experiences across Cape Town",
    "Connected African and global Web3 communities on the ground",
    "Founders, builders and ecosystem partners from across the continent",
    "Set the stage for the Lagos main event in October",
  ],
};

// Blockfest 2026 - Lagos (Upcoming)
export const blockfest2026Lagos: BlockfestEvent = {
  id: "blockfest-2026-lagos",
  year: 2026,
  name: "Blockf3st Africa '26 - Lagos",
  tagline: "New Trade Routes: Bringing Africa Onchain",
  theme: "The Superbowl of Web3",
  location: {
    city: "Lagos",
    country: "Nigeria",
    countryCode: "NG",
    venue: "National Art Theatre, Lagos",
  },
  date: {
    start: "2026-10-22T08:00:00+01:00",
    end: "2026-10-24T22:00:00+01:00",
    displayDate: "October 22–24, 2026",
  },
  registrationUrl: TICKET_PLATFORM_URL,
  status: "upcoming",
  highlights: [
    "Three days: Workshop + The Back Room (Oct 22), the Conference & Convention (Oct 23) and the Mixer (Oct 24)",
    "Reaching Africa's 200M+ Web3 and AI users of tomorrow",
    "Six tracks spanning AI, policy, funding, infrastructure, culture and talent",
    "Part of a three-week festival of hackathons, co-working and programming",
  ],
};

// Lagos '26 programming tracks (deck: "What We'll Be Talking About").
export const lagos2026Tracks: EventTrack[] = [
  {
    title: "AI & Crypto",
    description:
      "Where intelligence meets ownership. Exploring the convergence reshaping the next decade.",
  },
  {
    title: "Government & Policy",
    description:
      "Direct dialogue with regulators, lawmakers, and ecosystem shapers.",
  },
  {
    title: "Investment & Funding",
    description:
      "Bridging founders with the capital fueling Africa's next wave.",
  },
  {
    title: "Technical Infrastructure",
    description:
      "The protocols, primitives, and rails powering what comes next.",
  },
  {
    title: "Creative Economy",
    description: "Music, art, fashion, and culture meeting Web3 and AI.",
  },
  {
    title: "Talent & Career Launchpad",
    description:
      "Where Africa's brightest builders meet their next opportunity.",
  },
];

// Lagos '26 festival timeline — three weeks of programming, one week in Lagos.
export const lagos2026Festival: FestivalPhase[] = [
  // {
  //   dates: "Sep 28 – Oct 12",
  //   title: "Hackathon",
  //   location: "Virtual",
  //   description:
  //     "Builders from across Africa shipping real products with real prizes.",
  // },
  // {
  //   dates: "Oct 5 – Oct 9",
  //   title: "Co-Working Week",
  //   location: "Lagos",
  //   description: "Open workspace for hackathon participants.",
  // },
  // {
  //   dates: "Oct 13 – Oct 18",
  //   title: "Hackathon Review",
  //   location: "Virtual",
  //   description: "Judging, demos, and finalist selection.",
  // },
  {
    dates: "Thu, Oct 22",
    title: "Workshop + The Back Room",
    location: "Lagos",
    description: "Hands-on workshops and the Founders Corner.",
  },
  {
    dates: "Fri, Oct 23",
    title: "Main Conference & Convention",
    location: "Lagos",
    description: "Keynotes, tracks and the expo floor.",
  },
  {
    dates: "Sat, Oct 24",
    title: "The Mixer",
    location: "Lagos",
    description: "Closing celebration. Deals get done here.",
  },
];

// Market opportunity data for sponsorship materials
export const marketOpportunity = {
  unbankedPopulation: {
    percentage: 57,
    description: "of Nigerians are unbanked - prime web3 adoption potential",
  },
  youngPopulation: {
    percentage: 70,
    description: "of the population are under 30 - prime web3 demographic",
  },
  globalWeb3Market: {
    value: "3.3 Tn",
    description: "Global web3 market - Africa holds a large piece",
  },
  africaEconomy: {
    description: "Nigeria is Africa's largest economy and tech hub",
  },
};

// Sponsor benefits
export const sponsorBenefits = [
  {
    title: "5+ Countries Represented",
    description:
      "Show your brand at an event with over 5 countries and over 1,000 expected attendees",
    icon: "🌍",
  },
  {
    title: "Increased Visibility",
    description: "10x your brand's visibility with the African ecosystem",
    icon: "📈",
  },
  {
    title: "Increased Onboarding Rate",
    description:
      "Triple your onboarding, awareness and promotion of your product or protocol",
  },
  {
    title: "The Untapped Market",
    description: "Gain access to Africa's $3.3Tn Web3 goldmine",
    icon: "💎",
  },
  {
    title: "Deepened Skill Pool",
    description:
      "70% of attendees are decision makers from founders to government officials",
    icon: "👥",
  },
  {
    title: "Top Tier Engagement",
    description:
      "Over 1000 pre-registered attendees offer an invaluable market",
    icon: "🎯",
  },
];

// What makes Blockfest different
export const uniqueSellingPoints = [
  "Web3 event focused on African Solutions",
  "Government Backing and policy influence",
  "Year-round community not just a single day",
  "Gateway to entire African market (30+ countries)",
  "Direct access to Africa's top web3 talent",
];

// Helper functions
export function getUpcomingEvents(): BlockfestEvent[] {
  return [blockfest2026SouthAfrica, blockfest2026Lagos].filter(
    (e) => e.status === "upcoming"
  );
}

export function getNextEvent(): BlockfestEvent | undefined {
  const upcoming = getUpcomingEvents();
  return upcoming.sort(
    (a, b) =>
      new Date(a.date.start).getTime() - new Date(b.date.start).getTime()
  )[0];
}

export function getPastEvents(): BlockfestEvent[] {
  return [blockfest2026SouthAfrica, blockfest2025Lagos]
    .filter((e) => e.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.date.start).getTime() - new Date(a.date.start).getTime()
    );
}

export function formatEventStats(
  stats: EventStats
): { value: string; label: string }[] {
  const formatted: { value: string; label: string }[] = [];

  if (stats.totalRegistrations) {
    formatted.push({
      value:
        stats.totalRegistrations >= 1000
          ? `${(stats.totalRegistrations / 1000).toFixed(0)}K+`
          : `${stats.totalRegistrations}+`,
      label: "Total Registrations",
    });
  }

  if (stats.totalAttendees) {
    formatted.push({
      value:
        stats.totalAttendees >= 1000
          ? `${(stats.totalAttendees / 1000).toFixed(0)}K+`
          : `${stats.totalAttendees}+`,
      label: "Total Attendees",
    });
  }

  if (stats.speakers) {
    formatted.push({ value: `${stats.speakers}+`, label: "Speakers" });
  }

  if (stats.countriesRepresented) {
    formatted.push({
      value: `${stats.countriesRepresented}+`,
      label: "Countries",
    });
  }

  return formatted;
}
