"use client";

import { useEffect, useRef } from "react";
import { trackTicketsPageViewed } from "@/lib/sabilytics";

/**
 * The first step of the ticket funnel.
 *
 * The tracker already records a pageview on its own; this is a separate named
 * event because Sabilytics builds journeys from custom events, not pageviews.
 *
 * Guarded against firing twice: React runs effects twice in development, and a
 * duplicate here would inflate the top of the funnel and quietly understate
 * every conversion rate measured against it.
 */
export function TicketsPageView() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackTicketsPageViewed();
  }, []);

  return null;
}
