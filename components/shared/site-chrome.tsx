"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/shared/footer";
import Navbar from "@/components/shared/navbar";
import { AnnouncementBar } from "@/components/shared/announcement-bar";

/**
 * The site chrome, adapted for the console rather than absent from it.
 *
 * The console once excluded all of this, and the owner asked for the main
 * site's navbar and footer back on the admin pages. The accommodation:
 *
 * The navbar renders but does not stick on console routes. The console's own
 * sidebar pins to the viewport top on desktop and its tab bar does the same
 * on a phone, so a permanently visible bar above them would either overlap
 * them or cost every screen its height for a whole shift. Scrolling away
 * gives the brand chrome at the top and the full workbench after one swipe.
 *
 * The announcement bar stays off the console: it is campaign marketing
 * aimed at visitors, not at the person reviewing the queue.
 *
 * Two leaf components that return null, deliberately not a wrapper around
 * children. A "use client" component wrapping {children} would push every route
 * in the application below a client boundary and stop the pages being server
 * rendered. Rendering the chrome in its own slot keeps children untouched.
 *
 * IdentityCallback is not part of this and must stay mounted at the body level
 * on every route: Netlify builds invite and recovery links against the site
 * root, and that component is what completes them.
 */

/** /admin and everything under it, including /admin/login. */
function isConsole(pathname: string | null): boolean {
  return pathname === "/admin" || Boolean(pathname?.startsWith("/admin/"));
}

export function SiteHeader() {
  const pathname = usePathname();
  if (isConsole(pathname)) return <Navbar sticky={false} />;
  return (
    <>
      <AnnouncementBar />
      <Navbar />
    </>
  );
}

export function SiteFooter() {
  return <Footer />;
}
