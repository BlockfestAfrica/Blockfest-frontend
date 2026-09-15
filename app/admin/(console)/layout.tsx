import type { Metadata } from "next";
import Link from "next/link";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { pauseState } from "@/lib/campaign-pause";
import { ConsoleTabs, type ConsoleTab } from "@/components/admin/console-tabs";
import { ConsoleNav } from "@/components/admin/console-nav";
import { SignOut } from "@/components/admin/sign-out";
import { SessionClock } from "@/components/admin/session-clock";
import { buttonClass, Pill } from "@/components/shared/panel";
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
 * jumped the left edge by 128 pixels. One measure here settles it; it grew
 * from max-w-5xl to max-w-7xl once the tables earned the room, and it must
 * stay ONE measure, whatever it is.
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
          {/*
            * Two causes, one message, because the console cannot tell them
            * apart without weakening the uniform denial that stops the admin
            * list being enumerated. What it can do is stop sending somebody in
            * a circle: a person whose Identity invite worked, whose password
            * set, and who signed in successfully used to read "You need to
            * sign in", click Sign in, succeed again, and land back here. The
            * second sentence is the one that would have saved them the loop.
            */}
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            You need to sign in to see this.
          </p>
          <p className="mt-3 text-base leading-relaxed text-ink-2">
            If you have just signed in and are still seeing this, your address
            has not been added to the console yet. Being invited in Netlify is
            only half of it. Ask an owner to add you, or write to{" "}
            <a
              href="mailto:partnership@blockfestafrica.com"
              className="text-link underline underline-offset-2 hover:text-white"
            >
              partnership@blockfestafrica.com
            </a>
            .
          </p>
          <Link
            href="/admin/login"
            className={buttonClass("primary", "mt-8 px-8 text-base")}
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
    { href: "/admin/overview", label: "Overview" },
    { href: "/admin/participants", label: "People" },
    { href: "/admin/decided", label: "Decided" },
    { href: "/admin/tools", label: "Tools" },
    // Pausing and clearing are owner work, so the tab is not offered to a
    // reviewer. The routes check the role again themselves: a hidden tab is a
    // tidy interface, not a permission.
    ...(owner
      ? [
          { href: "/admin/winners", label: "Winners" },
          { href: "/admin/campaign", label: "Campaign" },
          { href: "/admin/audit", label: "Audit" },
        ]
      : []),
  ];

  const notOpenYet =
    CAMPAIGN.startsAt && new Date(CAMPAIGN.startsAt) > new Date();

  const statePills = (
    <>
      {pause.paused ? (
        <Pill tone="bad">Paused</Pill>
      ) : notOpenYet ? (
        <Pill>Opens 14 Sep</Pill>
      ) : null}
      <SessionClock expiresAt={admin.admin.sessionExpiresAt.toISOString()} />
    </>
  );

  return (
    /*
     * The dashboard shell: a persistent rail on desktop, tabs on a phone.
     *
     * The seven screens used to share nothing but a tab row floating above a
     * column, which is why they read as disconnected tables on a page. The
     * rail holds where-you-are, who-you-are and the campaign state in one
     * fixed place, and the content area holds exactly one thing: the screen.
     *
     * On a phone the rail would spend a third of the width on chrome, so the
     * horizontal tabs stay, in a sticky header that also carries the state
     * pills. One-handed reviewing on launch weekend is the constraint there.
     */
    <main id="main" className="min-h-dvh bg-ground lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
      {/* The border lives on the grid track, not the sticky aside: the
          aside is one viewport tall, the track is as tall as the page, and
          a border on the aside stopped mid-page on anything long. */}
      <div className="hidden border-r border-line lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col py-6 pl-4 pr-2">
        <div className="px-4">
          <p className="eyebrow text-brand-gold">Blockfest</p>
          <p className="mt-1 text-lg font-bold text-white">Console</p>
        </div>

        <div className="mt-8 flex-1 overflow-y-auto">
          <ConsoleNav tabs={tabs} />
        </div>

        {/* Who is signed in, pinned to the bottom of the rail where a
            dashboard keeps its account block. */}
        <div className="flex flex-col gap-2 border-t border-line px-4 pt-4">
          <div className="flex items-center gap-2">{statePills}</div>
          <p className="truncate text-sm text-ink-3" title={admin.admin.email}>
            {admin.admin.email}
          </p>
          <div className="flex items-center justify-between gap-2">
            <Pill tone={owner ? "gold" : "neutral"}>{admin.admin.role}</Pill>
            {/* There was no way to end a session from the application at all,
                so a reviewer on a borrowed laptop closed the tab and left a
                working one behind. */}
            <SignOut />
          </div>
        </div>
        </aside>
      </div>

      <div className="min-w-0">
        {/* z-40 sits under the skip link at z-100 and over the desktop table's
            sticky first column at z-10. */}
        <header className="sticky top-0 z-40 border-b border-line bg-ground/95 backdrop-blur lg:hidden">
          <div className="flex w-full items-center gap-3 px-4">
            <ConsoleTabs tabs={tabs} />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {statePills}
              <SignOut />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-10 lg:py-10">
          {children}
        </div>
      </div>
    </main>
  );
}
