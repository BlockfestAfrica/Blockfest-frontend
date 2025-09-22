import BadgeGenerator from "./components/BadgeGenerator";
import { Metadata } from "next";
import { BaseSchema } from "@/components/seo/schema-markup";

export const metadata: Metadata = {
  title: "Badge Generator - Blockfest Africa 2025",
  description:
    "Generate your personalized Blockfest Africa 2025 conference badge",
  keywords: ["blockfest", "africa", "badge", "generator", "conference", "2025"],
};

export default function GetDPPage() {
  const badgePageData = {
    name: "Badge Generator - Blockfest Africa 2025",
    description:
      "Generate your personalized Blockfest Africa 2025 conference badge",
    url: "https://blockfestafrica.com/getdp",
    isPartOf: {
      "@type": "WebSite",
      name: "Blockfest Africa",
      url: "https://blockfestafrica.com",
    },
    about: {
      "@type": "Event",
      name: "Blockfest Africa 2025",
    },
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Blockfest Africa Badge Generator",
      applicationCategory: "UtilityApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  };

  return (
    <>
      <BaseSchema type="WebPage" data={badgePageData} />
      <BadgeGenerator />
    </>
  );
}
