export interface PartnerLogo {
  logo: string; 
  twitter?: string; 
}

export interface PartnerData {
  headline: PartnerLogo[]; 
  silver: PartnerLogo[];
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
  // community: [
  //
  // ],
  // media: [
  //
  // ],
  // ecosystem: [
  //
  // ],
};