"use client";

import { useEffect } from "react";

/**
 * Catch an Identity link that lands on the wrong page.
 *
 * Netlify builds its invite, recovery and confirmation links as
 * `{{ .SiteURL }}/#invite_token=...`, which is the site root. The handler that
 * completes them lives on /admin/login, so an invited admin clicked their link,
 * arrived at the homepage, and nothing happened at all. The token sat in the
 * fragment until they navigated away and then it was gone.
 *
 * Retargeting the link would be the tidier fix and is not available: custom
 * email templates are a paid feature, and the default template is not editable.
 * So the site root has to recognise its own auth tokens.
 *
 * This deliberately does not call handleAuthCallback here. The token can only be
 * consumed once, and consuming it on a page with no form to set a password would
 * burn the invite. The fragment is carried across to the page that can finish
 * the job.
 *
 * Mounted in the root layout, so it runs on every page load. That is why the
 * first thing it does is a regular expression against a string that is almost
 * always empty: an ordinary visitor pays one test and nothing is imported.
 *
 * The fragment never reaches the server. It is not in the request, not in logs,
 * and not in a Referer header, which is the one good property of putting a
 * secret there. location.replace keeps it out of the back button too.
 */

/** The token types Netlify puts in a fragment. */
const AUTH_TOKEN = /[#&](invite_token|recovery_token|confirmation_token|email_change_token)=/;

const DESTINATION = "/admin/login";

export function IdentityCallback() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || !AUTH_TOKEN.test(hash)) return;

    // Already where it can be handled. Leaving it alone avoids a redirect loop.
    if (window.location.pathname === DESTINATION) return;

    window.location.replace(`${DESTINATION}${hash}`);
  }, []);

  return null;
}
