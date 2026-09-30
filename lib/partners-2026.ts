/**
 * Who is backing Blockfest Africa 2026.
 *
 * Two lists, not a category per kind of partner. Sponsors are drawn larger,
 * in the order they appear here, with their tier under the logo; partners
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
  /** Shown under the logo as "{tier} sponsor": Headline, Gold, Mobility. */
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
];

/** Media, community, government and ecosystem partners, in one wall. */
export const partners: Partner[] = [
  { name: "AllConfsBot", kind: "Media", logo: "/2026/logos/allconfsbot.png", width: 1280, height: 457, href: "https://x.com/allconfsbot" },
  { name: "Blockchain Marketing Ninja", kind: "Media", logo: "/2026/logos/blockchain-marketing-ninja.png", width: 1280, height: 331, href: "https://x.com/0xblockchainmkt" },
  { name: "Blockchain Staffing Ninja", kind: "Media", logo: "/2026/logos/blockchain-staffing-ninja.png", width: 952, height: 262, href: "https://x.com/staffing_Ninja" },
  { name: "CoinGabbar", kind: "Media", logo: "/2026/logos/coingabbar.png", width: 1280, height: 447, href: "https://x.com/coin_gabbar_" },
  { name: "CoinNewsSpan", kind: "Media", logo: "/2026/logos/coinnewsspan.png", width: 300, height: 52, href: "https://x.com/CoinNewsSpan_" },
  { name: "CryptoNewsZ", kind: "Media", logo: "/2026/logos/cryptonewsz.png", width: 300, height: 64, href: "https://x.com/cryptonewsz_" },
  { name: "Times of Blockchain", kind: "Media", logo: "/2026/logos/times-of-blockchain.png", width: 300, height: 76, href: "https://x.com/TimesOfBlockC_" },
];
