"use client";

import { useEffect } from "react";

// Singleton observer to prevent multiple observers
let globalObserver: IntersectionObserver | null = null;
let observerInitialized = false;

export function useSubtleAnimations() {
  useEffect(() => {
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

    // Mobile-friendly intersection observer settings
    const isMobile = window.innerWidth < 768;

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

    animateElements.forEach((el) => globalObserver!.observe(el));

    return () => {
      if (globalObserver) {
        globalObserver.disconnect();
        globalObserver = null;
        observerInitialized = false;
      }
    };
  }, []);
}
