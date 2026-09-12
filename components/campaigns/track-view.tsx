"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/sabilytics";

/**
 * Fire one event when a page is first seen.
 *
 * The campaign pages are server components, and Sabilytics auto-tracks
 * pageviews, so this is not about page views: it is about naming the steps of a
 * funnel so they can be configured as goals. A pageview on /campaigns is a
 * pageview; "reached the pack" is a step.
 *
 * Guarded against firing twice. Effects run twice in development under React's
 * strict mode, and a funnel that double-counts its own top is a funnel whose
 * conversion rate is half what it should be.
 */
export function TrackView({
  event,
  data,
}: {
  event: string;
  data?: Record<string, unknown>;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, data);
    // Deliberately not depending on `data`: an object literal from a server
    // component is a new reference on every render, which would re-fire on a
    // refresh that changed nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}
