import { Metadata } from "next";
import { EnhancedFAQSection } from "@/components/home/enhanced-faq";
import { FAQSchema } from "@/components/seo/faq-schema";
import { BaseSchema } from "@/components/seo/schema-markup";
import { faqData } from "@/lib/faq-data";

export const metadata: Metadata = {
  title: "FAQ - Blockfest Africa 2026 | Complete Guide",
  description:
    "Answers about Blockfest Africa 2026 in Lagos: tickets and pricing, the venue, schedule, accommodation, transport and networking.",
  keywords: [
    "Blockfest Africa FAQ",
    "Web3 conference questions",
    "blockchain event Cape Town",
    "blockchain event Lagos",
    "cryptocurrency conference South Africa",
    "cryptocurrency conference Nigeria",
    "DeFi event Africa",
    "Web3 registration",
    "blockfest africa tickets",
    "Web3 networking Africa",
    "blockchain prizes Africa",
    "crypto event accommodation",
  ],
  openGraph: {
    title: "FAQ - Blockfest Africa 2026 | Complete Guide",
    description:
      "Get answers to all your questions about Africa's premier Web3 conference. Registration, venues, schedule, accommodation, and more.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ - Blockfest Africa 2026 | Complete Guide",
    description:
      "Get answers to all your questions about Africa's premier Web3 conference. Registration, venues, schedule, accommodation, and more.",
  },
  alternates: {
    canonical: "https://blockfestafrica.com/faq",
  },
};

export default function FAQPage() {
  const faqPageData = {
    name: "Frequently Asked Questions - Blockfest Africa 2026",
    description:
      "Everything you need to know about Africa's premier Web3 conference",
    url: "https://blockfestafrica.com/faq",
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
      "@type": "WebPage",
      name: "Blockfest Africa 2026 FAQ",
      description:
        "Complete guide with all frequently asked questions about the premier Web3 conference in Africa",
    },
  };

  return (
    <>
      <FAQSchema faqs={faqData} />
      <BaseSchema type="WebPage" data={faqPageData} />
      <div className="min-h-screen bg-white">
        {/* Header Section */}
        <div className="bg-ground py-12 lg:py-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 text-center">
            <h1 className="font-bold text-3xl lg:text-5xl mb-4 text-white">
              Frequently Asked <span className="text-brand-blue-light">Questions</span>
            </h1>
            <p className="text-base lg:text-lg text-white/90 max-w-2xl mx-auto">
              Everything you need to know about Africa&apos;s premier Web3
              conference
            </p>
          </div>
        </div>

        {/* Enhanced FAQ Content */}
        <EnhancedFAQSection hideHeader={true} />
      </div>
    </>
  );
}
