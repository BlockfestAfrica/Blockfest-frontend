import { Metadata } from "next";
import { FAQSection } from "@/components/home/faq";

export const metadata: Metadata = {
  title: "FAQ - Blockfest Africa 2025",
  description:
    "Frequently asked questions about Blockfest Africa 2025, Africa's premier Web3 conference. Find answers about registration, venue, schedule, and more.",
  keywords: [
    "Blockfest Africa FAQ",
    "Web3 conference questions",
    "blockchain event Lagos",
    "cryptocurrency conference Nigeria",
    "DeFi event Africa",
    "Web3 registration",
    "Landmark Event Center",
    "free blockchain conference",
  ],
  openGraph: {
    title: "FAQ - Blockfest Africa 2025",
    description:
      "Get answers to all your questions about Africa's premier Web3 conference",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ - Blockfest Africa 2025",
    description:
      "Get answers to all your questions about Africa's premier Web3 conference",
  },
};

export default function FAQPage() {
  return (
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

      {/* FAQ Content */}
      <FAQSection hideHeader={true} />
    </div>
  );
}
