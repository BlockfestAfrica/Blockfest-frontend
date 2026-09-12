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
import { Panel, SectionHeading, Stat } from "@/components/shared/panel";
import { pauseState } from "@/lib/campaign-pause";
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

  const [challenge, platforms, mine, pause] = await Promise.all([
    openChallenge(),
    registeredPlatforms(creator.enrolmentId),
    creatorSubmissions(creator.enrolmentId),
    pauseState(),
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
        <div className="container-page max-w-3xl">
          <Link
            href={monicaRoutes.landing}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {CAMPAIGN.name}
          </Link>

          {/* The name large and the housekeeping small. Somebody opening this
              weekly wants their standing and the brief, not a paragraph
              explaining what the page is. */}
          <h1 className="mt-6 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
            {creator.name.split(" ")[0]}
          </h1>
          <p className="mt-3 text-sm text-white/45">
            Joined {joined} · Your page
          </p>

          {/* Figures, not cards. A rule and a big number reads as a number. */}
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <Stat label="Points" value={creator.pointsTotal} />
            <Stat label="Approved" value={creator.approvedEntries} />
            <Stat
              label="Referral code"
              value={creator.referralCode}
              hint="Share it. Points land on their first approved entry."
            />
          </div>

          <Link
            href={monicaRoutes.leaderboard}
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            See the leaderboard
          </Link>

          {/* The one thing to act on, so it is the only accented block. */}
          <div className="mt-14">
            {/* Said here rather than left to the endpoint. A form that accepts
                a link and then refuses it wastes the one thing a creator on a
                deadline does not have. */}
            {pause.paused ? (
              <Panel tone="warn">
                <p className="eyebrow text-amber-300">Paused</p>
                <h2 className="mt-2 text-xl font-bold text-white">
                  Submissions are paused
                </h2>
                <p className="mt-3 max-w-prose text-base leading-relaxed text-white/70">
                  {pause.reason}
                </p>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/50">
                  Nothing you have already submitted is affected.
                </p>
              </Panel>
            ) : challenge ? (
              <Panel tone="accent">
                <p className="eyebrow text-brand-gold">
                  Week {challenge.weekNo} · closes{" "}
                  {challenge.endsAt.toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "Africa/Lagos",
                  })}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  {challenge.title}
                </h2>
                <p className="mt-3 max-w-prose text-base leading-relaxed text-white/70">
                  {challenge.description}
                </p>

                <SubmissionForm
                  platforms={platforms as CampaignPlatform[]}
                  alreadySubmitted={submittedThisWeek}
                  challengeTitle={challenge.title}
                />
              </Panel>
            ) : (
              <Panel tone="quiet">
                <SectionHeading
                  title="No brief is open"
                  hint="A new one opens each Monday. When it does it appears here, with somewhere to paste your link."
                />
                <Link
                  href={`${monicaRoutes.landing}#stages`}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
                >
                  See all four briefs
                </Link>
              </Panel>
            )}
          </div>

          <div className="mt-14">
            <SectionHeading label="Your entries" title={`${mine.length} submitted`} />

            {mine.length === 0 ? (
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-white/55">
                Nothing yet. Publish your answer on your own account, then paste
                the link above.
              </p>
            ) : (
              /* A list with a left edge coloured by outcome, so a run of
                 entries can be scanned down rather than read across. */
              <ul className="mt-6 flex flex-col gap-px overflow-hidden rounded-xl bg-white/10">
                {mine.map((entry) => (
                  <li key={entry.id} className="bg-ground p-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="text-sm font-semibold text-white">
                        Week {entry.weekNo}
                      </span>
                      <span className="text-sm text-white/45">
                        {platformLabels[entry.platform as CampaignPlatform] ??
                          entry.platform}
                      </span>
                      <StatusPill status={entry.status} />
                    </div>
                    <p className="mt-2 break-all text-sm leading-relaxed text-white/45">
                      {entry.url}
                    </p>
                    {entry.reviewNote && (
                      <p className="mt-3 border-l-2 border-white/20 pl-3 text-sm leading-relaxed text-white/70">
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