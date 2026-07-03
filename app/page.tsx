import React from "react";
import type { Metadata } from "next";
import { HeroSection2026 } from "@/components/home/hero-2026";
import { Lagos2026Section } from "@/components/home/lagos-2026";
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
    "Join Africa's biggest Web3 & AI festival in 2026! Lagos (October 22–23, 2026), following the South Africa roadshow. Connect with 200M+ potential web3 users. New Trade Routes: Bringing Africa Onchain.",
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
  ],
  openGraph: {
    title: "Blockf3st Africa 2026 - The Superbowl of Web3",
    description:
      "Join Africa's biggest Web3 & AI festival! 🇳🇬 Lagos (October 22–23, 2026) — fresh off the 🇿🇦 South Africa roadshow. New Trade Routes: Bringing Africa Onchain.",
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
      "Join Africa's biggest Web3 & AI festival! 🇳🇬 Lagos (October 22–23, 2026) — fresh off the 🇿🇦 South Africa roadshow. New Trade Routes: Bringing Africa Onchain.",
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

      <main>
        {/* 2026 Hero — Lagos next event + South Africa recap */}
        <HeroSection2026 />

        {/* What Lagos '26 is centered around — theme, tracks, festival */}
        <Lagos2026Section />

        {/* 2025 Stats - Building on Success */}
        <Stats2026Section />

        {/* Social proof photo strip (South Africa roadshow) */}
        <SocialProofStrip />

        {/* South Africa 2026 recap band */}
        <SouthAfricaRecapSection />

        {/* Why Attend with market opportunity data */}
        <WhyAttend2026Section />

        {/* Sponsorship Packages */}
        <SponsorshipSection />

        {/* Previous Speakers - 2025 lineup */}
        <SpeakersSection />

        {/* Previous Partners - 2025 sponsors */}
        <PartnersSection />

        {/* FAQ */}
        <FAQSection />
      </main>
    </>
  );
};

export default HomePage;
