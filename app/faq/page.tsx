import { Metadata } from "next";
import { EnhancedFAQSection } from "@/components/home/enhanced-faq";
import { FAQSchema } from "@/components/seo/faq-schema";
import { BaseSchema } from "@/components/seo/schema-markup";
import { faqData } from "@/lib/faq-data";
import { EVENT_ID } from "@/lib/seo-event";

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
    // The event is defined once in lib/seo-event.ts; reference it by @id
    // so the price, dates and venue can never drift between pages.
    about: { "@id": EVENT_ID },
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
      <main id="main" className="min-h-screen bg-paper">
        {/* Header Section */}
        <section className="section-y bg-ground">
          <div className="container-page">
            <div className="max-w-2xl">
              <h1 className="text-display-sm font-bold text-white">
                Frequently Asked{" "}
                <span className="text-brand-blue-light">Questions</span>
              </h1>
            </div>
          </div>
        </section>

        {/* Enhanced FAQ Content */}
        <EnhancedFAQSection hideHeader={true} />
      </main>
    </>
  );
}
