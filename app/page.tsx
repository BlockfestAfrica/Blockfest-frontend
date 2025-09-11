import React from "react";
import type { Metadata } from "next";
import { HeroSection } from "@/components/home/hero";
import { StatsSection } from "@/components/home/stat";
import { CountdownGallerySection } from "@/components/home/countdown-gallery";
import { WhyAttendSection } from "@/components/home/why-attend";
import { SpeakersSection } from "@/components/home/speakers";
import { PartnersSection } from "@/components/home/partners";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Join Africa's premier blockchain conference. Connect with builders, founders, investors, and DeFi professionals in Africa. Register now for Blockfest Africa 2025.",
  keywords: [
    "blockfest africa",
    "blockchain conference africa",
    "web3 africa",
    "cryptocurrency conference",
    "blockchain events nigeria",
    "defi conference",
    "nft event africa",
    "bitcoin conference",
    "ethereum africa",
    "blockchain developers",
    "crypto investors africa",
    "fintech conference",
    "blockchain startup",
    "web3 developers",
  ],
  openGraph: {
    title: "Blockfest Africa 2025 - Africa's Premier Blockchain Conference",
    description:
      "Join builders, founders, investors, and enthusiasts shaping the future of Web3 in Africa. Register now!",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Blockfest Africa 2025 Conference",
      },
    ],
  },
  twitter: {
    title: "Blockfest Africa 2025 - Africa's Premier Blockchain Conference",
    description:
      "Join builders, founders, investors, and enthusiasts shaping the future of Web3 in Africa. Register now!",
    images: ["/images/twitter-image.jpg"],
  },
};

const HomePage = () => {
  return (
    <main>
      <HeroSection />
      <StatsSection />
      <CountdownGallerySection />
      <WhyAttendSection />
      <SpeakersSection />
      <PartnersSection />
    </main>
  );
};

export default HomePage;
