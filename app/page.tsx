import React from "react";
import type { Metadata } from "next";
import { HeroSection2026 } from "@/components/home/hero-2026";
import { Lagos2026Section } from "@/components/home/lagos-2026";
import { Tickets2026Section } from "@/components/home/tickets-2026";
import { Stats2026Section } from "@/components/home/stats-2026";
import { SocialProofStrip } from "@/components/home/social-proof-strip";
import { SouthAfricaRecapSection } from "@/components/home/south-africa-recap";
import { WhyAttend2026Section } from "@/components/home/why-attend-2026";
import { SpeakersSection } from "@/components/home/speakers";
import { PartnersSection } from "@/components/home/partners";
import { SponsorshipSection } from "@/components/home/sponsorship";
import { FAQSection } from "@/components/home/faq";
import {
  EventSchema,
  OrganizationSchema,
  WebsiteSchema,
} from "@/components/seo/schema-markup-2026";

export const metadata: Metadata = {
  title: "Blockf3st Africa 2026 - The Superbowl of Web3",
  description:
    "Tickets are live for Africa's biggest Web3 and AI festival. Lagos, October 22–24, 2026. Three days of building, networking and dealmaking. Passes from ₦7,500, early bird until August 30.",
  keywords: [
    "blockfest africa 2026",
    "blockf3st africa",
    "blockchain conference africa",
    "web3 africa 2026",
    "cryptocurrency conference",
    "blockchain south africa",
    "web3 cape town",
    "blockchain events nigeria",
    "defi conference africa",
    "nft event africa",
    "bitcoin conference",
    "ethereum africa",
    "blockchain developers africa",
    "crypto investors africa",
    "fintech conference south africa",
    "blockchain startup africa",
    "web3 developers",
    "superbowl of web3",
    "web3 in motion",
    "blockfest africa tickets",
    "blockfest 2026 tickets",
  ],
  openGraph: {
    title: "Blockf3st Africa 2026 - The Superbowl of Web3",
    description:
      "Tickets are live. 🇳🇬 Lagos, October 22–24, 2026. Three days with 5,000+ founders, engineers and investors. Passes from ₦7,500, early bird until August 30.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Blockf3st Africa 2026 - The Superbowl of Web3",
      },
    ],
  },
  twitter: {
    title: "Blockf3st Africa 2026 - The Superbowl of Web3",
    description:
      "Tickets are live. 🇳🇬 Lagos, October 22–24, 2026. Three days with 5,000+ founders, engineers and investors. Passes from ₦7,500, early bird until August 30.",
    images: ["/images/twitter-image.jpg"],
  },
};

const HomePage = () => {
  return (
    <>
      {/* Schema Markup for SEO */}
      <EventSchema />
      <OrganizationSchema />
      <WebsiteSchema />

      <main id="main">
        {/* Poster hero: what it is, when, and the one action */}
        <HeroSection2026 />

        {/* What Lagos '26 is centered around */}
        <Lagos2026Section />

        {/* The ask, while intent is high */}
        <Tickets2026Section />

        {/* Credibility: who has stood on this stage */}
        <SpeakersSection />

        {/* Proof, in three registers: the room, the numbers, the roadshow */}
        <SocialProofStrip />
        <Stats2026Section />
        <SouthAfricaRecapSection />

        {/* The argument for coming */}
        <WhyAttend2026Section />

        {/* Trust, then objections */}
        <PartnersSection />
        <FAQSection />

        {/* B2B ask last: a different audience to everything above */}
        <SponsorshipSection />
      </main>
    </>
  );
};

export default HomePage;
