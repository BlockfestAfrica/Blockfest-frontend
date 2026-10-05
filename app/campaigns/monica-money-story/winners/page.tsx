import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  currentShortlist,
  finalCounts,
  flaggedWeeks,
  publicRounds,
  publishedWinners,
  voteWindowState,
} from "@/lib/winners";
import { actionsNow, weekTimeline, winnersByWeek } from "@/lib/winner-weeks";
import { DoThisNow, WeekCard, WeekStrip } from "@/components/campaigns/weekly-winners";
import {
  campaignBySlug,
  monicaRoutes,
  monicaStages,
  MONICA_SLUG,
} from "@/lib/campaigns";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;

export const metadata: Metadata = {
  title: "Winners",
  description: `Weekly winners and the Community Favourite shortlist for ${CAMPAIGN.name}.`,
};

/**
 * Rebuilt at most once a minute, like the leaderboard.
 *
 * Announcing is a deliberate act by an owner, so this does not need to be
 * instant, but it does need to be soon: a winner told they have been announced
 * should not have to explain why the page still says otherwise.
 */
export const revalidate = 60;

export default async function WinnersPage() {
  const [winners, shortlist, finals, rounds, flagged] = await Promise.all([
    publishedWinners(),
    currentShortlist(),
    finalCounts(),
    publicRounds(),
    flaggedWeeks(),
  ]);

  /*
   * Where the shortlist's round sits in its window. All entries share one
   * round, so the first row answers for all of them.
   *
   * Three states, not two. The old version read only closes_at, so a round
   * staged on Saturday for a Sunday morning open was rendered "Open now"
   * with live ballots for fourteen hours, while cast_vote refused every
   * one of them and the nominees' own email correctly said it opened
   * Sunday. Two public statements about one vote, contradicting each
   * other, on the night nominees push the link hardest. The engine was
   * right throughout; the page was the thing lying.
   *
   * Still presentation only: the engine re-checks the window on every cast.
   * An unreadable opens_at falls through to open rather than to not-yet,
   * because a page that refuses to show a live ballot kills the vote
   * outright, while the engine refuses an early cast on its own.
   */
  const ballotState = voteWindowState(shortlist[0]);

  /* Every week in calendar order, with where it stands, and what a
     visitor can do about it now. The page is rebuilt at most once a minute,
     so "now" is that rebuild's; the clocks tick on in the browser. */
  const now = Date.now();
  const placed = winnersByWeek({
    stages: monicaStages,
    winners,
    rounds,
    finals,
    flagged,
    now,
  });
  const { live } = placed;
  const timeline = weekTimeline(monicaStages, placed, now);
  const actions = actionsNow(timeline);

  /* The week whose ballot is on the page: the open (or staged) round's,
     until its Community Favourite is announced. */
  const ballotWeek =
    shortlist.length > 0 &&
    (ballotState === "open" || ballotState === "before") &&
    !winners.some(
      (w) => w.weekNo === shortlist[0].weekNo && w.category === "community_favourite",
    )
      ? shortlist[0].weekNo
      : null;

  /* The live count follows one round, the newest to have opened (see
     voteBoard), so it goes under that week only. Two weeks can be voting at
     once, last week's in review while this week's is open, and drawing it
     under both said the newest round's numbers twice, once under the wrong
     week. */
  const countWeek = live
    .filter((week) => week.vote === "open" || week.vote === "closed")
    .sort((a, b) => Date.parse(b.voteOpensAt) - Date.parse(a.voteOpensAt))[0]?.weekNo;

  /* #shortlist is where the nominee emails and the stage cards send people
     to vote. It is the ballot while one is on the page; otherwise the week
     whose vote is being counted or reviewed, so the link still lands on
     that vote rather than the top of the page. */
  const shortlistWeek = ballotWeek ?? countWeek ?? null;

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

          <p className="eyebrow mt-6 text-brand-gold">{CAMPAIGN.name}</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
            Winners
          </h1>
          {/* Who decides each award, said once for the whole page. No
              promise of a day: week 2's vote opened on a Monday. */}
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
            Every week has two prizes: Creator of the Week, picked by the
            Blockfest team, and Community Favourite, picked by a public vote
            on that week&apos;s shortlist. Each vote opens after its
            week&apos;s entries close. All times are Lagos time.
          </p>

          {/* What a visitor can do right now, before anything else. */}
          <DoThisNow actions={actions} ballotWeek={ballotWeek} />

          {/* Every week, done and to come: the index, then a card each, in
              calendar order, each saying where it stands. */}
          <section aria-labelledby="by-week" className="mt-12">
            <h2 id="by-week" className="eyebrow text-ink-3">
              Week by week
            </h2>
            <WeekStrip timeline={timeline} />
            <div className="mt-6 flex flex-col gap-4">
              {timeline.map((entry) => (
                <WeekCard
                  key={entry.week.weekNo}
                  entry={entry}
                  last={entry.week.weekNo === monicaStages.length}
                  shortlist={shortlist}
                  ballotState={ballotState}
                  countHere={entry.week.weekNo === countWeek}
                  shortlistHere={entry.week.weekNo === shortlistWeek}
                />
              ))}
            </div>
          </section>

          <p className="mt-10 max-w-prose text-sm leading-relaxed text-ink-3">
            How points are earned is in the{" "}
            <Link
              href={monicaRoutes.rules}
              className="text-link underline underline-offset-2 hover:text-white"
            >
              campaign rules
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
