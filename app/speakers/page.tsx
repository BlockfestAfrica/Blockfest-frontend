import React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { SpeakersGrid } from "@/components/speakers/main-speakers";
import { SpeakersSchema } from "@/components/seo/speakers-schema";
import { BreadcrumbSchema } from "@/components/seo/schema-markup";
import { SpeakersList, type Speaker } from "@/lib/speakers";

const Gotham = localFont({
  src: "../../app/fonts/Gotham-Medium.otf",
});

export const metadata: Metadata = {
  title: "Speakers",
  description:
    "Meet the visionary speakers at Blockfest Africa 2025. Connect with blockchain pioneers, founders, investors, and Web3 leaders driving innovation across Africa.",
  keywords: [
    "blockfest africa speakers",
    "blockchain experts africa",
    "web3 leaders",
    "crypto keynote speakers",
    "blockchain conference speakers",
    "defi innovators",
    "nft speakers africa",
    "bitcoin experts",
    "ethereum thought leaders",
    "african blockchain founders",
    "crypto investors speakers",
    "fintech leaders africa",
    "blockchain startup mentors",
    "web3 developers africa",
  ],
  openGraph: {
    title: "Blockfest Africa 2025 Speakers - Visionaries of Web3 in Africa",
    description:
      "Discover the speakers shaping the future of blockchain, crypto, and Web3 in Africa at Blockfest Africa 2025.",
    images: [
      {
        url: "/images/og-speakers.jpg",
        width: 1200,
        height: 630,
        alt: "Blockfest Africa 2025 Speakers",
      },
    ],
  },
  twitter: {
    title: "Blockfest Africa 2025 Speakers - Visionaries of Web3 in Africa",
    description:
      "Meet the blockchain pioneers, founders, and innovators speaking at Blockfest Africa 2025.",
    images: ["/images/twitter-speakers.jpg"],
  },
};

const SpeakersPage = () => {
  // Convert actual speakers data for schema markup
  const speakers = SpeakersList.map((speaker: Speaker) => ({
    name: speaker.name,
    jobTitle: speaker.title,
    description: speaker.expertise?.join(", ") || speaker.title,
    image: speaker.image
      ? `https://blockfestafrica.com${speaker.image}`
      : undefined,
    url: speaker.website,
    sameAs: [speaker.twitter, speaker.website].filter(Boolean) as string[],
  }));

  const breadcrumbItems = [
    { name: "Blockfest Africa", url: "https://blockfestafrica.com" },
    { name: "Speakers", url: "https://blockfestafrica.com/speakers" },
  ];

  return (
    <>
      {/* Schema Markup for SEO */}
      <SpeakersSchema speakers={speakers} />
      <BreadcrumbSchema items={breadcrumbItems} />

      <main className={`${Gotham.className}`}>
        <SpeakersGrid />
      </main>
    </>
  );
};

export default SpeakersPage;
