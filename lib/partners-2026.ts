export interface PartnerLogo {
  logo: string; 
  twitter?: string; 
}

export interface PartnerData {
  headline: PartnerLogo[]; 
  community?: PartnerLogo[];
  media?: PartnerLogo[];
  ecosystem?: PartnerLogo[];
}

export const partners: PartnerData = {
  headline: [
    { logo: "/2026/sponsors/Monica.png", twitter: "https://x.com/monicanigeria?s=21" },
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