import { Metadata } from "next";
import { EnhancedFAQSection } from "@/components/home/enhanced-faq";
import { FAQSchema } from "@/components/seo/faq-schema";
import { BaseSchema } from "@/components/seo/schema-markup";
import { faqData } from "@/lib/faq-data";

export const metadata: Metadata = {
  title: "FAQ - Blockfest Africa 2025 | Complete Guide",
  description:
    "Get answers to all your questions about Blockfest Africa 2025. Find information about registration, venue, schedule, accommodation, networking, prizes, and more.",
  keywords: [
    "Blockfest Africa FAQ",
    "Web3 conference questions",
    "blockchain event Lagos",
    "cryptocurrency conference Nigeria",
    "DeFi event Africa",
    "Web3 registration",
    "Landmark Event Center",
    "free blockchain conference",
    "Web3 networking Lagos",
    "blockchain prizes Nigeria",
    "crypto event accommodation",
  ],
  openGraph: {
    title: "FAQ - Blockfest Africa 2025 | Complete Guide",
    description:
      "Get answers to all your questions about Africa's premier Web3 conference. Registration, venue, schedule, accommodation, and more.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ - Blockfest Africa 2025 | Complete Guide",
    description:
      "Get answers to all your questions about Africa's premier Web3 conference. Registration, venue, schedule, accommodation, and more.",
  },
};

export default function FAQPage() {
  const faqPageData = {
    name: "Frequently Asked Questions - Blockfest Africa 2025",
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
      name: "Blockfest Africa 2025",
      description:
        "Africa's premier Web3 conference bringing together blockchain developers, crypto founders, DeFi enthusiasts, and Web3 innovators.",
      startDate: "2025-10-11T08:00:00+01:00",
      endDate: "2025-10-11T18:00:00+01:00",
      eventStatus: "https://schema.org/EventScheduled",
      organizer: {
        "@type": "Organization",
        name: "Blockfest Africa",
        url: "https://blockfestafrica.com",
      },
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: faqData.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  };

  return (
    <>
      <FAQSchema faqs={faqData} />
      <BaseSchema type="WebPage" data={faqPageData} />
      <div className="min-h-screen bg-white">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-[#1B64E4] to-[#3D7BE8] py-16 lg:py-24">
          <div className="max-w-4xl mx-auto px-4 lg:px-8 text-center">
            <h1 className="font-light text-4xl lg:text-6xl mb-4 lg:mb-6 text-white">
              Frequently Asked <span className="text-[#F2CB45]">Questions</span>
            </h1>
            <p className="text-xl lg:text-2xl text-white/90 max-w-2xl mx-auto">
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
