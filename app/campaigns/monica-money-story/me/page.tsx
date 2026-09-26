import { AddPlatform } from "@/components/campaigns/add-platform";
import { SignOutForm } from "@/components/campaigns/sign-out-form";
import { HandleFix } from "@/components/campaigns/handle-fix";
import { pointSourceLabel } from "@/lib/point-sources";
import { PointsHistory } from "@/components/campaigns/points-history";
import { EntryHistory } from "@/components/campaigns/entry-history";
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
import { SubmissionForm } from "@/components/campaigns/submission-form";
import { CopyField } from "@/components/campaigns/copy-field";
import { TimeLeftLabel } from "@/components/campaigns/time-left-label";
import { formatTimeLeft } from "@/lib/countdown";
import { SectionCard, Panel, Pill } from "@/components/shared/panel";
import { pauseState } from "@/lib/campaign-pause";
import {
  campaignBySlug,
  campaignOpensLabel,
  monicaRoutes,
  MONICA_SLUG,
  platformLabels,
  type CampaignPlatform,
  monicaPointLadder,
} from "@/lib/campaigns";
import { CONTACT_EMAIL } from "@/lib/constants";
import { logWarning } from "@/lib/log";
import { signOut } from "@/app/campaigns/monica-money-story/enter/confirm/actions";

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

const LAGOS = "Africa/Lagos";

/** The closing instant, to the minute. A countdown alone leaves people guessing. */
function closingLabel(endsAt: Date): string {
  return endsAt.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: LAGOS,
  });
}

/**
 * Where a submission got to, using the shared Pill.
 *
 * This was a local copy of Pill's palette, character for character, minus its
 * layout classes, and with a fallback that dressed an unknown status in
 * "waiting to be reviewed" while printing the raw database token as its label.
 */
function statusPill(status: string) {
  const map: Record<
    string,
    { tone: "neutral" | "good" | "bad"; label: string }
  > = {
    pending: { tone: "neutral", label: "Waiting to be reviewed" },
    approved: { tone: "good", label: "Approved" },
    rejected: { tone: "bad", label: "Needs a change" },
  };
  const known = map[status];
  // An unmapped status says so rather than presenting itself as understood.
  return known ?? { tone: "neutral" as const, label: "In review" };
}

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

  return (
    <main id="main" className="bg-ground">
      {/* pt trimmed: the default 40px above a back link is 40px of nothing. */}
      <section className="section-y pt-6 sm:pt-10">
        <div className="container-page max-w-2xl">
          <Link
            href={monicaRoutes.landing}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {CAMPAIGN.name}
          </Link>

          {/* Identity in one row rather than a display heading plus a grid of
              three figures. Sentence case at 24px, not 48px uppercase: an
              eighteen character Yoruba or Igbo given name overruns a 343px
              content box at that size, and html/body clip rather than scroll. */}
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="break-words text-2xl font-bold tracking-[-0.02em] text-white">
              {firstName}
            </h1>
            {rank === null ? (
              <Pill>Not ranked yet</Pill>
            ) : (
              <Pill tone="gold"><span className="tabular-nums">Rank {rank}</span></Pill>
            )}
          </div>
          {/* The only place the figures live. A card below the week repeated
              all three of them and the page opened by saying the same numbers
              twice, which is most of what read as scatter. */}
          <p className="mt-2 text-sm tabular-nums text-ink-4">
            {creator.pointsTotal} points · {creator.approvedEntries} approved ·
            joined {joined}
          </p>

          {/* The three places to go, as controls rather than as the tail of
              a sentence about points. They were underlined links run on
              after the figures with middots between, so one line carried
              two unrelated jobs, read as text, and had to be picked apart
              before any of it could be used. Chips give them a shape, a
              tap target, and a wrap that does not strand one link alone. */}
          <nav aria-label="Elsewhere in the campaign" className="mt-3">
            <ul className="flex flex-wrap items-center gap-2">
              {[
                { href: monicaRoutes.leaderboard, label: "Leaderboard" },
                {
                  href: `${monicaRoutes.winners}#shortlist`,
                  label: "Winners and the vote",
                },
                { href: monicaRoutes.resources, label: "Resources" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center rounded-full border border-line-2 px-4 text-sm font-semibold text-ink-2 transition-colors hover:border-line-2 hover:bg-card-2 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* THE WEEK. The reason for the visit, roughly 235px down instead of
              640px. The head is present in every state so the clock never
              disappears, including during a pause. */}
          {challenge ? (
            /* A hairline rail instead of a filled gold strip. The week is the
               focal object here because it sits first and holds the form, not
               because its container shouts. Gold survives on the two pieces of
               text that are genuinely status, and on the submit button. */
            <section className="mt-8 rounded-xl border border-line-2 bg-card">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3 sm:px-6">
                <p className="eyebrow text-brand-gold">
                  Week {challenge.weekNo}
                </p>
                <p className="text-sm font-bold tabular-nums text-brand-gold">
                  <TimeLeftLabel
                    endsAt={challenge.endsAt.toISOString()}
                    initial={formatTimeLeft(challenge.endsAt.toISOString())}
                  />
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  {challenge.title}
                </h2>
                {/* The absolute instant, because submit_entry enforces it to the
                    second and a creator posting at 10pm against a 6pm close loses
                    the week to a formatting choice. */}
                <p className="mt-1 text-sm text-ink-3">
                  Closes {closingLabel(challenge.endsAt)} Lagos time
                </p>
                <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-2">
                  {challenge.description}
                </p>

                {/* Where each registered account stands this week, with the handle
                    attached, so "have I done TikTok yet" is answered by looking
                    rather than by scrolling to the entries list. */}
                <ul className="mt-5 flex flex-wrap gap-2">
                  {platforms.map((platform) => {
                    const entry = thisWeek.find((s) => s.platform === platform);
                    const state = entry ? statusPill(entry.status) : null;
                    return (
                      <li key={platform}>
                        <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-ground/60 py-1 pl-3 pr-1.5 text-sm text-ink-2">
                          {platformLabels[platform as CampaignPlatform] ??
                            platform}
                          {state ? (
                            <Pill tone={state.tone}>{state.label}</Pill>
                          ) : (
                            <Pill>Not sent</Pill>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {rejectedThisWeek.length > 0 && (
                  <Panel tone="warn" className="mt-5">
                    <p className="text-sm font-semibold text-amber-200">
                      {rejectedThisWeek.length === 1
                        ? "One entry needs a change"
                        : `${rejectedThisWeek.length} entries need a change`}
                    </p>
                    {rejectedThisWeek.map((entry) => (
                      <p
                        key={entry.id}
                        className="mt-2 text-sm leading-relaxed text-ink-2"
                      >
                        <span className="font-semibold text-white">
                          {platformLabels[entry.platform as CampaignPlatform] ??
                            entry.platform}
                          :
                        </span>{" "}
                        {entry.reviewNote ?? "No reason was recorded."}
                      </p>
                    ))}
                    {/* The whole point of migration 0011. Saying so here is the
                        difference between a dead end and an instruction. */}
                    <p className="mt-3 text-sm leading-relaxed text-ink-3">
                      The week is still open, so you can fix it and send it again
                      below.
                    </p>
                  </Panel>
                )}

                <div className="mt-6">
                  {/* Removed from the campaign. First, because every branch
                      below offers work that will be refused: the form, the
                      pause note, the what-is-left line. A creator used to
                      discover this by filming a week's work, publishing it
                      to three platforms and pasting the link. */}
                  {status !== "active" ? (
                    <Panel tone="warn">
                      <p className="text-sm font-semibold text-amber-200">
                        Your place in the campaign has been removed
                      </p>
                      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
                        Entries are not being scored, and anything you send
                        now will be refused. We emailed the reason to the
                        address you registered with.
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-3">
                        If you believe this is wrong, reply to that email, or
                        write to{" "}
                        <a
                          href={`mailto:${CONTACT_EMAIL}`}
                          className="text-link underline underline-offset-2 hover:text-white"
                        >
                          {CONTACT_EMAIL}
                        </a>{" "}
                        from that same address and a person will look at it.
                      </p>
                    </Panel>
                  ) : pause.paused ? (
                    <Panel tone="warn">
                      <p className="text-sm font-semibold text-amber-200">
                        Submissions are paused
                      </p>
                      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
                        {/* pauseState returns null for a blank reason, and this
                            is the most alarming state the page can show. It does
                            not get to have a hole in the middle of it. */}
                        {pause.reason ??
                          "We have stopped submissions for a moment. Nothing you have already sent is affected."}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-3">
                        The challenge above still stands, so you can keep working.
                        Come back and paste your link when this clears.
                      </p>
                    </Panel>
                  ) : failed.platforms ? (
                    /*
                     * The read failed, so stillToSubmit is empty for the wrong
                     * reason. Without this branch the next one fires and tells a
                     * creator they have finished the week while removing the form
                     * they would have used, which is the most expensive lie this
                     * page can tell.
                     */
                    <Panel tone="warn">
                      <p className="text-sm font-semibold text-amber-200">
                        We could not load your accounts
                      </p>
                      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
                        This is at our end, not yours, and it is not a sign that
                        anything is missing. Refresh in a moment and the form will
                        be here.
                      </p>
                    </Panel>
                  ) : stillToSubmit.length === 0 ? (
                    <p className="text-sm leading-relaxed text-ink-3">
                      Everything you registered is in for this week. Each platform
                      is reviewed on its own, so they can land at different times.
                    </p>
                  ) : (
                    <>
                      <SubmissionForm
                        platforms={platforms as CampaignPlatform[]}
                        /* The registered account per platform, so the form
                           can name the rule it refuses on most often. The
                           data was already loaded for the panel far below
                           the fold; it just never reached the one place a
                           creator could still act on it. */
                        handles={Object.fromEntries(
                          handles.map((h) => [h.platform, h.handle]),
                        )}
                        alreadySubmitted={usedThisWeek}
                        challengeTitle={challenge.title}
                      />

                {/* Derived from the registry, never typed here. This line
                    carried the old 100/200/300 ladder for a day after the rules
                    changed, which is exactly what a second copy of a number
                    does. */}
                <p className="mt-5 text-sm leading-relaxed text-ink-2">
                  {monicaPointLadder
                    .map(
                      (tier) =>
                        `${tier.points} points for ${
                          tier.platforms === 1
                            ? "the first platform"
                            : tier.platforms === 2
                              ? "two"
                              : "all three"
                        }`,
                    )
                    .join(", ")}
                  . It stays one entry either way.
                </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          ) : failed.challenge ? (
            <Panel tone="warn" className="mt-8">
              <h2 className="text-xl font-bold text-white">
                We could not load this week
              </h2>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">
                Something went wrong at our end, not with your entry. Refresh in
                a moment. Nothing you have already sent is affected.
              </p>
            </Panel>
          ) : (
            <Panel tone="quiet" className="mt-8">
              <h2 className="text-xl font-bold text-white">
                {CAMPAIGN.startsAt && new Date(CAMPAIGN.startsAt) > new Date()
                  ? `The first challenge opens ${campaignOpensLabel(CAMPAIGN)}`
                  : "No challenge is open"}
              </h2>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
                A new challenge drops with every stage; from Stage 2 onward that
                is every Monday. When it does it appears here, with somewhere
                to paste your link.
              </p>
              <Link
                href={`${monicaRoutes.landing}#stages`}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                See all four challenges
              </Link>
            </Panel>
          )}

          {/*
           * How the total was arrived at.
           *
           * The rules promise that every bonus is "recorded against your
           * account with the reason, and you can see it on your own page", and
           * that a correction is recorded the same way. Nothing creator-facing
           * read the ledger, so a creator whose total moved saw it move and
           * never why.
           *
           * The whole ledger, not just the bonuses: somebody checking an
           * unexpected total wants the arithmetic to add up, and a list missing
           * the entries it is mostly made of does not.
           */}
          {(history.length > 0 || failed.history) && (
            <SectionCard id="points" title="Your points" className="mt-6">

              {failed.history ? (
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-amber-200/80">
                  We could not load the breakdown just now. Your total above is
                  correct. Refresh in a moment.
                </p>
              ) : (
                <PointsHistory
                  movements={history.map((movement) => ({
                    id: movement.id,
                    label: `${pointSourceLabel(movement.source)}${
                      movement.weekNo ? ` · week ${movement.weekNo}` : ""
                    }`,
                    points: movement.points,
                    dateLabel: movement.at.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      timeZone: LAGOS,
                    }),
                    note: movement.note ?? null,
                  }))}
                />
              )}
            </SectionCard>
          )}

          <SectionCard
            id="entries"
            title={`Your entries${mine.length > 0 ? ` (${mine.length})` : ""}`}
            className="mt-6"
          >

            {failed.submissions ? (
              /* Never "nothing yet" when we simply could not read them. A
                 creator who believes their work was lost submits it again. */
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-amber-200/80">
                We could not load your entries just now. They are safe. Refresh
                in a moment.
              </p>
            ) : mine.length === 0 ? (
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
                Nothing yet. Publish your answer on your own account, then paste
                the link above.
              </p>
            ) : (
              <EntryHistory
                entries={mine.map((entry) => {
                  const state = statusPill(entry.status);
                  return {
                    id: entry.id,
                    weekNo: entry.weekNo,
                    platformLabel:
                      platformLabels[entry.platform as CampaignPlatform] ??
                      entry.platform,
                    status: entry.status,
                    statusTone: state.tone,
                    statusLabel: state.label,
                    url: entry.url,
                    reviewNote: entry.reviewNote,
                  };
                })}
              />
            )}
          </SectionCard>

          {/* The referral link the registration screen promised would be here.
              It printed a bare code with the words "Share it", and there is
              nowhere in the whole flow to type a code by hand: it only works as
              a ?ref= link on /join. */}
          {handles.length > 0 && (
            <SectionCard id="accounts" title="Your accounts" className="mt-6">
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
                Entries only count from these. Ask for a correction if one is
                wrong; the team reviews every request by hand.
              </p>
              <HandleFix
                handles={handles}
                requests={handleRequests}
                platformLabels={platformLabels}
              />
              {/* The other half of "your accounts": registration takes all
                  three and every one is optional, so somebody who only had X
                  that day had no way back to add Instagram later.

                  Not offered once the enrolment stops being active. The
                  engine refuses it either way, but this page has already
                  told them their place was removed and swapped the submit
                  form for that notice, and then invited them to set up a
                  platform to submit from. A control that cannot work is its
                  own defect, whatever the server does with it. */}
              {status === "active" && (
                <AddPlatform
                  missing={(["x", "instagram", "tiktok"] as const).filter(
                    (p) => !handles.some((h) => h.platform === p),
                  )}
                  platformLabels={platformLabels}
                  paused={pause.paused}
                />
              )}
            </SectionCard>
          )}

          <SectionCard id="referral" title="Bring a creator in" className="mt-6">
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
              10 points each, paid when they get their first approved entry,
              not when they register.
            </p>
            <CopyField
              value={referralLink}
              label="Copy your referral link"
              shareTitle={CAMPAIGN.name}
              shareText="Join me on the Monica campaign"
            />
          </SectionCard>

          {/* Last, and collapsed. Needed once, by the person it happens to. */}
          <details className="group mt-12">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink-2 hover:text-white">
              Keeping your way back in
            </summary>
            <Panel tone="quiet" className="mt-3">
              <p className="max-w-prose text-sm leading-relaxed text-ink-2">
                This page remembers you on this browser. The trap is opening
                your link inside WhatsApp or Instagram: that is a different
                browser from your normal one, so the page will not know you when
                you open Chrome or Safari later.
              </p>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">
                Bookmark this page in the browser you actually use, or add it to
                your home screen. Keep the email we sent at registration as
                well, since it has your link in it.
              </p>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
                {/* No copy button. The address bar here is just /me, and pasted
                    anywhere else it shows the locked page: a button would hand
                    somebody a link that looks like a rescue and is not one. */}
                Lost it entirely? The{" "}
                <Link
                  href={monicaRoutes.recover}
                  className="text-link underline underline-offset-2 hover:text-white"
                >
                  Lost your link
                </Link>{" "}
                page mails a new one to your registered address, which stops
                the old one working. If that inbox itself is gone,{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    `Lost my campaign link (${creator.referralCode})`,
                  )}`}
                  className="text-link underline underline-offset-2 hover:text-white"
                >
                  email us
                </a>{" "}
                and a person sorts it out.
              </p>
            </Panel>
          </details>

          {/* On a borrowed phone, leaving must be possible: the session
              otherwise runs ninety sliding days with nothing to end it.
              Quiet, because for the owner on their own phone it is the one
              control here they should never need. */}
          <SignOutForm action={signOut} />
        </div>
      </section>
    </main>
  );
}
