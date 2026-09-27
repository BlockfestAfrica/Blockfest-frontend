/**
 * Who is backing Blockfest Africa 2026, by tier.
 *
 * The home page draws each tier at its own size, largest first, so where a
 * partner sits in this file is where they sit in the hierarchy. Adding one is
 * a matter of adding a line to the right list; an empty or missing list simply
 * does not render.
 */

export interface PartnerLogo {
  /** The partner's name. It is the logo's alt text and the link's label. */
  name: string;
  logo: string;
  twitter?: string;
}

/**
 * A sponsor of one part of the event rather than a sponsorship tier: the
 * mobility sponsor, a wallet sponsor, a hospitality sponsor. `role` is the
 * part. One of them is labelled "{role} Sponsor"; several are grouped as
 * "Official Sponsors" with each role under its logo.
 */
export interface OfficialPartner extends PartnerLogo {
  role: string;
}

export interface PartnerData {
  headline: PartnerLogo[];
  gold?: PartnerLogo[];
  silver?: PartnerLogo[];
  bronze?: PartnerLogo[];
  official?: OfficialPartner[];
  community?: PartnerLogo[];
  media?: PartnerLogo[];
  ecosystem?: PartnerLogo[];
}

export const partners: PartnerData = {
  headline: [
    { name: "Monica", logo: "/2026/sponsors/Monica.png", twitter: "https://x.com/monicanigeria?s=21" },
  ],
  // gold: [],
  silver: [
    { name: "Cake Wallet", logo: "/2026/sponsors/cw.svg", twitter: "https://x.com/cakewallet?s=11" },
  ],
  // bronze: [],
  official: [
    { name: "Rovv", role: "Mobility", logo: "/2026/sponsors/rovv.png", twitter: "https://x.com/rovvafrica?s=11" },
  ],
  // community: [],
  // media: [],
  // ecosystem: [],
};
