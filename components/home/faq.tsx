"use client";
import { useState, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon, ArrowUpIcon } from "lucide-react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { faqData } from "@/lib/faq-data";
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
    <section className="py-12 lg:py-16 px-4 lg:px-8 bg-ground border-t border-white/20 relative overflow-hidden">
      <div className="relative z-10 max-w-3xl mx-auto">
        {!hideHeader && (
          <div className="text-center mb-8 lg:mb-12 fade-in-on-scroll">
            <h2 className="font-bold text-3xl lg:text-5xl mb-4 lg:mb-6 text-white">
              Frequently Asked <span className="text-brand-blue-light">Questions</span>
            </h2>
            <p className="text-base lg:text-lg text-white/60 max-w-2xl mx-auto px-2">
              Everything you need to know about Africa&apos;s premier Web3
              conference
            </p>
          </div>
        )}

        <div className="space-y-4 scale-in">
          {faqData.map((item) => (
            <div
              key={item.id}
              className="bg-white/5 rounded-xl border border-white/20 hover:bg-white/10 transition-colors duration-300"
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
                    <ChevronUpIcon className="w-5 h-5 text-brand-blue-light" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-white/60" />
                  )}
                </div>
              </button>

              {openItems.has(item.id) && (
                <div className="px-6 pb-5 transition-colors duration-300 ease-in-out">
                  <div className="pt-2 border-t border-white/20">
                    <p className="text-white/60 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 lg:mt-12 text-center fade-in-on-scroll">
          <div className="bg-white/5 rounded-xl p-6 lg:p-10 text-white border border-white/20">
            <h3 className="text-lg lg:text-2xl font-semibold mb-4">
              Still have questions?
            </h3>
            <p className="text-white/90 mb-6 lg:text-lg">
              Can&apos;t find the answer you&apos;re looking for? Our team is
              here to help.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 bg-brand-gold text-black font-semibold px-6 py-3 rounded-full hover:bg-brand-gold-hover transition-colors duration-200"
            >
              Contact Us
            </a>
          </div>
        </div>

        {/* Back to Top Button */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 lg:bottom-8 lg:right-8 bg-brand-blue text-white w-12 h-12 lg:w-14 lg:h-14 rounded-full shadow-lg hover:bg-brand-blue-light transition-transform duration-200 z-50 flex items-center justify-center transform hover:scale-110"
            aria-label="Back to top"
          >
            <ArrowUpIcon className="w-5 h-5 lg:w-6 lg:h-6" />
          </button>
        )}
      </div>
    </section>
  );
}
