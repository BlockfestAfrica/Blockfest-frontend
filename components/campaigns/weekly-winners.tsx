import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock,
  Lock,
  PenLine,
} from "lucide-react";
import { WINNER_CATEGORY_LABEL } from "@/lib/winner-categories";
import type { PublishedWinner, ShortlistEntry, VoteWindowState } from "@/lib/winners";
import type { NowAction, TimelineWeek, WeekStatus } from "@/lib/winner-weeks";
import {
  byPlatform,
  MARK_SLOT,
  MarkLink,
  platformLabel,
} from "@/components/shared/platform-marks";
import { buttonClass } from "@/components/shared/panel";
import { NoteLine } from "@/components/campaigns/note-line";
import { CountRows } from "@/components/campaigns/count-rows";
import { Ballot } from "@/components/campaigns/ballot";
import { LocalTime } from "@/components/campaigns/local-time";
import { LiveVoteCount } from "@/components/campaigns/live-vote-count";
import { TimeLeftLabel } from "@/components/campaigns/time-left-label";
import { monicaRoutes } from "@/lib/campaigns";
import { formatTimeLeft } from "@/lib/countdown";
import { closingAt, count, dayDate } from "@/lib/format";
import { rankBoard, type VoteBoardRow } from "@/lib/vote-board";

/*
 * The winners page as the owner picked it on 5 October, from three
 * previews: "Do this now" first, then an index of every week, then every
 * week as its own card in calendar order. He asked that anyone landing on
 * the page can see what has happened, what is happening, and what to do
 * now, with a breadcrumb of every week, done and to come.
 *
 * The ballot's anatomy throughout: hairline cards, a header row that names
 * the week once and says where it stands at the right, one row per award on
 * hairlines, state on the 2px edge, gold only on what is live and on money.
 *
 * lib/winner-weeks.ts decides where each week stands and what can be done;
 * this draws it. A pure view of what the page fetched, so it renders the
 * same from fixture props as from the database.
 */

const CATEGORY_LABEL: Record<string, string> = WINNER_CATEGORY_LABEL;

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

/** "Tuesday 6 October at 14:00", "Saturday 10 October at 12:00 noon". */
const deadline = (iso: string) => closingAt(iso).replace(",", "");

/* ------------------------------------------------------------ the state */

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});
const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "Africa/Lagos",
});

/** A state in words: the card header's, and the index's shorter one. */
function statusWords(status: WeekStatus): { long: string; short: string } {
  switch (status.kind) {
    case "announced": {
      const words = status.full ? "Winners announced" : "Announced";
      return { long: words, short: words };
    }
    case "voting":
      return { long: "Voting now", short: "Voting now" };
    case "review":
      return { long: "Votes in review", short: "Votes in review" };
    case "vote-before":
      return {
        long: `Vote opens ${LONG_DATE.format(new Date(status.opensAt))}`,
        short: `Vote opens ${SHORT_DATE.format(new Date(status.opensAt))}`,
      };
    case "entries":
      return { long: "Entries open", short: "Entries open" };
    case "awaiting":
      return { long: "Awaiting results", short: "Awaiting results" };
    case "upcoming":
      return {
        long: `Starts ${LONG_DATE.format(new Date(status.startsAt))}`,
        short: `Starts ${SHORT_DATE.format(new Date(status.startsAt))}`,
      };
  }
}

/** The state's mark: a shape as well as a colour, never colour alone. */
function StatusIcon({ status }: { status: WeekStatus }) {
  switch (status.kind) {
    case "announced":
      return <CircleCheck className="h-4 w-4 shrink-0 text-green-300" aria-hidden="true" />;
    case "voting":
      return (
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-brand-gold" />
        </span>
      );
    case "review":
      return <Lock className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />;
    case "entries":
      return <PenLine className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />;
    case "upcoming":
      return <CalendarDays className="h-4 w-4 shrink-0 text-ink-4" aria-hidden="true" />;
    default:
      return <Clock className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />;
  }
}

/** The ink a state is said in, shared by the index and the card headers. */
function statusInk(status: WeekStatus): string {
  if (status.kind === "voting") return "text-brand-gold";
  if (status.kind === "upcoming") return "text-ink-3";
  if (status.kind === "announced") return "text-ink-2";
  return "text-white";
}

/** A week card's state, said once, at the right of its header. */
function StatusLabel({ status }: { status: WeekStatus }) {
  return (
    <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${statusInk(status)}`}>
      <StatusIcon status={status} />
      {statusWords(status).long}
    </p>
  );
}

/* ---------------------------------------------------------- do this now */

/**
 * What a visitor can do right now, one row each: what, by when, the time
 * left, and one button. Hidden when there is nothing to do.
 *
 * The vote's button lands on the ballot itself (#shortlist), not the week's
 * header, so a phone does not open on last week's notes. The entry's goes to
 * the creator page, where entries are submitted.
 */
export function DoThisNow({
  actions,
  ballotWeek,
}: {
  actions: NowAction[];
  /** The week whose ballot is on the page, if any. */
  ballotWeek: number | null;
}) {
  if (actions.length === 0) return null;
  return (
    <section
      aria-labelledby="do-now"
      className="mt-8 overflow-hidden rounded-xl border border-line-2 bg-card"
    >
      <h2
        id="do-now"
        className="border-b border-line px-4 py-3 text-lg font-bold text-white sm:px-5"
      >
        Do this now
      </h2>
      <ul className="divide-y divide-line">
        {actions.map((action) => {
          const vote = action.kind === "vote";
          const Arrow = vote ? ArrowDown : ArrowRight;
          return (
            <li
              key={`${action.kind}-${action.weekNo}`}
              className="border-l-2 border-l-brand-gold px-4 py-4 sm:px-5"
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 sm:flex-1">
                  <p className="text-lg font-semibold leading-snug text-pretty text-white">
                    {vote
                      ? `Vote for week ${action.weekNo}'s Community Favourite`
                      : `Enter week ${action.weekNo}'s challenge`}
                  </p>
                  {/* The deadline, then the clock: one line from sm up, two
                      on a phone, so the dot never dangles. */}
                  <p className="mt-1 flex flex-col items-start gap-y-0.5 text-sm text-ink-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                    <span>
                      {vote ? "Closes " : "Entries close "}
                      <time dateTime={action.closesAt}>{deadline(action.closesAt)}</time>
                      <LocalTime at={action.closesAt} />
                    </span>
                    <span aria-hidden="true" className="hidden text-ink-4 sm:inline">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-brand-gold">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      <TimeLeftLabel
                        endsAt={action.closesAt}
                        initial={formatTimeLeft(action.closesAt)}
                      />
                    </span>
                  </p>
                </div>
                <Link
                  href={
                    vote
                      ? ballotWeek === action.weekNo
                        ? "#shortlist"
                        : `#week-${action.weekNo}`
                      : monicaRoutes.me
                  }
                  aria-label={
                    vote
                      ? `Vote now on week ${action.weekNo}'s shortlist`
                      : `Enter week ${action.weekNo} on your creator page`
                  }
                  className={buttonClass("secondary", "min-w-32")}
                >
                  {vote ? "Vote now" : "Enter"}
                  <Arrow className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------- the index */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LAGOS_MS = 60 * 60 * 1000;

/** "16–24 Sep", or "28 Sep – 3 Oct" across a month, on Lagos days. */
function shortRange(startsAt: string, endsAt: string): string {
  const a = new Date(Date.parse(startsAt) + LAGOS_MS);
  const b = new Date(Date.parse(endsAt) + LAGOS_MS);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

/** The state's 2px edge: green done, gold under way, a line still to come. */
function edgeOf(status: WeekStatus): string {
  if (status.kind === "announced") return "bg-green-400/70";
  if (status.kind === "upcoming") return "bg-line-2";
  return "bg-brand-gold";
}

/* Hairlines between cells, by position. Below sm the cells are 2x2 and each
   carries its state on its left edge, so the second column's edge is the
   divider and only the second row needs a hairline over it. From sm up they
   are one row of four with the edge on top, divided by hairlines. */
const CELL_LINES = [
  "sm:border-r",
  "sm:border-r",
  "border-t sm:border-r sm:border-t-0",
  "border-t sm:border-t-0",
];

/**
 * The page's index of every week: one hairline card, a cell per week, each
 * saying where that week stands in a word and a mark, and linking to its
 * card. No clock here: Do this now carries the time left.
 */
export function WeekStrip({ timeline }: { timeline: TimelineWeek[] }) {
  return (
    <nav aria-label="Jump to a week" className="mt-3">
      {/* mobile-grid-ok: four short cells, two per row below sm */}
      <ol className="grid grid-cols-2 overflow-hidden rounded-xl border border-line-2 bg-card sm:grid-cols-4">
        {timeline.map(({ week, startsAt, status }, index) => (
          <li key={week.weekNo} className={`relative border-line ${CELL_LINES[index] ?? ""}`}>
            <span
              aria-hidden="true"
              className={`absolute left-0 top-0 h-full w-0.5 sm:right-0 sm:h-0.5 sm:w-auto ${edgeOf(status)}`}
            />
            <a
              href={`#week-${week.weekNo}`}
              className="flex h-full min-h-11 flex-col py-4 pl-4 pr-3 transition-colors duration-150 hover:bg-card-2 focus-visible:outline-offset-[-3px] sm:px-4"
            >
              <span className="text-base font-semibold leading-snug text-white">
                Week {week.weekNo}
              </span>
              <span className="sr-only">, </span>
              <span className="text-sm tabular-nums text-ink-3">
                {shortRange(startsAt, week.entriesCloseAt)}
              </span>
              <span className="sr-only">: </span>
              <span
                className={`mt-3 inline-flex items-start gap-1.5 text-sm font-semibold leading-snug ${statusInk(status)}`}
              >
                <span className="flex h-5 items-center">
                  <StatusIcon status={status} />
                </span>
                {statusWords(status).short}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------ the rows */

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
 * A finished week's final count, closed until asked for, at the foot of
 * its card. Fraud removed from that round is said here, once, as a plain
 * sentence: it is history, not news, so it neither moves nor sits outside
 * the count (the owner, 5 October: the moving notice is for the live vote).
 */
function FinalCount({
  week,
  nominees,
  flagged,
}: {
  week: number;
  nominees: VoteBoardRow[];
  flagged: boolean;
}) {
  const { rows, total, levelAtTop } = rankBoard(nominees);
  return (
    <details className="group/final border-t border-line">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors duration-150 hover:bg-card-2 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 font-semibold text-ink-2">
          <ChevronDown
            className="h-4 w-4 shrink-0 -rotate-90 text-ink-3 transition-transform duration-150 group-open/final:rotate-0"
            aria-hidden="true"
          />
          Final vote count<span className="sr-only">, week {week}</span>
        </span>
        {/* Under the label when it wraps on a phone, in line with its words. */}
        <span className="tabular-nums text-ink-3 max-sm:pl-6">
          {count(total)} verified {total === 1 ? "vote" : "votes"}
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-5">
        <CountRows rows={rows} className="pt-1" />
        <div className="mt-4 flex flex-col gap-1 text-sm leading-relaxed">
          {flagged && (
            <p className="text-ink-3">
              Suspicious votes were found in this round and removed before the
              winner was confirmed.
            </p>
          )}
          <p className="text-ink-4">
            {levelAtTop
              ? "Verified votes, after review. Level at the top: ties are settled by that week's recorded standings."
              : "Verified votes, after review."}
          </p>
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------ the week */

/**
 * One week, wherever it stands: a quiet dashed card for a week still to
 * come, otherwise its awards as they stand, the ballot as its Community
 * Favourite row while the vote is on, its live count at its foot while
 * that is the round being counted, and its final count once announced.
 */
export function WeekCard({
  entry,
  last,
  shortlist,
  ballotState,
  countHere,
  shortlistHere,
}: {
  entry: TimelineWeek;
  /** The campaign's last week. */
  last: boolean;
  /** The open round's nominees, when that round is this week's. */
  shortlist: ShortlistEntry[];
  ballotState: VoteWindowState;
  /** This week's round is the one the live count follows. */
  countHere: boolean;
  /** #shortlist lands on this week when it has no ballot on the page. */
  shortlistHere: boolean;
}) {
  const { week, status } = entry;
  const n = week.weekNo;
  const title = (
    <h3 id={`week-${n}-title`} className={`text-lg font-bold ${status.kind === "upcoming" ? "text-ink-2" : "text-white"}`}>
      Week {n}
      {/* A real separator, so the name is "Week 2, 28 September", not the
          number run into the date. */}
      <span className="sr-only">,</span>{" "}
      <span className="ml-1 text-sm font-normal text-ink-3">{week.dates}</span>
    </h3>
  );

  if (status.kind === "upcoming") {
    return (
      <section
        id={`week-${n}`}
        aria-labelledby={`week-${n}-title`}
        className="scroll-mt-24 rounded-xl border border-dashed border-line-2 px-4 py-4 sm:px-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {title}
          <StatusLabel status={status} />
        </div>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-3">
          {last ? "The last week. " : ""}Entries close{" "}
          <time dateTime={week.entriesCloseAt}>{deadline(week.entriesCloseAt)}</time>.
        </p>
      </section>
    );
  }

  const ballot =
    !week.cf &&
    shortlist.length > 0 &&
    shortlist[0].weekNo === n &&
    (ballotState === "open" || ballotState === "before");
  /* The entries line only while entries are the news: once a vote is on,
     "entries closed on Saturday" is yesterday's. */
  const entries = week.current && week.vote === "none";

  return (
    <section
      id={`week-${n}`}
      aria-labelledby={`week-${n}-title`}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-line-2 bg-card"
    >
      {/* Where the nominee emails and the stage cards send voters, when
          this week is the vote but its ballot is not on the page. */}
      {shortlistHere && !ballot && <span id="shortlist" className="block scroll-mt-24" />}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        {title}
        <StatusLabel status={status} />
      </div>
      {entries && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-line px-4 py-2 sm:px-5">
          <p className="py-2 text-sm text-ink-2">
            {week.entriesOpen ? (
              <>
                Entries close{" "}
                <time dateTime={week.entriesCloseAt}>{deadline(week.entriesCloseAt)}</time>
                <LocalTime at={week.entriesCloseAt} />
              </>
            ) : (
              <>
                Entries closed{" "}
                <time dateTime={week.entriesCloseAt}>{dayDate(week.entriesCloseAt)}</time>
              </>
            )}
          </p>
          {week.entriesOpen && (
            <Link
              href={`${monicaRoutes.landing}#stages`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
            >
              Read the week {n} challenge
            </Link>
          )}
        </div>
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
          /* #shortlist: where the nominee emails, the stage cards and Do
             this now send voters, so it lands on the Vote buttons. */
          <li id="shortlist" className="scroll-mt-24">
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
                    : week.entriesOpen
                      ? "A public vote on the shortlist, once entries close"
                      : week.announceAhead
                        ? `Vote opens ${dayDate(week.announceOn)}`
                        : week.current
                          ? "Vote opens soon"
                          : "Not announced yet"
            }
          />
        )}
      </ul>
      {/* The count, under the week it counts rather than on the ballot's
          rows: the rows stay in ballot order so a half-typed vote never
          moves, and nobody is nudged by a number beside the button. It
          loads in the browser, so the page stays static and cached. */}
      {countHere && <LiveVoteCount />}
      {week.finalCount && (
        <FinalCount week={n} nominees={week.finalCount} flagged={week.finalFlagged} />
      )}
    </section>
  );
}
