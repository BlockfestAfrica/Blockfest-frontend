import { ChevronDown, CircleCheck, Clock, Lock } from "lucide-react";
import { WINNER_CATEGORY_LABEL } from "@/lib/winner-categories";
import type { PublishedWinner, ShortlistEntry, VoteWindowState } from "@/lib/winners";
import type { WinnersWeek } from "@/lib/winner-weeks";
import {
  byPlatform,
  MARK_SLOT,
  MarkLink,
  platformLabel,
} from "@/components/shared/platform-marks";
import { NoteLine } from "@/components/campaigns/note-line";
import { CountRows } from "@/components/campaigns/count-rows";
import { Ballot } from "@/components/campaigns/ballot";
import { closingAt, count, dayDate } from "@/lib/format";
import { rankBoard, type VoteBoardRow } from "@/lib/vote-board";

/*
 * The winners page, week by week, in the ballot's anatomy: hairline cards,
 * a header row that names the week once, one row per award, rows on
 * hairlines, state on the row's 2px edge, gold only while a vote is live.
 *
 * lib/winner-weeks.ts decides which weeks are happening now and which are on
 * record; this draws them. A pure view of what the page fetched, so it
 * renders the same from fixture props as from the database.
 */

const CATEGORY_LABEL: Record<string, string> = WINNER_CATEGORY_LABEL;

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

/** An award that is not in yet, said as a row in the same list. */
function Pending({ title, line }: { title: string; line: string }) {
  return (
    <li className="border-l-2 border-l-transparent px-4 py-4 sm:px-5">
      <p className="text-base font-semibold leading-snug text-ink-2">{title}</p>
      <p className="mt-0.5 text-sm text-ink-3">{line}</p>
    </li>
  );
}

/**
 * An announced award: the name at the ballot's size, the category and prize
 * as one quiet line under it, the winning entry as platform marks in the
 * ballot's X / Instagram / TikTok cells, and the note clamped to two lines.
 * A column the width of the ballot's Vote button is held open from sm up, so
 * the marks of every card line up.
 */
function Winner({ w }: { w: PublishedWinner }) {
  const key = `${w.weekNo}-${w.category}`;
  return (
    <li className="border-l-2 border-l-transparent px-4 py-4 sm:px-5">
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
}

/**
 * A week's final Community Favourite count, closed until asked for.
 *
 * Said once, here, with the week it decided. It used to be said again under
 * the ballot, whose count fell back to the last round when no vote was open.
 * Closed by default so the winners stay the first thing read, and the
 * browser's own disclosure, so it works without script and says what it does.
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
          Week {week} vote count
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

/** Where a live week stands, said once, at the right of its header. */
function WeekState({ week }: { week: WinnersWeek }) {
  if (week.vote === "open") {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold">
        <span className="h-2 w-2 rounded-full bg-brand-gold" aria-hidden="true" />
        Voting now
      </p>
    );
  }
  if (week.vote === "closed") {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2">
        <Lock className="h-4 w-4" aria-hidden="true" />
        Votes in review
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
      <Clock className="h-4 w-4" aria-hidden="true" />
      {week.current ? "This week" : "Awaiting results"}
    </p>
  );
}

/**
 * A week that is happening now: its awards as they stand, with the vote
 * inside it as its Community Favourite row while that is running.
 */
export function LiveWeek({
  week,
  shortlist,
  ballotState,
}: {
  week: WinnersWeek;
  /** The open round's nominees, when that round is this week's. */
  shortlist: ShortlistEntry[];
  ballotState: VoteWindowState;
}) {
  const ballot =
    !week.cf &&
    shortlist.length > 0 &&
    shortlist[0].weekNo === week.weekNo &&
    (ballotState === "open" || ballotState === "before");
  /* The entries line only while entries are the news: once a vote is on,
     "entries closed on Saturday" is yesterday's. */
  const entries = week.current && week.vote === "none";

  return (
    <section
      aria-labelledby={`week-${week.weekNo}`}
      className="overflow-hidden rounded-xl border border-line-2 bg-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        <h3 id={`week-${week.weekNo}`} className="text-lg font-bold text-white">
          Week {week.weekNo}
          {/* A real separator, so the name is "Week 2, 28 September", not
              the number run into the date. */}
          <span className="sr-only">,</span>{" "}
          <span className="ml-1 text-sm font-normal text-ink-3">{week.dates}</span>
        </h3>
        <WeekState week={week} />
      </div>
      {entries && (
        <p className="border-b border-line px-4 py-3 text-sm text-ink-2 sm:px-5">
          {week.entriesOpen ? (
            <>
              Entries close{" "}
              <time dateTime={week.entriesCloseAt}>{closingAt(week.entriesCloseAt)}</time>
            </>
          ) : (
            <>
              Entries closed{" "}
              <time dateTime={week.entriesCloseAt}>{dayDate(week.entriesCloseAt)}</time>
            </>
          )}
        </p>
      )}
      <ul className="divide-y divide-line">
        {week.cotw ? (
          <Winner w={week.cotw} />
        ) : (
          <Pending
            title="Creator of the Week"
            line={
              week.announceAhead
                ? `Announced ${dayDate(week.announceOn)}`
                : "Not announced yet"
            }
          />
        )}
        {week.cf ? (
          <Winner w={week.cf} />
        ) : ballot ? (
          <li>
            <Ballot entries={shortlist} state={ballotState} />
          </li>
        ) : (
          <Pending
            title="Community Favourite"
            line={
              week.vote === "closed"
                ? "Voting has closed. The Community Favourite is confirmed after review."
                : week.vote === "before" && week.voteOpensAt
                  ? `Voting opens ${closingAt(week.voteOpensAt)}`
                  : week.vote === "open"
                    ? "Voting now"
                    : week.announceAhead
                      ? `Vote opens ${dayDate(week.announceOn)}`
                      : "Vote opens soon"
            }
          />
        )}
      </ul>
    </section>
  );
}

/**
 * Every week with an announced winner that is no longer happening: one card,
 * newest week first, each week a group of its award rows and its count.
 */
export function WinnersRecord({ weeks, of }: { weeks: WinnersWeek[]; of: number }) {
  const all = weeks.length === of;
  return (
    <section id="weekly" aria-labelledby="winners-record" className="mt-12 scroll-mt-24">
      <h2 id="winners-record" className="text-xl font-bold text-white sm:text-2xl">
        {all ? "The winners" : "Winners so far"}
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-line-2 bg-card">
        <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
            <CircleCheck className="h-4 w-4 text-green-300" aria-hidden="true" />
            {weeks.length} of {of} weeks announced
          </p>
          <p className="text-sm text-ink-3">Newest first</p>
        </div>
        <ul className="divide-y divide-line">
          {weeks.map((week) => (
            <li key={week.weekNo}>
              <h3
                id={`week-${week.weekNo}`}
                className="px-4 pt-4 text-sm font-semibold text-ink-2 sm:px-5"
              >
                Week {week.weekNo}
                <span className="font-normal text-ink-3"> · {week.dates}</span>
              </h3>
              <ul className="divide-y divide-line">
                {week.cotw && <Winner w={week.cotw} />}
                {week.cf && <Winner w={week.cf} />}
              </ul>
              {week.finalCount && (
                <FinalCount week={week.weekNo} nominees={week.finalCount} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
