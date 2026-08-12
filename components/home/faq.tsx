"use client";
import { useState, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon, ArrowUpIcon } from "lucide-react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { faqData } from "@/lib/faq-data";

/* The homepage answers the common questions; /faq carries all of them. */
const HOMEPAGE_FAQ_COUNT = 6;
import { CONTACT_EMAIL } from "@/lib/constants";
import "./subtle-animations.css";


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
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        {!hideHeader && (
          <div className="mb-10 lg:mb-14 fade-in-on-scroll">
            <h2 className="text-display-sm font-bold text-white">
              Frequently Asked{" "}
              <span className="text-brand-blue-light">Questions</span>
            </h2>
          </div>
        )}

        <div className="space-y-3 scale-in">
          {faqData.slice(0, HOMEPAGE_FAQ_COUNT).map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/20 bg-white/5 transition-colors duration-300 hover:bg-white/10"
            >
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-6 py-5 text-left"
                onClick={() => toggleItem(item.id)}
                aria-expanded={openItems.has(item.id)}
              >
                <h3 className="max-w-2xl text-base font-semibold text-white lg:text-lg">
                  {item.question}
                </h3>
                <span className="flex-shrink-0">
                  {openItems.has(item.id) ? (
                    <ChevronUpIcon
                      className="h-4 w-4 text-brand-blue-light"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDownIcon
                      className="h-4 w-4 text-white/60"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </button>

              {openItems.has(item.id) && (
                <div className="border-t border-white/20 px-6 pb-6 pt-4">
                  <p className="max-w-2xl text-base leading-relaxed text-white/60">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 fade-in-on-scroll lg:mt-14">
          <div className="rounded-xl border border-white/20 bg-white/5 p-6 lg:p-10">
            <h3 className="text-2xl font-semibold text-white">
              Still have questions?
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90">
              Our team is here to help.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
            >
              Contact Us
            </a>
          </div>
        </div>

        {/* Back to Top Button */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue text-white shadow-lg transition-colors duration-300 hover:bg-brand-blue-light lg:bottom-8 lg:right-8 lg:h-14 lg:w-14"
            aria-label="Back to top"
          >
            <ArrowUpIcon className="h-5 w-5 lg:h-6 lg:w-6" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
