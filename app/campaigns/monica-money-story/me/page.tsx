import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import {
  creatorPageData,
  handleRequestsForEnrolment,
  currentCreator,
  legacySessionHolder,
  platformsUsedThisWeek,
  type CreatorSubmission,
} from "@/lib/creator-session";
import { creatorRank } from "@/lib/leaderboard";
import { pauseState } from "@/lib/campaign-pause";
import {
  campaignBySlug,
  monicaRoutes,
  MONICA_SLUG,
} from "@/lib/campaigns";
import { CONTACT_EMAIL } from "@/lib/constants";
import { logWarning } from "@/lib/log";
import {
  LAGOS,
  MeDashboard,
  type MeDashboardProps,
} from "@/components/campaigns/me-dashboard";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://blockfestafrica.com";

export const metadata: Metadata = {
  title: "Your campaign page",
  // Never indexed. It is somebody's own page, reached with a secret, and the
  // only thing a crawler could ever see here is the locked state.
  robots: { index: false, follow: false },
};

/**
 * A creator's own page.
 *
 * Rebuilt around what somebody actually opens it for. The old order put the
 * name in display type, then three figures, then a leaderboard link, and only
 * then the challenge and the box to paste a link into: about 640 pixels down a
 * 375 pixel phone, under a sticky navbar, so the one reason for the visit was
 * below the fold every single week.
 *
 * Now the week block is the page. It is a card with a filled gold header, which
 * is the only filled surface anywhere on the site, and it carries the week and
 * the time left in every state so the clock is never hidden. The standing is
 * one line of figures above it, because knowing you have 400 points takes a
 * glance and pasting a link takes a minute.
 *
 * Dynamic, always. The whole page is a function of a cookie, so it must not be
 * prerendered and must never be cached: a cached render is one creator's points
 * shown to the next visitor.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MonicaCreatorPage() {
  /*
   * The last unguarded await on this page.
   *
   * creatorPageData, pauseState and creatorRank were all made to fail soft, and
   * this one was missed. It is the worst one to miss: it runs before any of
   * them, so a blip here is the whole page gone for every signed-in creator,
   * which is exactly the outage this page already had once today.
   *
   * A failure is not the same as being signed out, and must not be told as one.
   * "We do not know who you are" sends a creator hunting for a link that works
   * perfectly well.
   */
  let creator: Awaited<ReturnType<typeof currentCreator>> = null;
  let sessionUnavailable = false;
  let signedInBefore = false;
  try {
    creator = await currentCreator();
    /*
     * A creator signed in before the session cookie took its __Host- name
     * holds only the old one, which is never a session on its own. They are
     * sent to be asked once, by name, rather than told we do not know who
     * they are with a working link in their inbox.
     */
    if (!creator) signedInBefore = (await legacySessionHolder()) !== null;
  } catch (error) {
    sessionUnavailable = true;
    logWarning(
      "creator-page",
      `session could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Outside the try: redirect() works by throwing, and the catch above would
  // take it for a database failure.
  if (signedInBefore) redirect(`${monicaRoutes.enterConfirm}?s=go`);

  if (sessionUnavailable) {
    return (
      <main id="main" className="bg-ground">
        <section className="section-y">
          <div className="container-page max-w-2xl">
            <h1 className="text-display-sm font-bold text-white">
              We could not load your page
            </h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-2">
              Something went wrong at our end. Your link is fine and nothing you
              have sent is affected. Refresh in a moment.
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

  if (!creator) {
    return (
      <main id="main" className="bg-ground">
        <section className="section-y">
          <div className="container-page max-w-2xl">
            <h1 className="flex items-center gap-2 text-display-sm font-bold text-white">
              <Lock className="h-6 w-6 text-ink-4" aria-hidden="true" />
              We do not know who you are
            </h1>
            {/* The common case, said first and said plainly.
                The link in the welcome email is not spent by being used:
                it signs you in again, today and in a month. Landing here
                usually means a cleared cookie, a different phone or a
                sign-out, none of which touches the link.

                This screen previously led with a gold "Get a new link",
                and gold is the primary action everywhere else on the
                site, so the eye went to the one path that COSTS
                something: recovery rotates the token and kills the link
                sitting in that same inbox. The paragraph said the right
                thing and nobody reads a paragraph when a gold button is
                under it. */}
            <p className="mt-4 text-base leading-relaxed text-ink-3">
              Open the link in your welcome email and you will land straight
              back here. It does not expire and it does not get used up, so
              the same link works every time, on any device.
            </p>
            <div className="mt-5 rounded-xl border border-line-2 bg-card p-5">
              <p className="text-sm font-semibold text-white">
                Search your inbox for
              </p>
              <p className="mt-1 font-mono text-sm text-brand-gold">
                Your Monica campaign link, keep this email
              </p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
                Check your spam or promotions folder too. It came from
                noreply@blockfestafrica.com on the day you registered.
              </p>
            </div>

            {/* Second, and quieter, because it costs the thing above. */}
            <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-3">
              Genuinely cannot find that email?{" "}
              <Link
                href={monicaRoutes.recover}
                className="font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                Get a new link
              </Link>
              . It goes to the address you registered with, and it replaces
              the old one, so the link in that email stops working.
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-4">
              No longer have access to that inbox at all? Write to{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              and a person sorts it out.
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

  /*
   * Each part fails on its own.
   *
   * These used to be five promises in one Promise.all, three of them with no
   * error handling, so a blip on any one returned a 500 for the whole page
   * including the parts that had loaded. pauseState and creatorRank already
   * failed soft; creatorPageData does the same for the other three and reports
   * which ones could not be read, so a gap is shown as a gap rather than as
   * zero entries.
   */
  const [data, pause, rank, handleRequests] = await Promise.all([
    creatorPageData(creator.enrolmentId),
    pauseState(),
    creatorRank(creator.enrolmentId),
    // Soft like the rest: a blip here hides the request states, not the page.
    handleRequestsForEnrolment(creator.enrolmentId).catch(
      () => [] as Awaited<ReturnType<typeof handleRequestsForEnrolment>>,
    ),
  ]);

  const {
    status,
    challenge,
    platforms,
    submissions: mine,
    history,
    handles,
    failed,
  } = data;

  // Rejected entries deliberately do not count: see platformsUsedThisWeek.
  const usedThisWeek = challenge
    ? platformsUsedThisWeek(mine, challenge.weekNo)
    : [];

  const thisWeek: CreatorSubmission[] = challenge
    ? mine.filter((s) => s.weekNo === challenge.weekNo)
    : [];

  const rejectedThisWeek = thisWeek.filter((s) => s.status === "rejected");
  const stillToSubmit = platforms.filter((p) => !usedThisWeek.includes(p));

  /*
   * Guarded rather than split(" ")[0].
   *
   * A name stored with a leading space returns an empty string from that, and
   * the page's accessible heading becomes nothing at all.
   */
  const firstName =
    creator.name.trim().split(/\s+/)[0] || creator.name.trim() || "Your page";

  const joined = creator.joinedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: LAGOS,
  });

  const referralLink = `${SITE}${monicaRoutes.join}?ref=${creator.referralCode}`;

  const view: MeDashboardProps = {
    creator,
    firstName,
    joined,
    rank,
    status,
    challenge,
    platforms,
    mine,
    history,
    handles,
    failed,
    pause,
    handleRequests,
    usedThisWeek,
    thisWeek,
    rejectedThisWeek,
    stillToSubmit,
    referralLink,
  };

  return <MeDashboard {...view} />;
}
