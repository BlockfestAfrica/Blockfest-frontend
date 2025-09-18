"use client";

import { useEffect, useRef, useState } from "react";

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const {
    threshold = 0.1,
    rootMargin = "0px 0px -50px 0px",
    triggerOnce = true,
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldShow = entry.isIntersecting;

        if (shouldShow && (!triggerOnce || !hasTriggered)) {
          setIsVisible(true);
          if (triggerOnce) {
            setHasTriggered(true);
          }
        } else if (!triggerOnce && !shouldShow) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce, hasTriggered]);

  return { elementRef, isVisible };
}

export function useStaggeredAnimation(
  count: number,
  delay: number = 100,
  options: UseScrollAnimationOptions = {}
) {
  const { elementRef, isVisible } = useScrollAnimation(options);
  const [visibleItems, setVisibleItems] = useState<boolean[]>(
    new Array(count).fill(false)
  );

  useEffect(() => {
    if (isVisible) {
      const timers: NodeJS.Timeout[] = [];

      for (let i = 0; i < count; i++) {
        const timer = setTimeout(() => {
          setVisibleItems((prev) => {
            const newState = [...prev];
            newState[i] = true;
            return newState;
          });
        }, i * delay);

        timers.push(timer);
      }

      return () => {
        timers.forEach((timer) => clearTimeout(timer));
      };
    }
  }, [isVisible, count, delay]);

  return { elementRef, visibleItems, isVisible };
}
