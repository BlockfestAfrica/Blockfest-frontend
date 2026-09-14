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

/*
 * Served from our own origin, deliberately.
 *
 * The issue-closure verification of #138 left one residual standing: the
 * vendor tag was loaded live from www.sabilytics.com, un-pinned, so whoever
 * controls that host, or its CDN, could change what executes on every public
 * page of the origin that also hosts the console. Self-hosting the snapshot in
 * public/vendor/script.js removes the last third-party script execution on
 * this origin: the vendor can now receive beacons but can no longer run new
 * code here.
 *
 * The cost is that upstream updates stop arriving. To refresh deliberately:
 * curl -o public/vendor/script.js https://www.sabilytics.com/script.js
 * and read the diff before committing it.
 *
 * SABILYTICS_API must be pinned alongside: the script derives its endpoint
 * from its own src when data-api is absent, which self-hosted would point at
 * this origin's nonexistent /api/e and silently drop every pageview.
 */
export const SABILYTICS_SRC = "/vendor/script.js";
export const SABILYTICS_API = "https://www.sabilytics.com/api/e";
export const SABILYTICS_SITE_ID = "1csn36flwfzz";
export const SABILYTICS_DOMAIN = "blockfestafrica.com";

/**
 * The shared dashboard, for the admin overview to link to.
 *
 * Impressions are a campaign KPI and are not in the campaign database. Rather
 * than inventing a figure, the overview says so and points here. Empty when
 * unset, and the link is then simply absent: a dead link to analytics is worse
 * than no link, because somebody follows it during a report.
 */
export const SABILYTICS_SHARE_URL =
  process.env.NEXT_PUBLIC_SABILYTICS_SHARE_URL?.trim() || "";

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

/**
 * The Monica campaign funnel.
 *
 * Every name is prefixed, because /campaigns shares this property with the
 * ticket funnel. Without the prefix the two blend and neither is readable: a
 * spike in "register_started" would be unattributable to either.
 *
 * Named here rather than written at each call site for the same reason the
 * ticket events are: these must match the goal configuration in Sabilytics
 * exactly, and a typo in a string literal is a goal that silently records
 * nothing. Three campaign events already existed as loose strings and are
 * folded in here.
 *
 * Worth naming before launch rather than after, because funnel data for the
 * first two weeks cannot be reconstructed afterwards. A page that was not
 * instrumented on the day simply has no history.
 */
export const CAMPAIGN_EVENTS = {
  /** Landing page reached. The top of the funnel. */
  viewed: "campaign_monica_viewed",
  /** Someone arrived through a creator's referral link. */
  referralLinkUsed: "campaign_monica_referral_link_used",
  /** The registration form was opened and is accepting input. */
  registerStarted: "campaign_monica_register_started",
  /** Registration succeeded. The conversion that matters. */
  registerCompleted: "campaign_monica_register_completed",
  /** A creator began pasting a link into the submission form. */
  submissionStarted: "campaign_monica_submission_started",
  /** An entry was accepted by the endpoint. */
  submissionCompleted: "campaign_monica_submission_completed",
  /** A creator copied their own referral link, meaning they intend to share. */
  referralCopied: "campaign_monica_referral_copied",
  leaderboardViewed: "campaign_monica_leaderboard_viewed",
  packViewed: "campaign_monica_pack_viewed",
  rulesViewed: "campaign_monica_rules_viewed",
} as const;

/**
 * Every campaign event name, for the dashboard and for a test.
 *
 * A goal that exists in Sabilytics and nowhere in the code records nothing, and
 * an event fired from the code with no goal behind it is invisible. Exporting
 * the list is what lets one be checked against the other.
 */
export const CAMPAIGN_EVENT_NAMES = Object.values(CAMPAIGN_EVENTS);

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
