import type { Metadata } from "next";
import Link from "next/link";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { pauseState } from "@/lib/campaign-pause";
import { ConsoleTabs, type ConsoleTab } from "@/components/admin/console-tabs";
import { Panel, Pill } from "@/components/shared/panel";
import { campaignBySlug, MONICA_SLUG } from "@/lib/campaigns";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The console shell.
 *
 * Never prerendered, never cached, at this level as well as on every page. The
 * whole thing is a function of who is signed in and it shows creator contact
 * details, so a cached render is one admin's screen handed to the next visitor.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * One shell for every admin screen except the sign-in page.
 *
 * /admin/login sits outside this route group on purpose. The shell answers an
 * unknown visitor with a block containing a Sign in button, and rendering that
 * on the sign-in route would replace the form with a button pointing at itself.
 *
 * Three things this fixes, none of them cosmetic.
 *
 * The screens had no shared measure: the queue was max-w-4xl and the
 * participants table was the bare 72rem container, so moving between them
 * jumped the left edge by 128 pixels. One max-w-5xl here settles it.
 *
 * The signed-out block was written out twice, once per page, which is two
 * chances for them to drift and two places to remember when a third screen is
 * added. It lives here now and the pages assume an admin.
 *
 * And the pause state was read on the queue page and then only rendered inside
 * the owner branch, so a reviewer whose queue stopped filling on launch morning
 * saw a completely ordinary page. They would conclude the work had dried up
 * rather than that the campaign had been stopped. Every role sees it now.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // One answer for everybody who is not a current admin: not signed in,
  // unknown, revoked, or signed in on a different Netlify account.
  if (!admin.ok) {
    return (
      <main id="main" className="min-h-dvh bg-ground">
        <div className="mx-auto w-full max-w-md px-4 py-16 lg:px-8">
          <p className="eyebrow text-brand-gold">Blockfest Africa</p>
          <h1 className="mt-2 text-display-sm font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
            Admin
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            You need to sign in to see this.
          </p>
          <Link
            href="/admin/login"
            className="mt-8 inline-flex min-h-12 items-center rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const pause = await pauseState();
  const owner = isOwner(admin.admin);

  const tabs: ConsoleTab[] = [
    { href: "/admin", label: "Review" },
    { href: "/admin/participants", label: "People" },
    { href: "/admin/decided", label: "Decided" },
    { href: "/admin/tools", label: "Tools" },
    // Pausing and clearing are owner work, so the tab is not offered to a
    // reviewer. The routes check the role again themselves: a hidden tab is a
    // tidy interface, not a permission.
    ...(owner ? [{ href: "/admin/campaign", label: "Campaign" }] : []),
  ];

  const notOpenYet =
    CAMPAIGN.startsAt && new Date(CAMPAIGN.startsAt) > new Date();

  return (
    <main id="main" className="min-h-dvh bg-ground">
      {/* z-40 sits under the skip link at z-100 and over the desktop table's
          sticky first column at z-10. */}
      <header className="sticky top-0 z-40 border-b border-white/12 bg-ground/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 lg:px-8">
          <ConsoleTabs tabs={tabs} />
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <span className="max-w-[14rem] truncate text-sm text-white/60">
              {admin.admin.email}
            </span>
            <Pill tone={owner ? "gold" : "neutral"}>{admin.admin.role}</Pill>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
        {pause.paused ? (
          <Panel tone="danger" className="mb-8">
            <p className="eyebrow text-red-300">Campaign paused</p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Nobody can register or submit
            </h2>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/75">
              Creators are being told: {pause.reason ?? "no reason recorded"}.
              Nothing new will arrive in the queue until it is started again.
            </p>
            {owner && (
              <Link
                href="/admin/campaign"
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-white underline underline-offset-4"
              >
                Start it again
              </Link>
            )}
          </Panel>
        ) : notOpenYet ? (
          <Panel tone="warn" className="mb-8">
            <p className="text-sm leading-relaxed text-white/75">
              Not open yet. Registration opens Monday 14 September, so an empty
              queue is expected until then.
            </p>
          </Panel>
        ) : null}

        {children}
      </div>
    </main>
  );
}
