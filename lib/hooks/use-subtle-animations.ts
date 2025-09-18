"use client";

import { useEffect } from "react";
import { useIsClient } from "./use-is-client";

// Singleton observer to prevent multiple observers
let globalObserver: IntersectionObserver | null = null;
let observerInitialized = false;

export function useSubtleAnimations() {
  const isClient = useIsClient();

  useEffect(() => {
    // Only run on client-side after hydration
    if (!isClient) return;

    // Only initialize observer once
    if (observerInitialized) return;
    observerInitialized = true;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      // If user prefers reduced motion, just add 'visible' class immediately
      const animateElements = document.querySelectorAll(
        ".fade-in-on-scroll, .slide-in-left, .slide-in-right, .scale-in, .stagger-animation"
      );
      animateElements.forEach((el) => el.classList.add("visible"));
      return;
    }

    // Mobile-friendly intersection observer settings - use safer client-side detection
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    globalObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      {
        threshold: isMobile ? 0.05 : 0.1,
        rootMargin: isMobile ? "0px 0px -20px 0px" : "0px 0px -50px 0px",
      }
    );

    // Observe all elements with animation classes
    const animateElements = document.querySelectorAll(
      ".fade-in-on-scroll, .slide-in-left, .slide-in-right, .scale-in, .stagger-animation"
    );

    if (globalObserver && animateElements.length > 0) {
      animateElements.forEach((el) => {
        try {
          globalObserver!.observe(el);
        } catch (error) {
          console.warn("Failed to observe element for animation:", error);
        }
      });
    }

    return () => {
      if (globalObserver) {
        try {
          globalObserver.disconnect();
        } catch (error) {
          console.warn("Failed to disconnect observer:", error);
        }
        globalObserver = null;
        observerInitialized = false;
      }
    };
  }, [isClient]);
}
