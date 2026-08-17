/**
 * Sabilytics — the site's web analytics.
 *
 * The script auto-tracks pageviews, so nothing here needs to fire them. This
 * module only wraps custom events, and it never throws if the script has not
 * loaded (ad blockers, offline, or a call before the async script arrives).
 */
declare global {
  interface Window {
    sabilytics?: {
      track: (event: string, data?: Record<string, unknown>) => void;
      /** Returns sb_vid, sb_sid and utm_* as a query string. */
      handoffParams?: () => string;
      /** Merges those onto a URL, so a purchase off-site can be joined back. */
      appendHandoffParams?: (url: string) => string;
    };
  }
}

export const SABILYTICS_SRC = "https://www.sabilytics.com/script.js";
export const SABILYTICS_SITE_ID = "1csn36flwfzz";
export const SABILYTICS_DOMAIN = "blockfestafrica.com";

/**
 * Conversion event names.
 *
 * These must match the goal and journey steps configured in Sabilytics
 * exactly, so they live here rather than as loose strings at each call site.
 * snake_case is the house style there.
 */
export const EVENTS = {
  /** Journey step: someone reached the page where passes are chosen. */
  ticketsPageViewed: "tickets_page_viewed",
  /** Journey step: someone left for the ticket platform. */
  ticketCheckoutStarted: "ticket_checkout_started",
} as const;

/** Fire a custom event. Safe to call before the script loads. */
export function track(event: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.sabilytics?.track(event, data);
  } catch {
    // Analytics must never break the page.
  }
}

/** A button or link was clicked. `location` says which surface it was on. */
export function trackButtonClick(name: string, location?: string): void {
  track("button-click", { name, ...(location ? { location } : {}) });
}

/** Someone reached /tickets. The first step of the funnel. */
export function trackTicketsPageViewed(): void {
  track(EVENTS.ticketsPageViewed);
}

/**
 * Someone headed for the ticket platform.
 *
 * `source` is the placement, and matches the utm_content on the link so the
 * click and the campaign row line up. `pass` is the tier when a specific one
 * was chosen, which is what makes BRIDGE PASS comparable to ALL ACCESS.
 */
export function trackCheckoutStarted(source: string, pass?: string): void {
  track(EVENTS.ticketCheckoutStarted, {
    source,
    ...(pass ? { pass } : {}),
  });
}

/**
 * Add the visitor and session ids to an outbound ticket link.
 *
 * Returns the url untouched when the script has not loaded, so a blocked or
 * slow tracker costs attribution and never a broken link. The url already
 * carries UTMs from ticketUrl(); this adds the identity that would let a
 * purchase completed off-site be joined back to the visit that started it.
 */
export function withHandoff(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    return window.sabilytics?.appendHandoffParams?.(url) ?? url;
  } catch {
    return url;
  }
}

/** Strip absolute paths and query strings out of a stack before sending it. */
export function sanitizeStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .slice(0, 5)
    .map((line) => line.replace(/https?:\/\/[^\s)]+/g, (url) => new URL(url).pathname))
    .join("\n")
    .slice(0, 500);
}
