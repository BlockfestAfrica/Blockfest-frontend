import BadgeGenerator from "./components/BadgeGenerator";
import { Metadata } from "next";
import { BaseSchema } from "@/components/seo/schema-markup";
import { EVENT_ID } from "@/lib/seo-event";

export const metadata: Metadata = {
  title: "Badge Generator - Blockfest Africa 2026",
  description:
    "Generate your personalized Blockfest Africa 2026 conference badge",
  keywords: ["blockfest", "africa", "badge", "generator", "conference", "2026"],
  alternates: {
    canonical: "https://blockfestafrica.com/getdp",
  },
};

export default function GetDPPage() {
  const badgePageData = {
    name: "Badge Generator - Blockfest Africa 2026",
    description:
      "Generate your personalized Blockfest Africa 2026 conference badge",
    url: "https://blockfestafrica.com/getdp",
    isPartOf: {
      "@type": "WebSite",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    // A badge tool is not the event. Reference the canonical Event by @id
    // rather than restating dates and prices that would drift.
    about: { "@id": EVENT_ID },
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Blockfest Africa Badge Generator",
      applicationCategory: "UtilityApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "NGN",
      },
    },
  };

  return (
    <>
      <BaseSchema type="WebPage" data={badgePageData} />
      <main id="main">
        <BadgeGenerator />
      </main>
    </>
  );
}
