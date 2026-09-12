import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import {
  creatorSubmissions,
  currentCreator,
  openChallenge,
  registeredPlatforms,
} from "@/lib/creator-session";
import { SubmissionForm } from "@/components/campaigns/submission-form";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";
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

/**
 * Where a submission got to.
 *
 * Worded for the person who submitted it rather than for the queue: "waiting to
 * be reviewed" says what is happening, where "pending" says only that something
 * has a state.
 */
function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-white/25 bg-white/5 text-white/70",
    approved: "border-green-400/40 bg-green-400/10 text-green-300",
    rejected: "border-red-400/40 bg-red-400/10 text-red-300",
  };
  const labels: Record<string, string> = {
    pending: "Waiting to be reviewed",
    approved: "Approved",
    rejected: "Not accepted",
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        styles[status] ?? styles.pending
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

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
              from the email address you registered with and we will issue a
              new one. We cannot read your old link back to you, which is why a
              new one is the only way: a link we could recover is a link
              somebody else could take.
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

  const [challenge, platforms, mine] = await Promise.all([
    openChallenge(),
    registeredPlatforms(creator.enrolmentId),
    creatorSubmissions(creator.enrolmentId),
  ]);

  const submittedThisWeek = challenge
    ? mine.filter((s) => s.weekNo === challenge.weekNo).map((s) => s.platform)
    : [];

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

          {/* Submitting, when a week is open. */}
          <div className="mt-10 max-w-2xl rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6">
            {challenge ? (
              <>
                <p className="eyebrow text-brand-gold">
                  Week {challenge.weekNo} is open
                </p>
                <h2 className="mt-2 text-lg font-bold text-white">
                  {challenge.title}
                </h2>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
                  {challenge.description}
                </p>
                <p className="mt-3 text-sm text-white/50">
                  Closes{" "}
                  {challenge.endsAt.toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "Africa/Lagos",
                  })}
                  . Publish on your own account first, then paste the link here.
                </p>

                <SubmissionForm
                  platforms={platforms as CampaignPlatform[]}
                  alreadySubmitted={submittedThisWeek}
                  challengeTitle={challenge.title}
                />
              </>
            ) : (
              // Said plainly rather than shown as an empty form, because a form
              // that refuses everything reads as broken rather than as closed.
              <>
                <p className="text-base font-semibold text-white">
                  No challenge is open right now
                </p>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
                  A new brief opens each Monday. When one is open it appears
                  here, with somewhere to paste your link.
                </p>
                <Link
                  href={`${monicaRoutes.landing}#stages`}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
                >
                  See all four briefs
                </Link>
              </>
            )}
          </div>

          <div className="mt-10 max-w-2xl rounded-xl border border-white/15 p-5 sm:p-6">
            <p className="text-base font-semibold text-white">Your entries</p>
            {mine.length === 0 ? (
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
                Nothing yet. Once you submit a link it shows here, with where it
                got to in review.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {mine.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-white/15 bg-ground p-4"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="text-sm font-semibold text-white">
                        Week {entry.weekNo}
                      </span>
                      <span className="text-sm text-white/50">
                        {platformLabels[entry.platform as CampaignPlatform] ??
                          entry.platform}
                      </span>
                      <StatusPill status={entry.status} />
                    </div>
                    <p className="mt-2 break-all text-sm leading-relaxed text-white/50">
                      {entry.url}
                    </p>
                    {entry.reviewNote && (
                      // Shown because a rejection whose reason is invisible is
                      // one a creator argues with rather than learns from.
                      <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/70">
                        {entry.reviewNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
