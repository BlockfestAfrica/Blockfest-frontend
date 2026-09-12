"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/shared/footer";
import Navbar from "@/components/shared/navbar";
import { AnnouncementBar } from "@/components/shared/announcement-bar";

/**
 * The marketing chrome, absent from the console.
 *
 * The admin screens were rendering inside the public site: an announcement bar,
 * a sticky navbar and a full footer with a sitemap and a newsletter signup. On
 * a phone that is around 106 pixels of permanent vertical space gone before the
 * console has spent any of its own, and it put a newsletter form directly under
 * the control that permanently deletes every creator and every point.
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
  if (isConsole(pathname)) return null;
  return (
    <>
      <AnnouncementBar />
      <Navbar />
    </>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  if (isConsole(pathname)) return null;
  return <Footer />;
}
