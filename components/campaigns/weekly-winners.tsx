import type { ReactNode } from "react";
import { ArrowDown, ChevronDown } from "lucide-react";
import { WINNER_CATEGORY_LABEL } from "@/lib/winner-categories";
import type { PublishedWinner, VoteWindowState } from "@/lib/winners";
import { buttonClass, SectionHeading } from "@/components/shared/panel";
import {
  byPlatform,
  MARK_SLOT,
  MarkLink,
  platformLabel,
} from "@/components/shared/platform-marks";
import { NoteLine } from "@/components/campaigns/note-line";
import { CountRows } from "@/components/campaigns/count-rows";
import { count } from "@/lib/format";
import { rankBoard, type VoteBoardRow } from "@/lib/vote-board";
import { MONICA_FIRST_LEADERBOARD, MONICA_FIRST_LEADERBOARD_ENDS } from "@/lib/campaigns";

const CATEGORY_LABEL: Record<string, string> = WINNER_CATEGORY_LABEL;

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

/** The round the page's ballot is showing, as the page worked it out. */
export interface VoteRound {
  weekNo: number;
  state: VoteWindowState;
}

/** An award that is not in yet, said as a row in the same list. */
function Placeholder({
  title,
  line,
  edge = "border-l-transparent",
  action,
}: {
  title: string;
  line: string;
  edge?: string;
  action?: ReactNode;
}) {
  return (
    <li className={`border-l-2 px-4 py-4 sm:px-5 ${edge}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-ink-2">{title}</p>
          <p className="mt-0.5 text-sm text-ink-3">{line}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </li>
  );
}

/**
 * The winners page's "Weekly winners" section, in the ballot's anatomy: one
 * hairline card per week, newest first, its header naming the week once, and
 * one row per award. The name leads at the ballot's size, the category and
 * prize are one quiet line under it (gold is left to the ballot's clock),
 * the winning entry is platform marks in the ballot's X / Instagram / TikTok
 * cells, and the note is clamped to two lines. A column the width of the
 * ballot's Vote button is held open from sm up, so the marks of both cards
 * line up.
 *
 * The week whose Community Favourite is still being voted on shows that
 * award as a pending row, gold-edged while the vote is open, with Vote
 * pointing down to the ballot, rather than leaving the reader to connect
 * "Week 1" here with "week 1" in the vote's hint. The row says only where
 * the vote stands; who decides the award is said once, in the hint.
 *
 * A pure view of what the page already fetched, so it renders the same from
 * fixture props as from the database. The page owns the fetch and the
 * revalidate window; this owns nothing but the markup.
 */
/**
 * A published week's final Community Favourite count, closed until asked for.
 *
 * The live count under the ballot moves on to the next week's vote, and the
 * owner wanted each week's numbers to stay public after it does. Closed by
 * default, so the winners stay the first thing read, and the browser's own
 * disclosure, so it works without script and says what it does.
 */
function FinalCount({ week, nominees }: { week: number; nominees: VoteBoardRow[] }) {
  const { rows, total, levelAtTop } = rankBoard(nominees);
  return (
    <details className="group/final border-t border-line">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors duration-150 hover:bg-card-2 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 font-semibold text-ink-2">
          <ChevronDown
            className="h-4 w-4 shrink-0 -rotate-90 text-ink-3 transition-transform duration-150 group-open/final:rotate-0"
            aria-hidden="true"
          />
          See the week {week} final count
        </span>
        {/* Under the label when it wraps on a phone, in line with its words. */}
        <span className="tabular-nums text-ink-3 max-sm:pl-6">
          {count(total)} verified {total === 1 ? "vote" : "votes"}
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-5">
        <CountRows rows={rows} className="pt-1" />
        <p className="mt-4 text-sm text-ink-4">
          {levelAtTop
            ? "Verified votes, after review. Level at the top: ties are settled by that week's recorded standings."
            : "Verified votes, after review."}
        </p>
      </div>
    </details>
  );
}

export function WeeklyWinners({
  winners,
  vote,
  finals = {},
}: {
  winners: PublishedWinner[];
  /** The shortlist's round, or null when no vote is on the page. */
  vote: VoteRound | null;
  /** Each published week's final count, by week. */
  finals?: Record<number, VoteBoardRow[]>;
}) {
  const cfPending =
    vote !== null &&
    vote.state !== "none" &&
    !winners.some(
      (w) => w.weekNo === vote.weekNo && w.category === "community_favourite",
    );
  const weeks = [
    ...new Set([
      ...winners.map((w) => w.weekNo),
      ...(cfPending && vote ? [vote.weekNo] : []),
    ]),
  ].sort((a, b) => b - a);
  /* Named only while it is still ahead or today: from the Monday after,
     "the first winners appear here on Sunday 27 September" is a promise
     about a day that has gone. */
  const firstStillAhead = new Date() < new Date(MONICA_FIRST_LEADERBOARD_ENDS);

  return (
    <section id="weekly" className="mt-12 scroll-mt-24">
      <SectionHeading
        title="Weekly winners"
        hint="Creator of the Week, Blockfest Africa's pick, is announced each Sunday; the public vote below decides Community Favourite."
      />

      {weeks.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line-2 bg-card px-4 py-4 sm:px-5">
          <p className="text-sm leading-relaxed text-ink-2">
            {firstStillAhead
              ? `Nothing announced yet; the first winners appear here on ${MONICA_FIRST_LEADERBOARD}.`
              : "Nothing announced yet; winners appear here once they are announced."}
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {weeks.map((week) => {
            const awards = winners.filter((w) => w.weekNo === week);
            const onScreen = vote?.weekNo === week;
            /* Only for the week the ballot below is about: an older week
               without one would say "not announced yet" forever. */
            const cotwPending =
              onScreen && !awards.some((w) => w.category === "creator_of_week");
            const cfPendingHere = cfPending && onScreen;
            return (
              <section
                key={week}
                aria-labelledby={`winners-week-${week}`}
                className="overflow-hidden rounded-xl border border-line-2 bg-card"
              >
                <div className="border-b border-line px-4 py-3 sm:px-5">
                  <h3 id={`winners-week-${week}`} className="text-sm font-semibold text-white">
                    Week {week}
                  </h3>
                </div>
                <ul className="divide-y divide-line">
                  {cotwPending && (
                    <Placeholder title="Creator of the Week" line="Not announced yet" />
                  )}
                  {awards.map((w) => {
                    const key = `${w.weekNo}-${w.category}`;
                    return (
                      <li key={key} className="border-l-2 border-l-transparent px-4 py-4 sm:px-5">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                            <div className="min-w-0 sm:flex-1">
                              <p className="break-words text-lg font-semibold leading-snug text-pretty text-white">
                                {w.name}
                              </p>
                              <p className="mt-0.5 text-sm text-ink-3">
                                {CATEGORY_LABEL[w.category] ?? w.category} ·{" "}
                                <span className="font-semibold tabular-nums text-ink-2">
                                  {naira(w.prizeNaira)}
                                </span>
                              </p>
                            </div>
                            {w.links.length > 0 && (
                              <ul
                                aria-label={`${w.name}'s winning entry`}
                                className="-mb-1 -ml-1 mt-2 flex sm:m-0 sm:grid sm:grid-cols-[repeat(3,2.75rem)]"
                              >
                                {byPlatform(w.links, (link) => link.platform).map((link) => (
                                  <li key={link.url} className={MARK_SLOT[link.platform] ?? ""}>
                                    <MarkLink
                                      platform={link.platform}
                                      url={link.url}
                                      label={`${w.name}'s winning post on ${platformLabel(link.platform)}`}
                                    />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {/* The ballot's Vote column, held open from sm up. */}
                          <div aria-hidden="true" className="hidden w-24 shrink-0 sm:block" />
                        </div>
                        {w.note && <NoteLine id={`note-${key}`} text={w.note} name={w.name} />}
                      </li>
                    );
                  })}
                  {cfPendingHere && (
                    <Placeholder
                      title="Community Favourite"
                      line={
                        vote?.state === "open"
                          ? "Voting now"
                          : vote?.state === "before"
                            ? "Voting opens soon"
                            : "Voting has closed"
                      }
                      edge={vote?.state === "open" ? "border-l-brand-gold" : "border-l-transparent"}
                      action={
                        vote?.state === "open" ? (
                          <a
                            href="#shortlist"
                            aria-label={`Vote for the week ${week} Community Favourite`}
                            className={buttonClass("secondary", "min-w-24")}
                          >
                            Vote
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : undefined
                      }
                    />
                  )}
                </ul>
                {(finals[week]?.length ?? 0) > 0 && (
                  <FinalCount week={week} nominees={finals[week]} />
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
