export interface PartnerLogo {
  logo: string;
  twitter?: string;
}

export interface PartnerData {
  headline: PartnerLogo[];
  silver: PartnerLogo[];
  mobility?: PartnerLogo[];
  community?: PartnerLogo[];
  media?: PartnerLogo[];
  ecosystem?: PartnerLogo[];
}

export const partners: PartnerData = {
  headline: [
    { logo: "/2026/sponsors/Monica.png", twitter: "https://x.com/monicanigeria?s=21" },
  ],
  silver: [
    { logo: "/2026/sponsors/cw.svg", twitter: "https://x.com/cakewallet?s=11" },
  ],
  mobility: [
    { logo: "/2026/sponsors/rovv.png", twitter: "https://x.com/rovvafrica?s=11" },
  ],
  // community: [
  //
  // ],
  media: [
    { logo: "/2026/media/allconf.png", twitter: "https://x.com/allconfsbot?s=11" },
    { logo: "/2026/media/BMN.png", twitter: "https://x.com/0xblockchainmkt" },
    { logo: "/2026/media/BSN.png", twitter: "https://x.com/staffing_Ninja" },
    { logo: "/2026/media/coingabbar.png", twitter: "https://x.com/coin_gabbar_" },
    { logo: "/2026/media/Coinn.png", twitter: "https://x.com/CoinNewsSpan_" },
    { logo: "/2026/media/Crypto.png", twitter: "https://x.com/cryptonewsz_" },
    { logo: "/2026/media/timesoblock.png", twitter: "https://x.com/TimesOfBlockC_" },


  ],
  // ecosystem: [
  //
  // ],
};