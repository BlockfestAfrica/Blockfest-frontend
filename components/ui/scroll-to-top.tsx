"use client";

import React, { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

interface ScrollToTopProps {
  threshold?: number;
  className?: string;
}

export function ScrollToTop({
  threshold = 300,
  className = "",
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Scroll to top smoothly
  const scrollToTop = () => {
    setIsScrolling(true);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    // Reset scrolling state after animation
    setTimeout(() => setIsScrolling(false), 800);
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Show button when page is scrolled down
    const toggleVisibility = () => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (window.pageYOffset > threshold) {
        setIsVisible(true);
      } else {
        // Add slight delay before hiding to prevent flickering
        timeoutId = setTimeout(() => setIsVisible(false), 100);
      }
    };

    // Throttle scroll events for better performance
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          toggleVisibility();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [threshold]);

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          disabled={isScrolling}
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999]
            w-12 h-12 sm:w-14 sm:h-14
            bg-gradient-to-r from-blue-600 to-indigo-600 
            hover:from-blue-700 hover:to-indigo-700 
            disabled:from-blue-500 disabled:to-indigo-500
            text-white rounded-full shadow-lg hover:shadow-xl 
            focus:outline-none focus:ring-4 focus:ring-blue-500/50
            transform hover:scale-110 active:scale-95
            disabled:cursor-not-allowed disabled:opacity-75
            transition-all duration-300 ease-out
            touch-manipulation animate-fade-in ${className}`}
          aria-label="Scroll to top"
          title="Back to top"
          style={{
            animation: isVisible
              ? "fadeInUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
              : undefined,
          }}
        >
          <ChevronUp
            className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 ${
              isScrolling ? "animate-bounce" : ""
            }`}
          />
        </button>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
