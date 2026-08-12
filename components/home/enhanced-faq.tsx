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
import {
  Calendar,
  Handshake,
  Home,
  Mail,
  MessageCircle,
  Mic,
  Shield,
  Ticket,
  Utensils,
} from "lucide-react";

const categoryIcons = {
  calendar: Calendar,
  ticket: Ticket,
  utensils: Utensils,
  handshake: Handshake,
  shield: Shield,
  message: MessageCircle,
} as const;
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
    <section className="section-y bg-paper">
      <div className="container-page">
        {!hideHeader && (
          <div className="fade-in-on-scroll mb-10 lg:mb-14">
            <h2 className="text-display-sm font-bold text-gray-900">
              Frequently Asked <span className="text-brand-blue">Questions</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
              Everything you need to know about Africa&apos;s premier Web3 and AI
              conference
            </p>
          </div>
        )}

        {/* Search Bar */}
        {showSearch && (
          <div className="fade-in-on-scroll mb-10 lg:mb-14">
            <div className="relative max-w-lg">
              <SearchIcon
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-gray-200 bg-white py-4 pl-12 pr-4 text-base text-gray-900 transition-colors duration-300 hover:border-brand-blue"
              />
            </div>
          </div>
        )}

        {/* Table of Contents */}
        {showTableOfContents && !searchTerm && (
          <div className="fade-in-on-scroll mb-10 lg:mb-14">
            <h2 className="mb-6 text-2xl font-semibold text-gray-900">
              Quick Navigation
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => scrollToCategory(category.name)}
                  className="min-h-11 rounded-xl border border-gray-200 bg-paper-muted p-6 text-left transition-colors duration-300 hover:border-brand-blue"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                      {(() => { const Icon = categoryIcons[category.icon]; return <Icon className="h-5 w-5" aria-hidden="true" />; })()}
                    </span>
                    <span className="text-base font-medium text-gray-900">
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
                  className="mb-6 flex scroll-mt-24 items-center gap-3"
                >
                  {categoryInfo && (() => { const Icon = categoryIcons[categoryInfo.icon]; return <Icon className="h-6 w-6 text-brand-blue" aria-hidden="true" />; })()}
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {categoryName}
                  </h3>
                </div>

                <div className="space-y-4">
                  {faqs.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-gray-200 bg-white transition-colors duration-300 hover:border-brand-blue"
                    >
                      <button
                        className="flex min-h-11 w-full items-center justify-between rounded-xl px-6 py-5 text-left"
                        onClick={() => toggleItem(item.id)}
                        aria-expanded={openItems.has(item.id)}
                      >
                        <h4 className="pr-4 text-base font-semibold text-gray-900 lg:text-lg">
                          {item.question}
                        </h4>
                        <span className="shrink-0">
                          {openItems.has(item.id) ? (
                            <ChevronUpIcon
                              className="h-5 w-5 text-brand-blue"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronDownIcon
                              className="h-5 w-5 text-gray-500"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </button>

                      {openItems.has(item.id) && (
                        <div className="px-6 pb-5">
                          <div className="border-t border-gray-200 pt-4">
                            <p className="max-w-3xl text-base leading-relaxed text-gray-600">
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
        <div className="mt-16 space-y-6 lg:mt-20 lg:space-y-8">
          <div className="fade-in-on-scroll rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-2xl font-semibold text-gray-900">
              Still have questions?
            </h3>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">
              Can&apos;t find the answer you&apos;re looking for? Our team is
              here to help.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email Us
              </a>
              <a
                href="https://t.me/blockf3stafrica"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-7 text-base font-semibold text-gray-900 transition-colors duration-300 hover:border-brand-blue"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Join Telegram
              </a>
            </div>
          </div>

          {/* Related Links */}
          <div className="fade-in-on-scroll rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-6 text-2xl font-semibold text-gray-900">
              Explore More
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Link
                href="/"
                className="group flex min-h-11 items-center gap-3 rounded-md border border-gray-200 p-4 transition-colors duration-300 hover:border-brand-blue"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                  <Home className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-base font-medium text-gray-600 transition-colors duration-300 group-hover:text-brand-blue">
                  Home
                </span>
              </Link>
              <Link
                href="/speakers"
                className="group flex min-h-11 items-center gap-3 rounded-md border border-gray-200 p-4 transition-colors duration-300 hover:border-brand-blue"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                  <Mic className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-base font-medium text-gray-600 transition-colors duration-300 group-hover:text-brand-blue">
                  Speakers
                </span>
              </Link>
              <Link
                href="/schedule"
                className="group flex min-h-11 items-center gap-3 rounded-md border border-gray-200 p-4 transition-colors duration-300 hover:border-brand-blue"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                  <Calendar className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-base font-medium text-gray-600 transition-colors duration-300 group-hover:text-brand-blue">
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
            className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue text-white transition-colors duration-300 hover:bg-brand-blue-light lg:bottom-8 lg:right-8"
            aria-label="Back to top"
          >
            <ArrowUpIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
