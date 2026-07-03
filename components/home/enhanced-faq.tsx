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
import { faqData, faqCategories, type FAQItem } from "@/lib/faq-data";
import { CONTACT_EMAIL } from "@/lib/constants";
import "./subtle-animations.css";

const categories = faqCategories;

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
        hideHeader ? "pt-8 lg:pt-12 pb-12 lg:pb-16" : "py-12 lg:py-16"
      } px-4 lg:px-8 bg-gradient-to-b from-white to-gray-50`}
    >
      <div className="max-w-4xl mx-auto">
        {!hideHeader && (
          <div className="text-center mb-12 lg:mb-16 fade-in-on-scroll">
            <h2 className="font-light text-3xl lg:text-5xl lg:leading-tight tracking-[-5%] mb-4 lg:mb-6 text-black">
              Frequently Asked <span className="text-brand-blue">Questions</span>
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
                className="w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all duration-200 shadow-sm hover:shadow-md"
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
                            <ChevronUpIcon className="w-5 h-5 text-brand-blue" />
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
          <div className="bg-gradient-to-br from-brand-blue to-brand-blue-light rounded-2xl p-6 lg:p-10 text-white fade-in-on-scroll">
            <h3 className="text-xl lg:text-2xl font-semibold mb-3 lg:mb-4">
              Still have questions?
            </h3>
            <p className="text-white/90 mb-6 text-base lg:text-lg">
              Can&apos;t find the answer you&apos;re looking for? Our team is
              here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center justify-center gap-2 bg-brand-gold text-black font-semibold px-6 py-3 lg:py-4 rounded-xl hover:bg-brand-gold/90 transition-all duration-200 text-sm lg:text-base transform hover:scale-[1.02]"
              >
                📧 Email Us
              </a>
              <a
                href="https://t.me/blockf3stafrica"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 lg:py-4 rounded-xl hover:bg-white/20 transition-all duration-200 text-sm lg:text-base transform hover:scale-[1.02]"
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
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-brand-blue hover:bg-brand-blue/5 transition-all duration-200 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  🏠
                </span>
                <span className="font-medium text-gray-700 group-hover:text-brand-blue transition-colors duration-200">
                  Home
                </span>
              </Link>
              <Link
                href="/speakers"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-brand-blue hover:bg-brand-blue/5 transition-all duration-200 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  🎤
                </span>
                <span className="font-medium text-gray-700 group-hover:text-brand-blue transition-colors duration-200">
                  Speakers
                </span>
              </Link>
              <Link
                href="/#schedule"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-brand-blue hover:bg-brand-blue/5 transition-all duration-200 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  📅
                </span>
                <span className="font-medium text-gray-700 group-hover:text-brand-blue transition-colors duration-200">
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
            className="fixed bottom-6 right-6 lg:bottom-8 lg:right-8 bg-brand-blue text-white w-12 h-12 lg:w-14 lg:h-14 rounded-full shadow-lg hover:bg-brand-blue-light transition-all duration-200 z-50 flex items-center justify-center transform hover:scale-110"
            aria-label="Back to top"
          >
            <ArrowUpIcon className="w-5 h-5 lg:w-6 lg:h-6" />
          </button>
        )}
      </div>
    </section>
  );
}
