/**
 * Who is backing Blockfest Africa 2026.
 *
 * Two lists, not a category per kind of partner. Sponsors are drawn larger,
 * in the order they appear here; only the headline's tile names its tier
 * ("Headline sponsor"), the rest line up without a label; partners
 * share one wall with nothing under each logo, and the wall's heading names
 * the kinds it holds ("Media, community & government partners"). A new
 * government or community partner is one more line in `partners`, not a new
 * section on the page.
 *
 * Logos sit on white tiles. Run a new file through scripts/logos-on-white.mjs
 * first: it trims the empty canvas (a logo with lots of it renders as a speck)
 * and prints the width and height to copy here, which the wall uses to size
 * wide wordmarks and square marks so they carry the same weight.
 */

export interface PartnerLogo {
  /** The partner's name. It is the logo's alt text and the link's label. */
  name: string;
  logo: string;
  /** The artwork's size in pixels, as scripts/logos-on-white.mjs prints it. */
  width: number;
  height: number;
  /** Where the logo links: the partner's X profile or site. */
  href?: string;
}

export interface Sponsor extends PartnerLogo {
  /** Headline, Gold, Mobility. Only the headline's is shown, as "Headline
      sponsor"; the rest are kept for the record and the order. */
  tier: string;
}

export type PartnerKind = "Media" | "Community" | "Government" | "Ecosystem";

export interface Partner extends PartnerLogo {
  /** Names the wall's heading ("Media & government partners"); not shown per logo. */
  kind: PartnerKind;
}

/** The headline sponsor, featured on its own. */
export const headline: Sponsor | null = {
  name: "Monica",
  tier: "Headline",
  logo: "/2026/logos/monica.png",
  width: 1280,
  height: 243,
  href: "https://x.com/monicanigeria",
};

/** Every other sponsor, highest tier first. */
export const sponsors: Sponsor[] = [
  {
    name: "Cake Wallet",
    tier: "Silver",
    logo: "/2026/sponsors/cw.svg",
    width: 5000,
    height: 1250,
    href: "https://x.com/cakewallet",
  },
  {
    name: "Rovv",
    tier: "Mobility",
    logo: "/2026/logos/rovv.png",
    width: 748,
    height: 167,
    href: "https://x.com/rovvafrica",
  },
  {
    name: "Hoaq",
    tier: "Investment",
    logo: "/2026/logos/hoaq.png",
    width: 856,
    height: 255,
    href: "https://x.com/hoaqclub",
  },
  {
    name: "Revva",
    tier: "Gaming",
    logo: "/2026/logos/reeva.PNG",
    width: 528,
    height: 154,
    href: "https://x.com/myrevva",
  },
];

/**
 * Media, community, government and ecosystem partners, in one wall.
 *
 * Lagos State and the national press lead: they were 2025 partners and are
 * confirmed again for 2026, and their logos are the white-tile copies
 * already prepared for the 2025 wall. A lone government partner goes in this
 * wall, not a section of its own: the heading then reads "Media & government
 * partners".
 */
export const partners: Partner[] = [
  { name: "Lagos State Government", kind: "Government", logo: "/images/partners-2025/lagos-state.png", width: 149, height: 149, href: "https://lagosstate.gov.ng" },
  { name: "Hashed Emergent", kind: "Ecosystem", logo: "/2026/logos/hashed-emergent.png", width: 1280, height: 405, href: "https://x.com/HashedEM" },
  { name: "BusinessDay", kind: "Media", logo: "/images/partners-2025/businessday.png", width: 1280, height: 267, href: "https://businessday.ng" },
  { name: "The Guardian", kind: "Media", logo: "/images/partners-2025/guardian.png", width: 1280, height: 156, href: "https://guardian.ng" },
  { name: "Legit", kind: "Media", logo: "/images/partners-2025/legit.png", width: 841, height: 330, href: "https://www.legit.ng" },
  { name: "TechCabal", kind: "Media", logo: "/images/partners-2025/techcabal.png", width: 480, height: 480, href: "https://techcabal.com" },
  { name: "Techpoint", kind: "Media", logo: "/images/partners-2025/techpoint.png", width: 407, height: 480, href: "https://techpoint.africa" },
  { name: "Punch", kind: "Media", logo: "/images/partners-2025/punch.png", width: 1226, height: 362, href: "https://punchng.com" },
  { name: "AllConfsBot", kind: "Media", logo: "/2026/logos/allconfsbot.png", width: 1280, height: 457, href: "https://x.com/allconfsbot" },
  { name: "Blockchain Marketing Ninja", kind: "Media", logo: "/2026/logos/blockchain-marketing-ninja.png", width: 1280, height: 331, href: "https://x.com/0xblockchainmkt" },
  { name: "Blockchain Staffing Ninja", kind: "Media", logo: "/2026/logos/blockchain-staffing-ninja.png", width: 952, height: 262, href: "https://x.com/staffing_Ninja" },
  { name: "CoinGabbar", kind: "Media", logo: "/2026/logos/coingabbar.png", width: 1280, height: 447, href: "https://x.com/coin_gabbar_" },
  { name: "CoinNewsSpan", kind: "Media", logo: "/2026/logos/coinnewsspan.png", width: 300, height: 52, href: "https://x.com/CoinNewsSpan_" },
  { name: "CryptoNewsZ", kind: "Media", logo: "/2026/logos/cryptonewsz.png", width: 300, height: 64, href: "https://x.com/cryptonewsz_" },
  { name: "Times of Blockchain", kind: "Media", logo: "/2026/logos/times-of-blockchain.png", width: 300, height: 76, href: "https://x.com/TimesOfBlockC_" },
];
