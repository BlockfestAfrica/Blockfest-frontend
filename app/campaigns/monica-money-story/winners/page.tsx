import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  currentShortlist,
  finalCounts,
  publicRounds,
  publishedWinners,
  voteWindowState,
} from "@/lib/winners";
import { winnersByWeek } from "@/lib/winner-weeks";
import { LiveVoteCount } from "@/components/campaigns/live-vote-count";
import { LiveWeek, WinnersRecord } from "@/components/campaigns/weekly-winners";
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
  const [winners, shortlist, finals, rounds] = await Promise.all([
    publishedWinners(),
    currentShortlist(),
    finalCounts(),
    publicRounds(),
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

  /* Every week, placed once: happening now, or on record. The page is
     rebuilt at most once a minute, so "now" is that rebuild's. */
  const { live, record } = winnersByWeek({
    stages: monicaStages,
    winners,
    rounds,
    finals,
    now: Date.now(),
  });

  /* The live count follows one round, the newest to have opened (see
     voteBoard), so it goes under that week only. Two weeks can be voting at
     once, last week's in review while this week's is open, and drawing it
     under both said the newest round's numbers twice, once under the wrong
     week. */
  const countWeek = live
    .filter((week) => week.vote === "open" || week.vote === "closed")
    .sort((a, b) => Date.parse(b.voteOpensAt) - Date.parse(a.voteOpensAt))[0]?.weekNo;

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
          {/* Who decides each award, said once for the whole page. */}
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
            Every week has two prizes. Creator of the Week is chosen by the
            Blockfest team and announced on the Sunday after the week closes;
            Community Favourite is decided by a public vote that opens the same
            day.
          </p>

          {/* What is happening now: the stage that is running and any week
              whose vote is on. #shortlist is where the nominee emails and
              the stage cards send people to vote, and the open vote is
              always first here. */}
          {live.length > 0 && (
            <section
              id="shortlist"
              aria-labelledby="happening-now"
              className="mt-10 scroll-mt-24"
            >
              <h2 id="happening-now" className="eyebrow text-brand-gold">
                Happening now
              </h2>
              <div className="mt-3 flex flex-col gap-4">
                {live.map((week) => (
                  <Fragment key={week.weekNo}>
                    <LiveWeek
                      week={week}
                      shortlist={shortlist}
                      ballotState={ballotState}
                    />
                    {/* The count, under the week it counts rather than on
                        the ballot's rows: the rows stay in ballot order so a
                        half-typed vote never moves, and nobody is nudged by
                        a number beside the button. It loads in the browser,
                        so this page stays static and cached. */}
                    {week.weekNo === countWeek && <LiveVoteCount />}
                  </Fragment>
                ))}
              </div>
            </section>
          )}

          {record.length > 0 ? (
            <WinnersRecord weeks={record} of={monicaStages.length} />
          ) : (
            live.length === 0 && (
              <p className="mt-10 max-w-prose text-base leading-relaxed text-ink-3">
                Nothing announced yet; winners appear here once they are
                announced.
              </p>
            )
          )}

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
