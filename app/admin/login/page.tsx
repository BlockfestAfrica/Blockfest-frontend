import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/admin-login";

export const metadata: Metadata = {
  title: "Admin",
  // Never indexed, never followed. There is nothing here for a crawler and the
  // page should not appear in a search result at all.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The way in.
 *
 * Registration is invite only, so there is no sign-up here and there cannot be
 * one: an account exists because somebody was invited by name from the Netlify
 * dashboard. That is what makes every point award attributable.
 *
 * The page says nothing about who is or is not an admin. A wrong password and
 * an address that was never invited produce the same answer, because a login
 * page that distinguishes them is a login page that enumerates the admin list.
 */
export default function AdminLoginPage() {
  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page max-w-md">
          <p className="eyebrow text-brand-gold">Blockfest Africa</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
            Admin
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/55">
            Sign in with the address you were invited on.
          </p>
          <AdminLogin />
        </div>
      </section>
    </main>
  );
}
