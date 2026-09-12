"use client";

import { usePathname } from "next/navigation";
import {
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

const OFF_LIMITS = ["/admin", "/api/admin"];

export function Analytics() {
  const pathname = usePathname();

  const blocked = OFF_LIMITS.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`),
  );
  if (blocked) return null;

  return (
    <script
      async
      src={SABILYTICS_SRC}
      data-site={SABILYTICS_SITE_ID}
      data-domain={SABILYTICS_DOMAIN}
    />
  );
}
