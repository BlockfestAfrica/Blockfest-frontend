"use client";
import { useState, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon, ArrowUpIcon } from "lucide-react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: 1,
    question: "When and where is Blockf3st Africa 2026?",
    answer:
      "Blockf3st Africa 2026 has TWO events! Johannesburg, South Africa in May 2026 and Lagos, Nigeria in October 2026. Join us for the Superbowl of Web3!",
  },
  {
    id: 2,
    question: "Is Blockf3st Africa free to attend?",
    answer:
      "Yes! Blockf3st Africa is completely free to attend. Please do not pay anyone claiming to sell tickets - the event is 100% free. We believe in making Web3 education accessible to everyone.",
  },
  {
    id: 3,
    question: "How do I register for the events?",
    answer:
      "Registration opens closer to each event date. Follow us on social media and join our Telegram community to be the first to know when registration opens!",
  },
  {
    id: 4,
    question: "What should I expect at Blockf3st Africa?",
    answer:
      "Experience keynote sessions from industry leaders, interactive workshops, panel discussions, networking opportunities, and masterclasses covering AI, Blockchain, DeFi, NFTs, and emerging Web3 technologies.",
  },
  {
    id: 5,
    question: "Who should attend Blockf3st Africa?",
    answer:
      "The event welcomes Web3 builders, blockchain developers, crypto founders, DeFi enthusiasts, students, creators, investors, and anyone interested in Africa's digital frontier and Web3 innovation.",
  },
  {
    id: 6,
    question: "Will there be networking opportunities?",
    answer:
      "Absolutely! Blockf3st Africa is designed for maximum networking. You'll connect with founders, creators, communities, and like-minded individuals shaping Africa's Web3 ecosystem during dedicated networking sessions and breaks.",
  },
  {
    id: 7,
    question: "Are meals provided during the event?",
    answer:
      "Yes, refreshments and lunch will be provided for all registered attendees. If you have dietary restrictions, please mention them during registration.",
  },
  {
    id: 8,
    question: "What time should I arrive at the venue?",
    answer:
      "Please come early! Registration opens at 8:00 AM, and we recommend arriving by this time to check in, get settled, and secure good seats. The main program starts at 8:30 AM sharp.",
  },
  {
    id: 9,
    question: "What is the dress code for the event?",
    answer:
      "Business casual or smart casual attire is recommended. Feel comfortable while maintaining a professional appearance for networking and photos.",
  },
  {
    id: 10,
    question: "Will the event be livestreamed?",
    answer:
      "Yes! We will be livestreaming the entire event on our YouTube channel and X (Twitter) so the global Web3 community can participate virtually. Follow our social media for livestream links.",
  },
  {
    id: 11,
    question: "Can I attend both events?",
    answer:
      "Yes! We encourage attendees to join us at both Johannesburg in May and Lagos in October. Register for each event separately and experience the full Blockf3st Africa world tour!",
  },
  {
    id: 12,
    question: "How do I join the community?",
    answer:
      "Join our Telegram channel at t.me/blockf3stafrica for real-time updates, networking, and community discussions. Follow us on X (Twitter) @blockfestafrica for announcements.",
  },
  {
    id: 13,
    question: "How can I become a sponsor or partner?",
    answer:
      "We offer various partnership tiers for both Johannesburg and Lagos events. Contact us at partnerships@blockfestafrica.com to receive our sponsorship deck with all packages and benefits.",
  },
  {
    id: 14,
    question: "Can I speak at Blockf3st Africa 2026?",
    answer:
      "Speaker applications will open soon! Follow us on social media to be notified when applications open. We're looking for industry experts, founders, and thought leaders in the Web3 space.",
  },
];

interface FAQSectionProps {
  hideHeader?: boolean;
}

export function FAQSection({ hideHeader = false }: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);
  useSubtleAnimations();

  const toggleItem = (id: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="py-12 lg:py-16 px-4 lg:px-8 bg-gradient-to-b from-black to-[#031940] relative overflow-hidden">
      <div className="relative z-10 max-w-3xl mx-auto">
        {!hideHeader && (
          <div className="text-center mb-8 lg:mb-12 fade-in-on-scroll">
            <h2 className="font-bold text-3xl md:text-4xl lg:text-5xl xl:text-6xl mb-4 lg:mb-6 text-white">
              Frequently Asked <span className="text-[#F2CB45]">Questions</span>
            </h2>
            <p className="text-base lg:text-xl text-white/70 max-w-2xl mx-auto px-2">
              Everything you need to know about Africa&apos;s premier Web3
              conference
            </p>
          </div>
        )}

        <div className="space-y-4 scale-in">
          {faqData.map((item) => (
            <div
              key={item.id}
              className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300"
            >
              <button
                type="button"
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 rounded-xl transition-colors duration-200"
                onClick={() => toggleItem(item.id)}
                aria-expanded={openItems.has(item.id)}
              >
                <h3 className="font-semibold text-base lg:text-lg text-white pr-4">
                  {item.question}
                </h3>
                <div className="flex-shrink-0">
                  {openItems.has(item.id) ? (
                    <ChevronUpIcon className="w-5 h-5 text-[#F2CB45]" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-white/50" />
                  )}
                </div>
              </button>

              {openItems.has(item.id) && (
                <div className="px-6 pb-5 transition-all duration-300 ease-in-out">
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-white/70 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 lg:mt-12 text-center fade-in-on-scroll">
          <div className="bg-gradient-to-br from-[#1B64E4] to-[#0D3B8C] rounded-2xl p-6 lg:p-10 text-white border border-white/10">
            <h3 className="text-xl lg:text-2xl font-semibold mb-4">
              Still have questions?
            </h3>
            <p className="text-white/80 mb-6 lg:text-lg">
              Can&apos;t find the answer you&apos;re looking for? Our team is
              here to help.
            </p>
            <a
              href="mailto:partnership@blockfestafrica.com"
              className="inline-flex items-center gap-2 bg-[#F2CB45] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#e8bc3d] transition-colors duration-200"
            >
              Contact Us
            </a>
          </div>
        </div>

        {/* Back to Top Button */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 lg:bottom-8 lg:right-8 bg-[#1B64E4] text-white w-12 h-12 lg:w-14 lg:h-14 rounded-full shadow-lg hover:bg-[#3D7BE8] transition-all duration-200 z-50 flex items-center justify-center transform hover:scale-110"
            aria-label="Back to top"
          >
            <ArrowUpIcon className="w-5 h-5 lg:w-6 lg:h-6" />
          </button>
        )}
      </div>
    </section>
  );
}
