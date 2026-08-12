import React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { SpeakersGrid } from "@/components/speakers/main-speakers";
import { SpeakersSchema } from "@/components/seo/speakers-schema";
import { BreadcrumbSchema } from "@/components/seo/schema-markup";
import { SpeakersList, type Speaker } from "@/lib/speakers";
import { ComingSoonNotice } from "@/components/shared/coming-soon-notice";

const Gotham = localFont({
  src: "../../app/fonts/Gotham-Medium.otf",
});

export const metadata: Metadata = {
  title: "Speakers",
  description:
    "The Lagos '26 speaker lineup is announced in the coming weeks. Meet the blockchain pioneers, founders, investors and Web3 leaders who have spoken at Blockfest Africa.",
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
    title: "Blockfest Africa Speakers - 2026 Lineup Coming Soon",
    description:
      "The Lagos '26 lineup lands soon. Meet the speakers who have shaped the conversation at Blockfest Africa.",
    images: [
      {
        url: "/images/og-speakers.jpg",
        width: 1200,
        height: 630,
        alt: "Blockfest Africa 2026 Speakers",
      },
    ],
  },
  twitter: {
    title: "Blockfest Africa Speakers - 2026 Lineup Coming Soon",
    description:
      "The Lagos '26 lineup lands soon. Meet the speakers who have shaped the conversation at Blockfest Africa.",
    images: ["/images/twitter-speakers.jpg"],
  },
  alternates: {
    canonical: "https://blockfestafrica.com/speakers",
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

      <main id="main" className={`${Gotham.className}`}>
        <ComingSoonNotice
          title="2026 lineup coming soon"
          description="Speakers for Lagos '26 are being announced in the coming weeks. Below are the voices who have graced our stage so far."
        />
        <SpeakersGrid />
      </main>
    </>
  );
};

export default SpeakersPage;
