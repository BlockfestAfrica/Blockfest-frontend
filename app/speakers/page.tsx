import React from "react";
import type { Metadata } from "next";
import { SpeakersGrid } from "@/components/speakers/main-speakers";
import { SpeakersSchema } from "@/components/seo/speakers-schema";
import { BreadcrumbSchema } from "@/components/seo/schema-markup";
import { SpeakersList, type Speaker } from "@/lib/speakers";
import { ComingSoonNotice } from "@/components/shared/coming-soon-notice";
import { isSpeakerFormOpen } from "@/lib/speaking";
import { gotham } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Speakers",
  description: isSpeakerFormOpen
    ? "The Lagos '26 speaker lineup is announced in the coming weeks, and the call for speakers is open until then. Meet the blockchain pioneers, AI builders, founders and investors who have spoken at Blockfest Africa."
    : "The Lagos '26 speaker lineup is announced in the coming weeks. Meet the blockchain pioneers, AI builders, founders and investors who have spoken at Blockfest Africa.",
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
    "ai speakers africa",
    "artificial intelligence leaders",
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

      <main id="main" className={gotham.className}>
        {/* The lineup is unannounced because the programme is still being
            selected — which makes this the one page where "coming soon" has a
            better call to action than a ticket: you could be on it. */}
        <ComingSoonNotice
          title="2026 lineup coming soon"
          description={
            isSpeakerFormOpen
              ? "Lagos '26 speakers are announced in the coming weeks, and the call for speakers is open until then. Below, the voices who have graced our stage."
              : "Lagos '26 speakers are announced in the coming weeks. Below, the voices who have graced our stage."
          }
          action={
            isSpeakerFormOpen
              ? { href: "/call-for-speakers", label: "Apply to speak" }
              : undefined
          }
        />
        <SpeakersGrid />
      </main>
    </>
  );
};

export default SpeakersPage;
