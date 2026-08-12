import BadgeGenerator from "./components/BadgeGenerator";
import { Metadata } from "next";
import { BaseSchema } from "@/components/seo/schema-markup";

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
    about: {
      "@type": "Event",
      name: "Blockfest Africa 2026",
      description:
        "Africa's premier Web3 conference bringing together blockchain developers, crypto founders, DeFi enthusiasts, and Web3 innovators.",
      startDate: "2026-10-22T08:00:00+01:00",
      endDate: "2026-10-23T18:00:00+01:00",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: "Lagos, Nigeria",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Lagos",
          addressRegion: "Lagos State",
          addressCountry: "NG",
        },
      },
      organizer: {
        "@type": "Organization",
        name: "Blockfest Africa",
        url: "https://blockfestafrica.com",
        email: "partnership@blockfestafrica.com",
        sameAs: [
          "https://twitter.com/blockfestafrica",
          "https://www.instagram.com/blockfestival_africa?igsh=NG1ma2p1aXV2OHk2&utm_source=qr",
          "https://youtube.com/@blockchainfestivalafrica?si=UhSMNPr7GIfOzZk9",
          "https://linkedin.com/company/blockfest-africa",
          "https://t.me/blockf3stafrica",
        ],
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://luma.com/gf1ye3cw?tk=AQAG9o",
        description: "Free admission to Blockfest Africa 2026",
      },
      performer: [
        {
          "@type": "Organization",
          name: "Blockfest Africa",
          url: "https://blockfestafrica.com",
        },
      ],
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
      <main id="main">
        <BadgeGenerator />
      </main>
    </>
  );
}
