import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { currentCreator } from "@/lib/creator-session";
import { campaignBySlug, monicaRoutes, MONICA_SLUG } from "@/lib/campaigns";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const metadata: Metadata = {
  title: "Your campaign page",
  // Never indexed. It is somebody's own page, reached with a secret, and the
  // only thing a crawler could ever see here is the locked state.
  robots: { index: false, follow: false },
};

/**
 * A creator's own page.
 *
 * Dynamic, always. The whole page is a function of a cookie, so it must not be
 * prerendered and must never be cached: a cached render is one creator's points
 * shown to the next visitor.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MonicaCreatorPage() {
  const creator = await currentCreator();

  if (!creator) {
    return (
      <main id="main" className="bg-ground">
        <section className="section-y">
          <div className="container-page max-w-2xl">
            <h1 className="flex items-center gap-2 text-display-sm font-bold text-white">
              <Lock className="h-6 w-6 text-white/40" aria-hidden="true" />
              We do not know who you are
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              This page opens from the personal link you were given when you
              registered. Open that link again and you will land back here.
            </p>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              If you have lost it, write to{" "}
              <a
                href="mailto:partnership@blockfestafrica.com"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                partnership@blockfestafrica.com
              </a>{" "}
              from the email address you registered with and we will sort it
              out. We cannot read your link back to you, so we will issue a new
              one.
            </p>
            <Link
              href={monicaRoutes.landing}
              className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {CAMPAIGN.name}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const joined = creator.joinedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lagos",
  });

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page">
          <Link
            href={monicaRoutes.landing}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {CAMPAIGN.name}
          </Link>

          <div className="mt-6 max-w-2xl">
            <h1 className="text-display-sm font-bold text-white">
              {creator.name.split(" ")[0]}, you are in
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              Registered {joined}. This page is yours, and it is where your
              points and entries will show up.
            </p>
          </div>

          <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/20 bg-white/5 p-5">
              <p className="eyebrow text-white/50">Points</p>
              <p className="mt-2 text-display-sm font-bold tabular-nums text-white">
                {creator.pointsTotal}
              </p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/5 p-5">
              <p className="eyebrow text-white/50">Approved entries</p>
              <p className="mt-2 text-display-sm font-bold tabular-nums text-white">
                {creator.approvedEntries}
              </p>
            </div>
          </div>

          <div className="mt-10 max-w-2xl rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6">
            <p className="eyebrow text-white/50">Your referral code</p>
            <p className="mt-2 font-mono text-xl font-bold tracking-wider text-brand-gold">
              {creator.referralCode}
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
              Bring another creator in with this. Points land once they have
              their first approved entry, so it is worth sending to people who
              will actually post. Read it out loud if that is easier: there is
              no letter O, zero, letter I or one in it, so nothing can be heard
              two ways.
            </p>
          </div>

          {/* Submissions land here next. Said plainly rather than shown as an
              empty table, because an empty table reads as something that broke
              rather than something that has not started. */}
          <div className="mt-10 max-w-2xl rounded-xl border border-white/15 p-5 sm:p-6">
            <p className="text-base font-semibold text-white">Your entries</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
              Nothing yet. Publish your answer to the current brief on your own
              account, then come back here to submit the link. Submitting opens
              with the first brief.
            </p>
            <Link
              href={`${monicaRoutes.landing}#stages`}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
            >
              See the current brief
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
