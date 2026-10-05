import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Clock } from "lucide-react";
import type {
  CreatorPageData,
  CreatorSession,
  CreatorSubmission,
  HandleRequestState,
} from "@/lib/creator-session";
import type { PauseState } from "@/lib/campaign-pause";
import { AccountRows, type AddReadyWhen } from "@/components/campaigns/account-rows";
import { CopyField } from "@/components/campaigns/copy-field";
import { EntryHistory } from "@/components/campaigns/entry-history";
import { PointsHistory } from "@/components/campaigns/points-history";
import { SignOutForm } from "@/components/campaigns/sign-out-form";
import { TimeLeftLabel } from "@/components/campaigns/time-left-label";
import { AddToCalendar } from "@/components/campaigns/add-to-calendar";
import { LocalTime } from "@/components/campaigns/local-time";
import { WeekRows, type WeekRow } from "@/components/campaigns/week-rows";
import { byPlatform, PLATFORM_ORDER } from "@/components/shared/platform-marks";
import { formatTimeLeft } from "@/lib/countdown";
import { closingAt } from "@/lib/format";
import { pointSourceLabel } from "@/lib/point-sources";
import {
  campaignBySlug,
  campaignOpensLabel,
  monicaPointLadder,
  monicaRoutes,
  monicaStages,
  MONICA_SLUG,
} from "@/lib/campaigns";
import { CONTACT_EMAIL } from "@/lib/constants";
import { signOut } from "@/app/campaigns/monica-money-story/enter/confirm/actions";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const LAGOS = "Africa/Lagos";

/**
 * Everything the signed-in page renders, already loaded and derived.
 *
 * page.tsx owns the session, the reads, the redirects and every state before
 * this one; it hands over exactly what it computed and nothing else.
 */
export interface MeDashboardProps {
  /** The session's own figures. */
  creator: Pick<CreatorSession, "pointsTotal" | "approvedEntries" | "referralCode">;
  /** Guarded, so the page's heading is never empty. */
  firstName: string;
  /** The joining date, already formatted in Lagos time. */
  joined: string;
  rank: number | null;
  status: CreatorPageData["status"];
  challenge: CreatorPageData["challenge"];
  platforms: CreatorPageData["platforms"];
  /** Every submission this creator has made. */
  mine: CreatorSubmission[];
  history: CreatorPageData["history"];
  handles: CreatorPageData["handles"];
  failed: CreatorPageData["failed"];
  pause: Pick<PauseState, "paused" | "reason">;
  handleRequests: HandleRequestState[];
  /** Platforms used up for the open week. Rejected entries do not count. */
  usedThisWeek: string[];
  thisWeek: CreatorSubmission[];
  rejectedThisWeek: CreatorSubmission[];
  stillToSubmit: string[];
  referralLink: string;
}

/* ---- The ballot's anatomy, once ----------------------------------------- */

/**
 * A section as one hairline card: a header row saying where it stands, once,
 * and its content as divided rows beneath. The ballot's shape, which the
 * owner approved, rather than a card holding a bordered list holding cards.
 */
function Card({
  id,
  title,
  status,
  edge,
  children,
}: {
  id: string;
  title: ReactNode;
  /** The section's one-line standing, right of the title. */
  status?: ReactNode;
  /** A 2px left edge for a whole-card state (a failed load). */
  edge?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`mt-6 scroll-mt-24 overflow-hidden rounded-xl border border-line-2 bg-card ${
        edge ? `border-l-2 ${edge}` : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
        <h2 id={`${id}-title`} className="text-base font-semibold text-white">
          {title}
        </h2>
        {status && <div className="text-sm text-ink-3">{status}</div>}
      </div>
      {children}
    </section>
  );
}

/** A row of prose inside a card: one sentence, on its hairline. */
function Line({ children, edge }: { children: ReactNode; edge?: string }) {
  return (
    <div className={`border-t border-line px-4 py-3 sm:px-5 ${edge ? `border-l-2 ${edge}` : ""}`}>
      <p className="max-w-prose text-sm leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

/** A state the week is in, said as a titled row on its coloured edge
    rather than as a filled warning box. */
function Notice({
  edge,
  title,
  children,
}: {
  edge: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`border-t border-line border-l-2 px-4 py-3 sm:px-5 ${edge}`}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-1 max-w-prose space-y-1 text-sm leading-relaxed text-ink-2">
        {children}
      </div>
    </div>
  );
}

const RED = "border-l-red-400/60";
const AMBER = "border-l-amber-400/60";

/**
 * A signed-in creator's own page, as a view.
 *
 * No data fetching: it renders from props, so every state it can be in can be
 * rendered from fixtures. The client pieces inside it stay client components.
 *
 * Same order as it always had (identity, the week, points, entries,
 * accounts, referral, the way back in, sign out). Every section is one
 * border-line-2 card whose header says where it stands once, with its
 * content as divided rows carrying state on a 2px left edge. Gold is left on
 * the live clock and the submit button only.
 */
export function MeDashboard({
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
  thisWeek,
  stillToSubmit,
  referralLink,
}: MeDashboardProps) {
  const active = status === "active";
  const handleOf: Record<string, string> = Object.fromEntries(
    handles.map((h) => [h.platform, h.handle]),
  );

  /* The open week's rows: every registered platform, plus any platform with
     a post this week, so a failed accounts read never hides a sent post. */
  const onThisWeek = [...new Set<string>([...platforms, ...thisWeek.map((s) => s.platform)])];
  /* Taking entries: not removed, not paused, and the accounts were read.
     Without the last, stillToSubmit is empty for the wrong reason. The same
     rule decides whether a take back can promise a resend. */
  const canSend = active && !pause.paused && !failed.platforms;
  const weekRows: WeekRow[] = byPlatform(onThisWeek, (p) => p).map((platform) => {
    const entry = thisWeek.find((s) => s.platform === platform);
    return {
      platform,
      // The registered account, so the form can name the rule it refuses on
      // most often: the post has to come from it.
      handle: handleOf[platform] ?? null,
      entry: entry
        ? { id: entry.id, status: entry.status, url: entry.url, reviewNote: entry.reviewNote }
        : null,
      canSubmit: canSend && stillToSubmit.includes(platform),
    };
  });

  /* Derived from the registry, never typed here. This line carried the old
     100/200/300 ladder for a day after the rules changed, which is exactly
     what a second copy of a number does. */
  const ladder = `${monicaPointLadder
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
    .join(", ")}, and it stays one entry either way.`;

  /* The open week lives in its own card; the entries card holds the rest,
     and is not drawn at all when a week is open and nothing came before. */
  const earlier = challenge ? mine.filter((s) => s.weekNo !== challenge.weekNo) : mine;
  const showEntries = failed.submissions || earlier.length > 0 || !challenge;

  const now = new Date();
  const upcoming = CAMPAIGN.startsAt && new Date(CAMPAIGN.startsAt) > now;
  /*
   * The stage not yet over, chosen by its end, not its start. Whether a
   * challenge is open is the database's answer (status 'active' and its own
   * window), and stages 2 to 4 are switched on in the console when they
   * drop, so a stage's window can have started with nothing live yet.
   * Choosing by start named the stage after that one, a week out. So a date
   * is said only while the window is still ahead; once it has started, the
   * week is coming but the flip can slip, and no time is promised.
   */
  const stage = monicaStages.find((s) => new Date(s.endsAt) > now);
  const stageStarted = stage ? new Date(stage.startsAt) <= now : false;
  /* When an account added now can first be sent from, by the same lookup
     as the week card: open now, the next challenge, never (all are over),
     or not known because the challenge could not be read. */
  const addReady: AddReadyWhen = challenge
    ? "open"
    : failed.challenge
      ? "unknown"
      : stage
        ? "next"
        : "over";

  return (
    <main id="main" className="bg-ground">
      {/* pt trimmed: the default 40px above a back link is 40px of nothing. */}
      <section className="section-y pt-6 sm:pt-10">
        <div className="container-page">
          {/* The full page container, the width the winners page and the
              leaderboard use. A 48rem column sat against the left edge of
              the 72rem container on a laptop, with a third of the screen
              empty beside it; the owner asked for the content wider.
              Paragraphs keep their own max-w-prose, so lines stay readable. */}
          <div>
            <Link
              href={monicaRoutes.landing}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {CAMPAIGN.name}
            </Link>

            {/* Who, and where they stand. Sentence case at 24px, not 48px
                uppercase: an eighteen character Yoruba or Igbo given name
                overruns a 343px content box at that size. The total lives in
                the points card's header, over the rows that make it. */}
            <div className="mt-5">
              <h1 className="break-words text-2xl font-bold tracking-[-0.02em] text-white">
                {firstName}
              </h1>
              <p className="mt-1 text-sm tabular-nums text-ink-3">
                <span className="font-semibold text-white">
                  {rank === null ? "Not ranked yet" : `Rank ${rank}`}
                </span>{" "}
                · {creator.approvedEntries} approved · joined {joined}
              </p>
            </div>

            {/* The three places to go, as controls with a shape and a tap
                target rather than the tail of a sentence about points. */}
            <nav aria-label="Elsewhere in the campaign" className="mt-4">
              <ul className="flex flex-wrap gap-2">
                {[
                  { href: monicaRoutes.leaderboard, label: "Leaderboard" },
                  { href: monicaRoutes.winners, label: "Winners" },
                  { href: monicaRoutes.resources, label: "Resources" },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex min-h-11 items-center rounded-full border border-line-2 px-3 text-sm font-semibold text-ink-2 transition-colors duration-150 hover:bg-card-2 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* THE WEEK. The reason for the visit, first after the identity
                line. The head is present in every state so the clock never
                disappears, including during a pause. */}
            {challenge ? (
              <section
                id="week"
                aria-labelledby="week-title"
                className="mt-6 overflow-hidden rounded-xl border border-line-2 bg-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold">
                    <span className="text-white">Week {challenge.weekNo}</span>
                    <span className="text-ink-4" aria-hidden="true">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-brand-gold">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      <TimeLeftLabel
                        endsAt={challenge.endsAt.toISOString()}
                        initial={formatTimeLeft(challenge.endsAt.toISOString())}
                      />
                    </span>
                  </p>
                  {/* The absolute instant, because submit_entry enforces it
                      to the second, in the ballot's words: "12:00", never
                      "0:00 pm". */}
                  <p className="text-sm text-balance text-ink-3">
                    Closes{" "}
                    <time dateTime={challenge.endsAt.toISOString()}>
                      {closingAt(challenge.endsAt)}
                    </time>
                    , Lagos time
                    <LocalTime at={challenge.endsAt.toISOString()} />
                  </p>
                </div>
                <AddToCalendar weekNo={challenge.weekNo} className="border-t border-line px-4 sm:px-5" />

                <div className="border-t border-line px-4 py-4 sm:px-5">
                  <h2 id="week-title" className="text-xl font-bold text-pretty text-white">
                    {challenge.title}
                  </h2>
                  <p className="mt-2 max-w-prose text-base leading-relaxed text-ink-2">
                    {challenge.description}
                  </p>
                </div>

                {/* Removed from the campaign comes first, because every
                    branch below offers work that will be refused. A creator
                    used to discover this by filming a week's work and
                    pasting the link. */}
                {!active ? (
                  <Notice edge={RED} title="Your place in the campaign has been removed">
                    <p>
                      Entries are not being scored, and anything you send now
                      will be refused.
                    </p>
                    <p className="text-ink-3">
                      If you believe this is wrong, reply to the email we sent
                      with the reason, or write to{" "}
                      <a
                        href={`mailto:${CONTACT_EMAIL}`}
                        className="text-link underline underline-offset-2 [overflow-wrap:anywhere] hover:text-white"
                      >
                        {CONTACT_EMAIL}
                      </a>{" "}
                      from that address, and a person will look at it.
                    </p>
                  </Notice>
                ) : pause.paused ? (
                  <Notice edge={AMBER} title="Submissions are paused">
                    <p>
                      {/* pauseState returns null for a blank reason, and this
                          is the most alarming state the page can show. It
                          does not get to have a hole in the middle of it. */}
                      {pause.reason ??
                        "We have stopped submissions for a moment. Nothing you have already sent is affected."}
                    </p>
                    <p className="text-ink-3">
                      The challenge above still stands, so keep working and
                      paste your link when this clears.
                    </p>
                  </Notice>
                ) : failed.platforms ? (
                  /* The read failed, so stillToSubmit is empty for the wrong
                     reason. Without this the rows would say the week is done
                     while offering nothing to send, which is the most
                     expensive lie this page can tell. */
                  <Notice edge={AMBER} title="We could not load your accounts">
                    <p>
                      This is at our end and not a sign that anything is
                      missing; refresh in a moment and your platforms will be
                      here to send from.
                    </p>
                  </Notice>
                ) : null}

                {weekRows.length > 0 && (
                  <WeekRows
                    rows={weekRows}
                    weekNo={challenge.weekNo}
                    challengeTitle={challenge.title}
                    statusKnown={!failed.submissions}
                    canResend={canSend}
                  />
                )}

                {active && !failed.platforms && (
                  <div className="border-t border-line px-4 py-3 sm:px-5">
                    <p className="max-w-prose text-sm leading-relaxed text-ink-3">
                      {stillToSubmit.length === 0
                        ? "Everything you registered is in for this week; each platform is reviewed on its own, so they can land at different times."
                        : ladder}
                    </p>
                  </div>
                )}
              </section>
            ) : failed.challenge ? (
              <Card id="week" title="We could not load this week" edge={AMBER}>
                <Line>
                  Something went wrong at our end, not with your entry; refresh
                  in a moment, and nothing you have already sent is affected.
                </Line>
              </Card>
            ) : (
              <Card
                id="week"
                title={
                  upcoming
                    ? `The first challenge opens ${campaignOpensLabel(CAMPAIGN)}`
                    : "No challenge is open"
                }
                status={
                  upcoming || !stage
                    ? null
                    : stageStarted
                      ? `Week ${stage.number} opens soon`
                      : `The next opens ${new Date(stage.startsAt).toLocaleDateString("en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          timeZone: LAGOS,
                        })}`
                }
              >
                <Line>
                  {stage
                    ? "It appears here when it opens, with somewhere to paste your link."
                    : "All four challenges have closed."}
                </Line>
                {/* Full-bleed in an overflow-hidden card: the site's ring sits
                    outside the box and would be clipped to its top edge, so
                    this one is drawn inside. */}
                <Link
                  href={`${monicaRoutes.landing}#stages`}
                  className="flex min-h-12 items-center justify-between gap-2 border-t border-line px-4 text-sm font-semibold text-link transition-colors duration-150 hover:bg-card-2 hover:text-white focus-visible:outline-offset-[-4px] sm:px-5"
                >
                  See all four challenges
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Card>
            )}

            {/*
             * How the total was arrived at: the total in the header, the
             * ledger as its rows. The rules promise that every bonus and
             * every correction is "recorded against your account with the
             * reason, and you can see it on your own page". The whole ledger,
             * not just the bonuses: somebody checking an unexpected total
             * wants the arithmetic to add up.
             */}
            <Card
              id="points"
              title="Your points"
              status={
                <span>
                  <span className="text-base font-bold tabular-nums text-white">
                    {creator.pointsTotal}
                  </span>{" "}
                  total
                </span>
              }
            >
              {failed.history ? (
                <Line edge={AMBER}>
                  We could not load the breakdown just now; the total is
                  correct, so refresh in a moment.
                </Line>
              ) : history.length === 0 ? (
                <Line>Every point you earn is listed here, with its reason.</Line>
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
            </Card>

            {/* ENTRIES: every week but the open one, grouped by week. */}
            {showEntries && (
              <Card
                id="entries"
                title={challenge && !failed.submissions ? "Earlier weeks" : "Your entries"}
                status={
                  !failed.submissions && earlier.length > 0
                    ? `${earlier.length} ${earlier.length === 1 ? "post" : "posts"}`
                    : null
                }
              >
                {failed.submissions ? (
                  /* Never "nothing yet" when we simply could not read them.
                     A creator who believes their work was lost submits it
                     again. */
                  <Line edge={AMBER}>
                    We could not load your entries just now; they are safe, so
                    refresh in a moment.
                  </Line>
                ) : earlier.length === 0 ? (
                  <Line>Nothing sent yet.</Line>
                ) : (
                  <EntryHistory
                    openWeekKnown={!failed.challenge}
                    entries={earlier.map((entry) => ({
                      id: entry.id,
                      weekNo: entry.weekNo,
                      challengeTitle: entry.challengeTitle,
                      platform: entry.platform,
                      status: entry.status,
                      url: entry.url,
                      reviewNote: entry.reviewNote,
                    }))}
                  />
                )}
              </Card>
            )}

            {/* ACCOUNTS. Adding is not offered once the enrolment stops
                being active: the page has already said their place was
                removed, and inviting them to set up a platform to submit
                from would be a control that cannot work. */}
            {handles.length > 0 && (
              <Card
                id="accounts"
                title="Your accounts"
                status="Entries count only from accounts added here"
              >
                <AccountRows
                  handles={handles}
                  requests={handleRequests}
                  missing={
                    active
                      ? PLATFORM_ORDER.filter((p) => !handles.some((h) => h.platform === p))
                      : []
                  }
                  paused={pause.paused}
                  when={addReady}
                />
              </Card>
            )}

            {/* The referral link the registration screen promised would be
                here. It only works as a ?ref= link on /join; there is
                nowhere in the flow to type a code by hand. */}
            <Card id="referral" title="Bring a creator in" status="10 points each">
              <CopyField
                value={referralLink}
                label="Copy your referral link"
                hint="Paid when they get their first approved entry, not when they register."
                shareTitle={CAMPAIGN.name}
                shareText="Join me on the Monica campaign"
              />
            </Card>

            {/* The quiet last row. The way back in is collapsed, needed once
                by the person it happens to; signing out must be possible on
                a borrowed phone, since the session otherwise runs ninety
                sliding days, and quiet, because for the owner on their own
                phone it is the one control here they should never need. */}
            <SignOutForm
              action={signOut}
              help={
                <ul className="divide-y divide-line border-t border-line text-sm leading-relaxed text-ink-2">
                  <li className="px-4 py-3 sm:px-5">
                    This page remembers you in one browser, and a link opened
                    inside WhatsApp or Instagram lands in theirs, not in your
                    Chrome or Safari.
                  </li>
                  <li className="px-4 py-3 sm:px-5">
                    Bookmark this page in the browser you actually use, or add
                    it to your home screen, and keep the registration email,
                    which has your link.
                  </li>
                  <li className="px-4 py-3 sm:px-5">
                    {/* No copy button. The address bar here is just /me, and
                        pasted anywhere else it shows the locked page: a
                        button would hand somebody a link that looks like a
                        rescue and is not one. */}
                    Lost it? The{" "}
                    <Link
                      href={monicaRoutes.recover}
                      className="text-link underline underline-offset-2 hover:text-white"
                    >
                      Lost your link
                    </Link>{" "}
                    page mails a new one to your registered address and stops
                    the old one working; if that inbox is gone,{" "}
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                        `Lost my campaign link (${creator.referralCode})`,
                      )}`}
                      className="text-link underline underline-offset-2 hover:text-white"
                    >
                      email us
                    </a>{" "}
                    and a person sorts it out.
                  </li>
                </ul>
              }
            />
          </div>
        </div>
      </section>
    </main>
  );
}
