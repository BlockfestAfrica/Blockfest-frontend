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
  /**
   * False keeps the logo off the Get DP picture while it stays on the
   * website's wall (the team, 9 October: the DP carries a shorter media list
   * than the wall). On the logo itself, not on Partner, so a sponsor can use
   * it too.
   */
  onDp?: boolean;
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
  {
    name: "Web3Afrika",
    tier: "Community",
    logo: "/2026/logos/web3afrika.png",
    width: 572,
    height: 480,
    href: "https://web3afrika.com",
  },
  {
    name: "Women in DeFi",
    tier: "Community",
    logo: "/2026/logos/wid.png",
    width: 654,
    height: 480,
    href: "https://womenindefi.org/",
  },
  {
    name: "Inside The Hive",
    tier: "Community",
    logo: "/2026/logos/inside-the-hive.png",
    width: 313,
    height: 337,
    href: "https://x.com/InsideDHive",
  },
  {
    name: "Web3Bridge",
    tier: "Community",
    logo: "/2026/logos/web3bridge.png", width: 1280,
    height: 457,
    href: "https://www.web3bridgeafrica.com/"
  },
  /* Moved here from `partners` (the team, 9 October): the government,
     ecosystem and media partners are now sponsors, tiered by what they were
     (the tier is kept for the record and the order; it is not shown). The
     media the DP leaves out stay off it with onDp: false. */
  { name: "Lagos State Government", tier: "Government", logo: "/images/partners-2025/lagos-state.png", width: 149, height: 149, href: "https://lagosstate.gov.ng" },
  { name: "Hashed Emergent", tier: "Ecosystem", logo: "/2026/logos/hashed-emergent.png", width: 1280, height: 405, href: "https://x.com/HashedEM" },
  { name: "Microtraction", tier: "Ecosystem", logo: "/2026/logos/microtraction.png", width: 532, height: 331, href: "https://x.com/microtraction" },
  { name: "BusinessDay", tier: "Media", logo: "/images/partners-2025/businessday.png", width: 1280, height: 267, href: "https://businessday.ng", onDp: false },
  { name: "The Guardian", tier: "Media", logo: "/images/partners-2025/guardian.png", width: 1280, height: 156, href: "https://guardian.ng", onDp: false },
  { name: "Legit", tier: "Media", logo: "/images/partners-2025/legit.png", width: 841, height: 330, href: "https://www.legit.ng", onDp: false },
  { name: "TechCabal", tier: "Media", logo: "/images/partners-2025/techcabal.png", width: 480, height: 480, href: "https://techcabal.com", onDp: false },
  { name: "Techpoint", tier: "Media", logo: "/images/partners-2025/techpoint.png", width: 407, height: 480, href: "https://techpoint.africa" },
  { name: "Punch", tier: "Media", logo: "/images/partners-2025/punch.png", width: 1226, height: 362, href: "https://punchng.com", onDp: false },
  { name: "AllConfsBot", tier: "Media", logo: "/2026/logos/allconfsbot.png", width: 1280, height: 457, href: "https://x.com/allconfsbot" },
  { name: "Blockchain Marketing Ninja", tier: "Media", logo: "/2026/logos/blockchain-marketing-ninja.png", width: 1280, height: 331, href: "https://x.com/0xblockchainmkt" },
  { name: "Blockchain Staffing Ninja", tier: "Media", logo: "/2026/logos/blockchain-staffing-ninja.png", width: 952, height: 262, href: "https://x.com/staffing_Ninja" },
  { name: "CoinGabbar", tier: "Media", logo: "/2026/logos/coingabbar.png", width: 1280, height: 447, href: "https://x.com/coin_gabbar_" },
  { name: "CoinNewsSpan", tier: "Media", logo: "/2026/logos/coinnewsspan.png", width: 300, height: 52, href: "https://x.com/CoinNewsSpan_" },
  { name: "CryptoNewsZ", tier: "Media", logo: "/2026/logos/cryptonewsz.png", width: 300, height: 64, href: "https://x.com/cryptonewsz_" },
  { name: "Times of Blockchain", tier: "Media", logo: "/2026/logos/times-of-blockchain.png", width: 300, height: 76, href: "https://x.com/TimesOfBlockC_" },
];

/**
 * Media, community, government and ecosystem partners, in one wall.
 *
 * Empty for now: everyone who was here (Lagos State, the ecosystem and media
 * partners) was moved into `sponsors` on 9 October. The wall, the home page
 * and the Get DP footer all handle an empty list, so a partner added here
 * later appears again with no other change.
 */
export const partners: Partner[] = [];
