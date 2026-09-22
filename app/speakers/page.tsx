import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SpeakersSchema } from "@/components/seo/speakers-schema";
import { BreadcrumbSchema } from "@/components/seo/schema-markup";
import { SpeakersList, is2026Speaker, type Speaker } from "@/lib/speakers";
import { ComingSoonNotice } from "@/components/shared/coming-soon-notice";
import { isSpeakerFormOpen } from "@/lib/speaking";
import { gotham } from "@/lib/fonts";
import { FeaturedSpeakersGrid } from "@/components/speakers/2026-speakers-grid";

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

  const speakers2026 = SpeakersList.filter(is2026Speaker);
  const hasAnnouncedSpeakers = speakers2026.length > 0;

  return (
    <>
      <SpeakersSchema speakers={speakers} />
      <BreadcrumbSchema items={breadcrumbItems} />

      <main id="main" className={gotham.className}>
        {hasAnnouncedSpeakers ? (
          <FeaturedSpeakersGrid speakers={speakers2026} />
        ) : (
          <ComingSoonNotice
            title="2026 lineup coming soon"
            description={
              isSpeakerFormOpen
                ? "Lagos '26 speakers are announced in the coming weeks, and the call for speakers is open until then."
                : "Lagos '26 speakers are announced in the coming weeks."
            }
            action={
              isSpeakerFormOpen
                ? { href: "/call-for-speakers", label: "Apply to speak" }
                : undefined
            }
          />
        )}

        {/* Archive link — the 33 past speakers now live on their own page,
            so this page opens with what's next instead of "coming soon"
            followed immediately by three years of history. */}
        <div className="border-t border-gray-200 bg-paper">
          <div className="container-page section-y flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base text-gray-600">
              Curious who&apos;s spoken before? Browse three editions of past
              speakers.
            </p>
            <Link
              href="/past-speakers"
              className="inline-flex min-h-11 items-center rounded-full border border-gray-200 px-6 text-sm font-semibold text-gray-900 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
            >
              View Past Speakers
            </Link>
          </div>
        </div>
      </main>
    </>
  );
};

export default SpeakersPage;
