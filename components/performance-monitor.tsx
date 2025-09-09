"use client";

import { useEffect } from "react";
import { umamiTrack } from "@/lib/analytics";

// Extend PerformanceEntry to include optional value property for web vitals
interface PerformanceEntryWithValue extends PerformanceEntry {
  value?: number;
}

export function PerformanceMonitor() {
  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV !== "production") return;

    // Monitor Core Web Vitals
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Log performance metrics to Umami
          const entryWithValue = entry as PerformanceEntryWithValue;
          let value: number;
          switch (entry.entryType) {
            case "paint":
              // FP/FCP are reported via startTime (duration is 0)
              value = Math.round(entry.startTime);
              break;
            case "measure":
              value = Math.round(entry.duration);
              break;
            case "navigation":
              // Avoid double-reporting; handled by page_load_time below
              continue;
            default:
              value = Math.round(
                entryWithValue.value ?? entry.duration ?? entry.startTime ?? 0
              );
          }
          umamiTrack("web_vital", {
            category: "Web Vitals",
            name: entry.name,
            value,
          });
        }
      });

      try {
        observer.observe({ type: "measure", buffered: true });
        observer.observe({ type: "navigation", buffered: true });
        observer.observe({ type: "paint", buffered: true });
      } catch (error) {
        console.warn("Performance monitoring not supported:", error);
      }
    }

    // Monitor page load times
    window.addEventListener("load", () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming;

        if (navigation) {
          umamiTrack("page_load_time", {
            category: "Performance",
            value: Math.round(
              navigation.loadEventEnd - navigation.loadEventStart
            ),
          });
        }
      }, 0);
    });
  }, []);

  return null;
}
