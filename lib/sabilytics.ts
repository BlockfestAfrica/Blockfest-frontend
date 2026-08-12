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
    };
  }
}

export const SABILYTICS_SRC = "https://www.sabilytics.com/script.js";
export const SABILYTICS_SITE_ID = "1csn36flwfzz";
export const SABILYTICS_DOMAIN = "blockfestafrica.com";

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

/** Someone headed for the ticket platform. `source` matches the UTM content. */
export function trackTicketIntent(source: string): void {
  track("ticket-intent", { source });
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
