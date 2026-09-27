import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { currentShortlist, publishedWinners, voteWindowState } from "@/lib/winners";
import { SectionHeading } from "@/components/shared/panel";
import { Ballot } from "@/components/campaigns/ballot";
import { LiveVoteCount } from "@/components/campaigns/live-vote-count";
import { WeeklyWinners } from "@/components/campaigns/weekly-winners";
import { campaignBySlug, monicaRoutes, MONICA_SLUG } from "@/lib/campaigns";

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
  const [winners, shortlist] = await Promise.all([
    publishedWinners(),
    currentShortlist(),
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
  const round = shortlist[0];
  const voteState = voteWindowState(round);

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

          {/* Two named sections, present even while empty. The page holds
              two different things, announced winners and the weekly vote,
              and an unlabelled empty page taught neither: a visitor saw
              "Winners" and two loose paragraphs with no shape of what
              arrives where. */}
          <WeeklyWinners winners={winners} />

          {/* The shortlist, as one ballot (components/campaigns/ballot.tsx
              says why it is not a card per nominee any more). */}
          <section id="shortlist" className="mt-16 scroll-mt-24">
            <SectionHeading
              // The eyebrow must not say "Open now" above a line that says
              // voting has closed, nor above a ballot the engine will
              // refuse; the label follows the round's actual state.
              label={
                voteState === "open"
                  ? "Open now"
                  : voteState === "before"
                    ? "Opens soon"
                    : "The public vote"
              }
              title="Community Favourite vote"
              hint={
                round && (voteState === "open" || voteState === "before")
                  ? `Pick your favourite week ${round.weekNo} creator: one vote per email address, confirmed by a six digit code.`
                  : "One vote per email address, confirmed by a six digit code, and the creator with the most valid votes wins."
              }
            />
          {shortlist.length === 0 ? (
            <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-3">
              No vote is open right now. Each week&apos;s shortlist appears
              here on Sunday, and voting stays open until the time shown with
              it, Lagos time. Follow{" "}
              <a
                href="https://x.com/blockfestafrica"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                Blockfest on X
              </a>{" "}
              for the moment it opens.
            </p>
          ) : (
            <Ballot entries={shortlist} state={voteState} />
          )}
          {/* The count, under the ballot rather than on its rows: the
              rows stay in ballot order so a half-typed vote never moves,
              and nobody is nudged by a number sitting on the button. It
              loads in the browser, so this page stays static and cached. */}
          <LiveVoteCount />
          </section>

          <p className="mt-14 max-w-prose text-sm leading-relaxed text-ink-3">
            Creator of the Week is selected by Blockfest Africa; Community
            Favourite is decided by public vote. How points are earned is in the{" "}
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
