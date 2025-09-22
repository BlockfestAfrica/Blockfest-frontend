"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  ArrowUpIcon,
} from "lucide-react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // Event Details
  {
    id: 1,
    question: "When and where is Blockfest Africa 2025?",
    answer:
      "Blockfest Africa 2025 will be held on October 11th, 2025, in Lagos, Nigeria at the Landmark Event Center. The event runs from 8:00 AM to 6:00 PM WAT.",
    category: "Event Details",
  },
  {
    id: 4,
    question: "What should I expect at Blockfest Africa?",
    answer:
      "Experience keynote sessions from industry leaders, interactive workshops, panel discussions, networking opportunities, and masterclasses covering AI, Blockchain, DeFi, NFTs, and emerging Web3 technologies.",
    category: "Event Details",
  },
  {
    id: 8,
    question: "What time should I arrive at the venue?",
    answer:
      "Please come early! Registration opens at 8:00 AM, and we recommend arriving by this time to check in, get settled, and secure good seats. The main program starts at 8:30 AM sharp.",
    category: "Event Details",
  },
  {
    id: 9,
    question: "What is the dress code for the event?",
    answer:
      "Business casual or smart casual attire is recommended. Feel comfortable while maintaining a professional appearance for networking and photos.",
    category: "Event Details",
  },
  {
    id: 14,
    question: "Can I attend virtually or is it only in-person?",
    answer:
      "Blockfest Africa 2025 is an in-person event only. We believe the best connections and learning experiences happen face-to-face, especially for Africa's Web3 community.",
    category: "Event Details",
  },

  // Registration & Tickets
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
    id: 5,
    question: "Who should attend Blockfest Africa?",
    answer:
      "The event welcomes Web3 builders, blockchain developers, crypto founders, DeFi enthusiasts, students, creators, investors, and anyone interested in Africa's digital frontier and Web3 innovation.",
    category: "Registration & Tickets",
  },

  // Food & Accommodation
  {
    id: 7,
    question: "Are meals provided during the event?",
    answer:
      "Yes, lunch will be provided for all registered attendees. If you have dietary restrictions or special needs, please mention them during registration so we can accommodate you.",
    category: "Food & Accommodation",
  },
  {
    id: 12,
    question: "Is transportation provided to the venue?",
    answer:
      "Yes! Free buses are provided for approved attendees from schools and specific locations in Lagos. If you've been approved, look out for our emails with transportation details and pickup points.",
    category: "Food & Accommodation",
  },
  {
    id: 13,
    question: "Are there accommodation discounts available?",
    answer:
      "Yes! We have special hotel and shortlet discounts for out-of-town attendees. Check the accommodation topic in our Telegram channel for exclusive deals and booking information.",
    category: "Food & Accommodation",
  },

  // Activities & Networking
  {
    id: 6,
    question: "Will there be networking opportunities?",
    answer:
      "Absolutely! Blockfest Africa is designed for maximum networking. You'll connect with founders, creators, communities, and like-minded individuals shaping Africa's Web3 ecosystem during dedicated networking sessions and breaks.",
    category: "Activities & Networking",
  },
  {
    id: 10,
    question: "Will the event be livestreamed?",
    answer:
      "Yes! We will be livestreaming the entire event on our YouTube channel and X (Twitter) so the global Web3 community can participate virtually. Follow our social media for livestream links on event day.",
    category: "Activities & Networking",
  },
  {
    id: 11,
    question: "Will there be prizes and giveaways?",
    answer:
      "Absolutely! We'll be giving away laptops, gadgets, and cash prizes through games and competitions throughout the day. Come prepared to participate and win amazing tech prizes!",
    category: "Activities & Networking",
  },
  {
    id: 17,
    question: "Are there opportunities for startups to showcase?",
    answer:
      "Yes! Blockfest Africa provides platforms for Web3 startups and projects to showcase their innovations. Contact our team at partnership@blockfestafrica.com for showcase opportunities.",
    category: "Activities & Networking",
  },

  // Safety & Security
  {
    id: 16,
    question: "What safety and security measures are in place?",
    answer:
      "Your safety is our priority! The venue will be heavily guarded with professional security personnel throughout the event. We also have ambulance services and paramedics on standby for any medical emergencies.",
    category: "Safety & Security",
  },

  // Community & Support
  {
    id: 15,
    question: "How do I join the Telegram community?",
    answer:
      "Join our Telegram channel at https://t.me/blockf3stafrica for real-time updates, accommodation deals, networking, and community discussions. Stay connected with the Blockfest Africa community!",
    category: "Community & Support",
  },
  {
    id: 18,
    question: "How can I become a sponsor or partner?",
    answer:
      "We offer various partnership tiers including Platinum, Gold, Silver, Bronze, and Community partnerships. Contact us at partnership@blockfestafrica.com to discuss sponsorship opportunities and packages.",
    category: "Community & Support",
  },
];

const categories = [
  { name: "Event Details", icon: "📅", color: "bg-blue-50 text-blue-700" },
  {
    name: "Registration & Tickets",
    icon: "🎫",
    color: "bg-green-50 text-green-700",
  },
  {
    name: "Food & Accommodation",
    icon: "🍽️",
    color: "bg-orange-50 text-orange-700",
  },
  {
    name: "Activities & Networking",
    icon: "🤝",
    color: "bg-purple-50 text-purple-700",
  },
  { name: "Safety & Security", icon: "🔒", color: "bg-red-50 text-red-700" },
  {
    name: "Community & Support",
    icon: "💬",
    color: "bg-indigo-50 text-indigo-700",
  },
];

interface FAQSectionProps {
  hideHeader?: boolean;
  showSearch?: boolean;
  showTableOfContents?: boolean;
}

export function EnhancedFAQSection({
  hideHeader = false,
  showSearch = true,
  showTableOfContents = true,
}: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  useSubtleAnimations();

  // Filter FAQs based on search term
  const filteredFAQs = useMemo(() => {
    if (!searchTerm) return faqData;
    return faqData.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // Group filtered FAQs by category
  const groupedFAQs = useMemo(() => {
    const grouped: Record<string, FAQItem[]> = {};
    filteredFAQs.forEach((faq) => {
      if (!grouped[faq.category]) {
        grouped[faq.category] = [];
      }
      grouped[faq.category].push(faq);
    });
    return grouped;
  }, [filteredFAQs]);

  const toggleItem = (id: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  const scrollToCategory = (category: string) => {
    const element = document.getElementById(
      `category-${category.replace(/\s+/g, "-").toLowerCase()}`
    );
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle scroll for back to top button
  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      className={`${
        hideHeader ? "pt-8 lg:pt-12 pb-20 lg:pb-28" : "py-20 lg:py-28"
      } px-4 lg:px-8 bg-gradient-to-b from-white to-gray-50`}
    >
      <div className="max-w-4xl mx-auto">
        {!hideHeader && (
          <div className="text-center mb-12 lg:mb-16 fade-in-on-scroll">
            <h2 className="font-light text-3xl lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] mb-4 lg:mb-6 text-black">
              Frequently Asked <span className="text-[#F2CB45]">Questions</span>
            </h2>
            <p className="text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to know about Africa&apos;s premier Web3
              conference
            </p>
          </div>
        )}

        {/* Search Bar */}
        {showSearch && (
          <div className="mb-8 lg:mb-12 fade-in-on-scroll">
            <div className="relative max-w-lg mx-auto">
              <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1B64E4] focus:border-[#1B64E4] outline-none transition-all duration-200 shadow-sm hover:shadow-md"
              />
            </div>
          </div>
        )}

        {/* Table of Contents */}
        {showTableOfContents && !searchTerm && (
          <div className="mb-12 lg:mb-16 fade-in-on-scroll">
            <h3 className="text-xl lg:text-2xl font-semibold mb-6 lg:mb-8 text-center text-gray-900">
              Quick Navigation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
              {categories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => scrollToCategory(category.name)}
                  className={`${category.color} p-4 lg:p-5 rounded-xl text-left hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 border border-gray-100`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl lg:text-3xl">
                      {category.icon}
                    </span>
                    <span className="font-medium text-sm lg:text-base">
                      {category.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FAQ Categories */}
        <div className="space-y-12">
          {Object.entries(groupedFAQs).map(([categoryName, faqs]) => {
            const categoryInfo = categories.find(
              (c) => c.name === categoryName
            );
            return (
              <div key={categoryName} className="scale-in">
                <div
                  id={`category-${categoryName
                    .replace(/\s+/g, "-")
                    .toLowerCase()}`}
                  className="flex items-center gap-3 mb-6 scroll-mt-24"
                >
                  <span className="text-3xl">{categoryInfo?.icon}</span>
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {categoryName}
                  </h3>
                </div>

                <div className="space-y-4">
                  {faqs.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300"
                    >
                      <button
                        className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors duration-200"
                        onClick={() => toggleItem(item.id)}
                        aria-expanded={openItems.has(item.id)}
                      >
                        <h4 className="font-semibold text-base lg:text-lg text-gray-900 pr-4">
                          {item.question}
                        </h4>
                        <div className="flex-shrink-0">
                          {openItems.has(item.id) ? (
                            <ChevronUpIcon className="w-5 h-5 text-[#1B64E4]" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {openItems.has(item.id) && (
                        <div className="px-6 pb-5 transition-all duration-300 ease-in-out">
                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-gray-600 leading-relaxed">
                              {item.answer}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Enhanced Contact Section */}
        <div className="mt-16 lg:mt-20 space-y-6 lg:space-y-8">
          <div className="bg-gradient-to-br from-[#1B64E4] to-[#3D7BE8] rounded-2xl p-6 lg:p-10 text-white fade-in-on-scroll">
            <h3 className="text-xl lg:text-2xl font-semibold mb-3 lg:mb-4">
              Still have questions?
            </h3>
            <p className="text-white/90 mb-6 text-base lg:text-lg">
              Can&apos;t find the answer you&apos;re looking for? Our team is
              here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
              <a
                href="mailto:partnership@blockfestafrica.com"
                className="inline-flex items-center justify-center gap-2 bg-[#F2CB45] text-black font-semibold px-6 py-3 lg:py-4 rounded-xl hover:bg-[#F2CB45]/90 transition-all duration-200 text-sm lg:text-base transform hover:scale-[1.02]"
              >
                📧 Email Us
              </a>
              <a
                href="https://t.me/blockf3stafrica"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 lg:py-4 rounded-xl hover:bg-white/20 transition-all duration-200 backdrop-blur-sm text-sm lg:text-base transform hover:scale-[1.02]"
              >
                💬 Join Telegram
              </a>
            </div>
          </div>

          {/* Related Links */}
          <div className="bg-white rounded-2xl p-6 lg:p-10 border-2 border-gray-100 shadow-sm fade-in-on-scroll">
            <h3 className="text-xl lg:text-2xl font-semibold mb-6 text-gray-900">
              Explore More
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-[#1B64E4] hover:bg-[#1B64E4]/5 transition-all duration-200 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  🏠
                </span>
                <span className="font-medium text-gray-700 group-hover:text-[#1B64E4] transition-colors duration-200">
                  Home
                </span>
              </Link>
              <Link
                href="/speakers"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-[#1B64E4] hover:bg-[#1B64E4]/5 transition-all duration-200 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  🎤
                </span>
                <span className="font-medium text-gray-700 group-hover:text-[#1B64E4] transition-colors duration-200">
                  Speakers
                </span>
              </Link>
              <Link
                href="/#schedule"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-[#1B64E4] hover:bg-[#1B64E4]/5 transition-all duration-200 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  �
                </span>
                <span className="font-medium text-gray-700 group-hover:text-[#1B64E4] transition-colors duration-200">
                  Schedule
                </span>
              </Link>
            </div>
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
