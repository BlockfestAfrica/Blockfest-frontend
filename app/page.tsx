import React from "react";
import type { Metadata } from "next";
import { HeroSection2026 } from "@/components/home/hero-2026";
import { Stats2026Section } from "@/components/home/stats-2026";
import { SocialProofStrip } from "@/components/home/social-proof-strip";
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
    "Join Africa's biggest Web3 festival in 2026! Cape Town (May 2026) & Lagos (October 2026). Connect with 200M+ potential web3 users. Web3 In Motion - From Pipelines to Platforms.",
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
      "Join Africa's biggest Web3 festival! 🇿🇦 Cape Town (May 2026) & 🇳🇬 Lagos (October 2026). Web3 In Motion - From Pipelines to Platforms.",
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
      "Join Africa's biggest Web3 festival! 🇿🇦 Cape Town (May 2026) & 🇳🇬 Lagos (October 2026). Web3 In Motion - From Pipelines to Platforms.",
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
        {/* New 2026 Hero with dual event cards */}
        <HeroSection2026 />

        {/* 2025 Stats - Building on Success */}
        <Stats2026Section />

        {/* Social proof photo strip */}
        <SocialProofStrip />

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
