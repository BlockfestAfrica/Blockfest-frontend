import { Metadata } from "next";
import { EnhancedFAQSection } from "@/components/home/enhanced-faq";
import { FAQSchema } from "@/components/seo/faq-schema";

// Import FAQ data from the enhanced component for schema markup
// Since the FAQ data is defined inside the component, we'll define it here for schema
const faqData = [
  {
    id: 1,
    question: "When and where is Blockfest Africa 2025?",
    answer:
      "Blockfest Africa 2025 will be held on October 11th, 2025, in Lagos, Nigeria at the Landmark Event Center. The event runs from 8:30 AM to 6:00 PM WAT.",
    category: "Event Details",
  },
  {
    id: 2,
    question: "Is Blockfest Africa free to attend?",
    answer:
      "Yes! Blockfest Africa is completely free to attend. Please do not pay anyone claiming to sell tickets - the event is 100% free. We believe in making Web3 education accessible to everyone.",
    category: "Registration & Tickets",
  },
  {
    id: 3,
    question: "How do I register and get approved?",
    answer:
      "Registration is done through our Luma platform. After registering, approval is still ongoing for all applicants. You'll receive an email confirmation if you've been approved to attend. Please be patient as we review all applications.",
    category: "Registration & Tickets",
  },
  {
    id: 4,
    question: "What should I expect at Blockfest Africa?",
    answer:
      "Experience keynote sessions from industry leaders, interactive workshops, panel discussions, networking opportunities, and masterclasses covering AI, Blockchain, DeFi, NFTs, and emerging Web3 technologies.",
    category: "Event Details",
  },
  {
    id: 5,
    question: "Who should attend Blockfest Africa?",
    answer:
      "The event welcomes Web3 builders, blockchain developers, crypto founders, DeFi enthusiasts, students, creators, investors, and anyone interested in Africa's digital frontier and Web3 innovation.",
    category: "Registration & Tickets",
  },
  {
    id: 15,
    question: "How do I join the Telegram community?",
    answer:
      "Join our Telegram channel at https://t.me/blockf3stafrica for real-time updates, accommodation deals, networking, and community discussions. Stay connected with the Blockfest Africa community!",
    category: "Community & Support",
  },
];

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
  return (
    <>
      <FAQSchema faqs={faqData} />
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
