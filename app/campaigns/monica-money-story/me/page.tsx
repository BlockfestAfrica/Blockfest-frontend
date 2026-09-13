import { pointSourceLabel } from "@/lib/point-sources";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import {
  creatorPageData,
  currentCreator,
  platformsUsedThisWeek,
  type CreatorSubmission,
} from "@/lib/creator-session";
import { creatorRank } from "@/lib/leaderboard";
import { SubmissionForm } from "@/components/campaigns/submission-form";
import { CopyField } from "@/components/campaigns/copy-field";
import { TimeLeftLabel } from "@/components/campaigns/time-left-label";
import { formatTimeLeft } from "@/lib/countdown";
import { HeadedPanel, Panel, Pill, Stat } from "@/components/shared/panel";
import { pauseState } from "@/lib/campaign-pause";
import {
  campaignBySlug,
  monicaRoutes,
  MONICA_SLUG,
  platformLabels,
  type CampaignPlatform,
  monicaPointLadder,
} from "@/lib/campaigns";
import { CONTACT_EMAIL } from "@/lib/constants";

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
 * then the brief and the box to paste a link into: about 640 pixels down a
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
  try {
    creator = await currentCreator();
  } catch (error) {
    sessionUnavailable = true;
    console.warn(
      "[creator-page] session could not be read:",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (sessionUnavailable) {
    return (
      <main id="main" className="bg-ground">
        <section className="section-y">
          <div className="container-page max-w-2xl">
            <h1 className="text-display-sm font-bold text-white">
              We could not load your page
            </h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-white/70">
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
              <Lock className="h-6 w-6 text-white/40" aria-hidden="true" />
              We do not know who you are
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              This page opens from the personal link you were given when you
              registered, and emailed to you at the same time. Open that link
              again and you will land back here.
            </p>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              If you have lost it, write to{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              from the email address you registered with and we will issue a new
              one. We cannot read your old link back to you, which is why a new
              one is the only way: a link we could recover is a link somebody
              else could take.
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
  const [data, pause, rank] = await Promise.all([
    creatorPageData(creator.enrolmentId),
    pauseState(),
    creatorRank(creator.enrolmentId),
  ]);

  const {
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
              <Pill tone="gold">Rank {rank}</Pill>
            )}
          </div>
          <p className="mt-2 text-sm text-white/50">
            {creator.pointsTotal} points · {creator.approvedEntries} approved ·
            joined {joined}
          </p>

          {/* THE WEEK. The reason for the visit, roughly 235px down instead of
              640px. The head is present in every state so the clock never
              disappears, including during a pause. */}
          {challenge ? (
            <HeadedPanel
              className="mt-8"
              head={
                <>
                  <p className="eyebrow">Week {challenge.weekNo}</p>
                  <p className="text-sm font-bold">
                    <TimeLeftLabel
                      endsAt={challenge.endsAt.toISOString()}
                      initial={formatTimeLeft(challenge.endsAt.toISOString())}
                    />
                  </p>
                </>
              }
            >
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                {challenge.title}
              </h2>
              {/* The absolute instant, because submit_entry enforces it to the
                  second and a creator posting at 10pm against a 6pm close loses
                  the week to a formatting choice. */}
              <p className="mt-1 text-sm text-white/55">
                Closes {closingLabel(challenge.endsAt)} Lagos time
              </p>
              <p className="mt-3 max-w-prose text-base leading-relaxed text-white/75">
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
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-ground/60 py-1 pl-3 pr-1.5 text-sm text-white/70">
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

              {/* Derived from the registry, never typed here. This line
                  carried the old 100/200/300 ladder for a day after the rules
                  changed, which is exactly what a second copy of a number
                  does. */}
              <p className="mt-4 text-sm leading-relaxed text-white/70">
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
                      className="mt-2 text-sm leading-relaxed text-white/75"
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
                  <p className="mt-3 text-sm leading-relaxed text-white/60">
                    The week is still open, so you can fix it and send it again
                    below.
                  </p>
                </Panel>
              )}

              <div className="mt-6">
                {pause.paused ? (
                  <Panel tone="warn">
                    <p className="text-sm font-semibold text-amber-200">
                      Submissions are paused
                    </p>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/75">
                      {/* pauseState returns null for a blank reason, and this
                          is the most alarming state the page can show. It does
                          not get to have a hole in the middle of it. */}
                      {pause.reason ??
                        "We have stopped submissions for a moment. Nothing you have already sent is affected."}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/55">
                      The brief above still stands, so you can keep working.
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
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/75">
                      This is at our end, not yours, and it is not a sign that
                      anything is missing. Refresh in a moment and the form will
                      be here.
                    </p>
                  </Panel>
                ) : stillToSubmit.length === 0 ? (
                  <p className="text-sm leading-relaxed text-white/60">
                    Everything you registered is in for this week. Each platform
                    is reviewed on its own, so they can land at different times.
                  </p>
                ) : (
                  <SubmissionForm
                    platforms={platforms as CampaignPlatform[]}
                    alreadySubmitted={usedThisWeek}
                    challengeTitle={challenge.title}
                  />
                )}
              </div>
            </HeadedPanel>
          ) : failed.challenge ? (
            <Panel tone="warn" className="mt-8">
              <h2 className="text-xl font-bold text-white">
                We could not load this week
              </h2>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/70">
                Something went wrong at our end, not with your entry. Refresh in
                a moment. Nothing you have already sent is affected.
              </p>
            </Panel>
          ) : (
            <Panel tone="quiet" className="mt-8">
              <h2 className="text-xl font-bold text-white">
                {CAMPAIGN.startsAt && new Date(CAMPAIGN.startsAt) > new Date()
                  ? "The first brief opens Monday 14 September"
                  : "No brief is open"}
              </h2>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/60">
                A new one opens each Monday. When it does it appears here, with
                somewhere to paste your link.
              </p>
              <Link
                href={`${monicaRoutes.landing}#stages`}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                See all four briefs
              </Link>
            </Panel>
          )}

          {/* Figures, below the action. One shared rule so three numbers read as
              one row, and no hint on any of them: a hint under one figure hangs
              it two lines below its siblings and the rules stop lining up. */}
          <div className="mt-12 border-t border-white/15 pt-4">
            {/* Three one-word labels over numbers, about 104px each at 360px.
                Stacking them costs roughly 300px on the screen creators open
                weekly, which is the space this redesign exists to reclaim.
                mobile-grid-ok: numeric figures, no prose in a column */}
            <div className="grid grid-cols-3 gap-4">
              <Stat
                rule={false}
                label="Rank"
                // Not an em dash. A plain hyphen is the convention for a
                // figure that has no value yet.
                value={rank === null ? "-" : rank}
              />
              <Stat rule={false} label="Points" value={creator.pointsTotal} />
              <Stat
                rule={false}
                label="Approved"
                value={creator.approvedEntries}
              />
            </div>
            <p className="mt-3 text-sm text-white/45">
              {rank === null
                ? "You are ranked once you have your first approved entry."
                : "Standings update as entries are approved."}{" "}
              <Link
                href={monicaRoutes.leaderboard}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                See the leaderboard
              </Link>
            </p>
          </div>

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
            <div className="mt-12">
              <h2 className="text-xl font-bold text-white">Your points</h2>

              {failed.history ? (
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-amber-200/80">
                  We could not load the breakdown just now. Your total above is
                  correct. Refresh in a moment.
                </p>
              ) : (
                <ul className="mt-5 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/12">
                  {history.map((movement) => (
                    <li
                      key={movement.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4"
                    >
                      <span className="text-sm font-semibold text-white">
                        {pointSourceLabel(movement.source)}
                        {movement.weekNo ? ` · week ${movement.weekNo}` : ""}
                      </span>
                      {/* Signed, because a correction is a negative row and
                          showing it as a bare number would read as an award. */}
                      <span
                        className={`ml-auto shrink-0 text-base font-bold tabular-nums ${
                          movement.points < 0 ? "text-red-300" : "text-white"
                        }`}
                      >
                        {movement.points > 0 ? "+" : ""}
                        {movement.points}
                      </span>
                      <span className="w-full text-sm text-white/55">
                        {movement.at.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          timeZone: LAGOS,
                        })}
                      </span>
                      {movement.note && (
                        <p className="w-full text-sm leading-relaxed text-white/70">
                          {movement.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-xl font-bold text-white">
              Your entries{mine.length > 0 ? ` (${mine.length})` : ""}
            </h2>

            {failed.submissions ? (
              /* Never "nothing yet" when we simply could not read them. A
                 creator who believes their work was lost submits it again. */
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-amber-200/80">
                We could not load your entries just now. They are safe. Refresh
                in a moment.
              </p>
            ) : mine.length === 0 ? (
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/55">
                Nothing yet. Publish your answer on your own account, then paste
                the link above.
              </p>
            ) : (
              <ul className="mt-5 flex flex-col gap-px overflow-hidden rounded-xl bg-white/10">
                {mine.map((entry) => {
                  const state = statusPill(entry.status);
                  return (
                    <li key={entry.id} className="bg-ground p-5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="text-sm font-semibold text-white">
                          Week {entry.weekNo}
                        </span>
                        <span className="text-sm text-white/45">
                          {platformLabels[entry.platform as CampaignPlatform] ??
                            entry.platform}
                        </span>
                        <Pill tone={state.tone}>{state.label}</Pill>
                      </div>
                      {/* Tappable, because the commonest rejection reason is an
                          entry that cannot be viewed at the link given, and on a
                          phone there is no other way to check that. break-words
                          rather than break-all: break-all shatters a URL at
                          arbitrary characters. */}
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block break-words text-sm leading-relaxed text-white/45 underline underline-offset-2 [overflow-wrap:anywhere] hover:text-white/70"
                      >
                        {entry.url}
                      </a>
                      {entry.reviewNote && (
                        <div
                          className={`mt-3 border-l-2 pl-3 ${
                            entry.status === "rejected"
                              ? "border-red-400/60"
                              : "border-white/20"
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                            {entry.status === "rejected"
                              ? "What to change"
                              : "Note from the reviewer"}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-white/75">
                            {entry.reviewNote}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* The referral link the registration screen promised would be here.
              It printed a bare code with the words "Share it", and there is
              nowhere in the whole flow to type a code by hand: it only works as
              a ?ref= link on /join. */}
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white">Bring a creator in</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/55">
              Worth 50 points each, credited when they get their first approved
              entry rather than when they register.
            </p>
            <CopyField
              value={referralLink}
              label="Copy your referral link"
              shareTitle={CAMPAIGN.name}
              shareText="Join me on the Monica campaign"
            />
          </div>

          {/* Last, and collapsed. Needed once, by the person it happens to. */}
          <details className="group mt-12">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
              Keeping your way back in
            </summary>
            <Panel tone="quiet" className="mt-3">
              <p className="max-w-prose text-sm leading-relaxed text-white/70">
                This page remembers you on this browser. The trap is opening
                your link inside WhatsApp or Instagram: that is a different
                browser from your normal one, so the page will not know you when
                you open Chrome or Safari later.
              </p>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/70">
                Bookmark this page in the browser you actually use, or add it to
                your home screen. Keep the email we sent at registration as
                well, since it has your link in it.
              </p>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/55">
                {/* No copy button. The address bar here is just /me, and pasted
                    anywhere else it shows the locked page: a button would hand
                    somebody a link that looks like a rescue and is not one. */}
                Lost it entirely?{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    `Lost my campaign link (${creator.referralCode})`,
                  )}`}
                  className="text-link underline underline-offset-2 hover:text-white"
                >
                  Email us
                </a>{" "}
                from the address you registered with and we will issue a new
                one, which stops the old one working.
              </p>
            </Panel>
          </details>
        </div>
      </section>
    </main>
  );
}
