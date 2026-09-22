import type { Metadata } from "next";
import { SpeakersSchema } from "@/components/seo/speakers-schema";
import { BreadcrumbSchema } from "@/components/seo/schema-markup";
import { SpeakersList, isPastSpeaker, type Speaker } from "@/lib/speakers";
import { PastSpeakersGrid } from "@/components/speakers/past-speakers-grid";
import { gotham } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Past Speakers",
  description:
    "Meet the blockchain pioneers, AI builders, founders and investors who have spoken at Blockfest Africa across three editions.",
  keywords: [
    "blockfest africa past speakers",
    "blockchain experts africa",
    "web3 leaders",
    "crypto keynote speakers",
    "blockchain conference speakers",
    "defi innovators",
    "african blockchain founders",
  ],
  alternates: {
    canonical: "https://blockfestafrica.com/past-speakers",
  },
};

const PastSpeakersPage = () => {
  const speakers = SpeakersList.filter(isPastSpeaker).map((speaker: Speaker) => ({
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
    { name: "Past Speakers", url: "https://blockfestafrica.com/past-speakers" },
  ];

  return (
    <>
      <SpeakersSchema speakers={speakers} />
      <BreadcrumbSchema items={breadcrumbItems} />
      <main id="main" className={gotham.className}>
        <PastSpeakersGrid />
      </main>
    </>
  );
};

export default PastSpeakersPage;