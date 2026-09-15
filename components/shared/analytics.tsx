"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  SABILYTICS_API,
  SABILYTICS_DOMAIN,
  SABILYTICS_SITE_ID,
  SABILYTICS_SRC,
} from "@/lib/sabilytics";

/**
 * Site analytics, kept off the admin surface.
 *
 * This tag was in the root layout, which means it also ran on the review queue.
 * Whoever controls that script, or its CDN, or that hostname, was executing
 * JavaScript on an authenticated admin's page. They would not even need to
 * steal anything: a same-origin fetch to /api/admin/review carries the session
 * cookie and a browser-set Origin, so the origin check passes, requireAdmin
 * passes because it really is the reviewer's session, and the approvals are
 * recorded against the reviewer's own name.
 *
 * The session cookies cannot be made HttpOnly to compensate, because the
 * Identity library sets them from the browser through document.cookie, and the
 * refresh token is in localStorage as well.
 *
 * So the script does not load there at all. next.config.ts carries a second,
 * tighter CSP scoped to /admin as the belt to this braces: if this component is
 * ever moved back into the layout by someone tidying up, the browser still
 * refuses to fetch the script on those pages.
 *
 * Analytics on an admin page measured nothing anybody wanted anyway.
 */

/*
 * Paths where a bearer credential can appear in the URL, plus the admin
 * surface.
 *
 * The entry link carries the creator's access token in ?t=, and Netlify
 * re-appends the original query string to a redirect, so the token arrives in
 * the address bar of wherever that redirect lands. A pageview tag sends the
 * URL it is on. That means an analytics vendor was being handed a live
 * ninety day credential for every creator on their first visit, which is a
 * worse leak than the admin one this component was written for, and it was
 * live on the marketing build.
 *
 * The prefix rule below covers /enter, /enter/confirm and /me together.
 */
const OFF_LIMITS = [
  "/admin",
  "/api/admin",
  "/campaigns/monica-money-story/enter",
  "/campaigns/monica-money-story/me",
  "/campaigns/monica-money-story/recover",
  /* The register success screen renders the raw personal link into the DOM.
     The confirm action refuses to put a token in HTML that shares a page
     with a third-party script; the same rule has to hold here, and the
     success screen measures nothing worth the exception. */
  "/campaigns/monica-money-story/register",
];

export function Analytics() {
  const pathname = usePathname();

  const blocked = OFF_LIMITS.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`),
  );

  /*
   * Returning null removes the TAG; it does not undo the SCRIPT.
   *
   * The audit found the gap: the vendor patches history.pushState on
   * load, so once it has run anywhere, a client-side navigation into an
   * off-limits page still fired a pageview from that page. React removing
   * the element changes nothing, because the code is already resident.
   * On these paths the URL can carry a credential and the DOM carries a
   * creator's own data, which is the whole reason the list exists.
   *
   * So the blocked branch actively disables it rather than merely
   * declining to add it. The flag is what the vendor snapshot checks
   * before beaconing; the delete removes the API that lib/sabilytics
   * calls. Both are cheap, and both survive a soft navigation.
   */
  useEffect(() => {
    if (!blocked) return;
    const w = window as unknown as Record<string, unknown>;
    w.__sabilyticsDisabled = true;
    delete w.sabilytics;
  }, [blocked, pathname]);

  if (blocked) return null;

  return (
    <script
      async
      src={SABILYTICS_SRC}
      data-site={SABILYTICS_SITE_ID}
      data-domain={SABILYTICS_DOMAIN}
      data-api={SABILYTICS_API}
    />
  );
}
