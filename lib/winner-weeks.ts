import type { CampaignStage } from "@/lib/campaigns";
import type { VoteBoardRow } from "@/lib/vote-board";
import {
  voteWindowState,
  type PublicRound,
  type PublishedWinner,
} from "@/lib/winners";

/**
 * The winners page, week by week.
 *
 * The page used to be two sections that did not know about each other:
 * "Weekly winners", a card per announced week, and "Community Favourite
 * vote", the ballot and its count. Once a week's Community Favourite was
 * announced, its final count sat under that week's winners and again in the
 * vote section, which fell back to the last round when no vote was open, and
 * nothing on the page said which week was running now. The owner asked for
 * the current details to always be there and the past kept as a record
 * without the two being confused.
 *
 * So every week is placed once, in one of two groups:
 *
 *   live    what is happening now: the stage that is running (or just ended
 *           and waiting on its Sunday), the week before it until both its
 *           awards are in, and any week whose vote is staged, open, or
 *           closed and being reviewed. A vote runs past the start of the
 *           next stage, and an announcement can run late, so two weeks can
 *           be live at once. A week with a vote comes first, because it is
 *           the one a visitor can act on and it closes soonest; then a
 *           finished week waiting on its results; then the running stage.
 *   record  every week with an announced winner that is no longer live,
 *           newest first. A week leaves live for the record once both of its
 *           awards are announced.
 *
 * Pure: the page fetches, this decides, the component draws. `now` is
 * passed in so the decision can be tested at any moment of the campaign.
 */

export type WeekVote = "none" | "before" | "open" | "closed";

export interface WinnersWeek {
  weekNo: number;
  /** The stage's dates as the registry prints them. */
  dates: string;
  /** The create-and-submit window's close, a Lagos instant. */
  entriesCloseAt: string;
  entriesOpen: boolean;
  /** Midnight starting the Sunday its winners are announced, Lagos. */
  announceOn: string;
  /** That Sunday has not finished yet, so it can still be promised. */
  announceAhead: boolean;
  /** The stage that is running, or the latest one to have run. */
  current: boolean;
  cotw: PublishedWinner | null;
  cf: PublishedWinner | null;
  /** Where the Community Favourite vote stands, until it is announced. */
  vote: WeekVote;
  voteOpensAt: string;
  voteClosesAt: string;
  /** The published count, once the Community Favourite is announced. */
  finalCount: VoteBoardRow[] | null;
  /** Votes in that published round were removed as fraud. */
  finalFlagged: boolean;
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The Sunday after a stage closes, as the instant it starts in Lagos.
 *
 * Stage 1 closed on a Thursday night and its winners came on Sunday
 * 27 September; the later stages close on Saturday at noon and theirs come
 * the next day. "The next Sunday" covers both.
 */
export function announcementSunday(entriesCloseAt: string): string {
  const lagos = new Date(new Date(entriesCloseAt).getTime() + LAGOS_OFFSET_MS);
  const ahead = (7 - lagos.getUTCDay()) % 7 || 7;
  const midnight = Date.UTC(
    lagos.getUTCFullYear(),
    lagos.getUTCMonth(),
    lagos.getUTCDate() + ahead,
  );
  return new Date(midnight - LAGOS_OFFSET_MS).toISOString();
}

export function winnersByWeek({
  stages,
  winners,
  rounds,
  finals,
  flagged = [],
  now,
}: {
  stages: CampaignStage[];
  winners: PublishedWinner[];
  rounds: PublicRound[];
  finals: Record<number, VoteBoardRow[]>;
  /** Published weeks whose rounds had votes removed as fraud. */
  flagged?: number[];
  now: number;
}): { live: WinnersWeek[]; record: WinnersWeek[]; all: WinnersWeek[] } {
  const started = stages.filter((s) => new Date(s.startsAt).getTime() <= now);
  /* After the last stage's announcement Sunday no stage follows, so nothing
     would ever make the last week "last week" or release the one before it:
     a late final result would say "This week" for good. The week after the
     last is treated as running then, so the last week reads "Awaiting
     results" like any late week, and the one before goes to the record. */
  const last = stages[stages.length - 1];
  const over =
    !!last && now >= new Date(announcementSunday(last.endsAt)).getTime() + DAY_MS;
  const currentWeek = over
    ? last.number + 1
    : started.length
      ? started[started.length - 1].number
      : 1;

  const weeks: WinnersWeek[] = stages.map((stage) => {
    const weekNo = stage.number;
    const cotw =
      winners.find((w) => w.weekNo === weekNo && w.category === "creator_of_week") ?? null;
    const cf =
      winners.find((w) => w.weekNo === weekNo && w.category === "community_favourite") ??
      null;
    const round =
      rounds
        .filter((r) => r.weekNo === weekNo)
        .sort((a, b) => Date.parse(b.opensAt) - Date.parse(a.opensAt))[0] ?? null;
    const vote: WeekVote =
      cf || !round || round.status === "published"
        ? "none"
        : round.status === "closed"
          ? "closed"
          : voteWindowState(round, now);
    const announceOn = announcementSunday(stage.endsAt);
    const closes = new Date(stage.endsAt).getTime();

    return {
      weekNo,
      dates: stage.dates,
      entriesCloseAt: stage.endsAt,
      entriesOpen: new Date(stage.startsAt).getTime() <= now && now < closes,
      announceOn,
      announceAhead: now < new Date(announceOn).getTime() + DAY_MS,
      current: weekNo === currentWeek,
      cotw,
      cf,
      vote,
      voteOpensAt: round?.opensAt ?? "",
      voteClosesAt: round?.closesAt ?? "",
      finalCount: cf && (finals[weekNo]?.length ?? 0) > 0 ? finals[weekNo] : null,
      finalFlagged: Boolean(cf) && flagged.includes(weekNo),
    };
  });

  const voting = (w: WinnersWeek) => w.vote !== "none";
  /* The week before the running one stays live until both its awards are
     in: an announcement a day late must not make that week vanish, which
     it did when only the current week and voting weeks were live. Bounded
     to that one week, so a week whose vote never ran is not pending
     forever; it goes to the record with what was announced. */
  const isLive = (w: WinnersWeek) =>
    !(w.cotw && w.cf) &&
    (w.current || voting(w) || w.weekNo === currentWeek - 1);

  /* What a visitor can act on first: an open vote, then one about to open,
     then one in review, then a week waiting on results, then the running
     stage. #shortlist lands on the top of this list. */
  const rank = (w: WinnersWeek) =>
    w.vote === "open" ? 0 : w.vote === "before" ? 1 : w.vote === "closed" ? 2 : 3;
  const live = weeks
    .filter(isLive)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(a.current) - Number(b.current) ||
        b.weekNo - a.weekNo,
    );
  const record = weeks
    .filter((w) => !isLive(w) && (w.cotw || w.cf))
    .sort((a, b) => b.weekNo - a.weekNo);

  return { live, record, all: weeks };
}

/*
 * The page as the owner picked it on 5 October: "Do this now" first, then
 * every week in calendar order, each saying where it stands. He asked for
 * the page to show at a glance what has happened, what is happening and
 * what to do now, with a breadcrumb of every week, done and to come.
 *
 * One vocabulary for where a week stands, shared by the index at the top
 * and each week's own card, so the two can never say different things.
 */
export type WeekStatus =
  /** Both awards in (`full`), or the one that ever will be. */
  | { kind: "announced"; full: boolean }
  | { kind: "voting" }
  | { kind: "review" }
  | { kind: "vote-before"; opensAt: string }
  | { kind: "entries" }
  | { kind: "awaiting" }
  | { kind: "upcoming"; startsAt: string };

export interface TimelineWeek {
  week: WinnersWeek;
  startsAt: string;
  status: WeekStatus;
}

/**
 * Every stage in calendar order with where it stands at `now`, from the
 * same live and record decision winnersByWeek makes, so a week is never
 * "announced" in one place and "happening now" in another.
 */
export function weekTimeline(
  stages: CampaignStage[],
  placed: { live: WinnersWeek[]; all: WinnersWeek[] },
  now: number,
): TimelineWeek[] {
  const live = new Set(placed.live.map((w) => w.weekNo));
  return stages.map((stage) => {
    const week = placed.all.find((w) => w.weekNo === stage.number)!;
    const status: WeekStatus =
      new Date(stage.startsAt).getTime() > now
        ? { kind: "upcoming", startsAt: stage.startsAt }
        : !live.has(week.weekNo) && (week.cotw || week.cf)
          ? { kind: "announced", full: Boolean(week.cotw && week.cf) }
          : week.vote === "open"
            ? { kind: "voting" }
            : week.vote === "closed"
              ? { kind: "review" }
              : week.vote === "before"
                ? { kind: "vote-before", opensAt: week.voteOpensAt }
                : week.current && week.entriesOpen
                  ? { kind: "entries" }
                  : { kind: "awaiting" };
    return { week, startsAt: stage.startsAt, status };
  });
}

/** Something a visitor can do right now, with the moment it stops. */
export interface NowAction {
  kind: "vote" | "enter";
  weekNo: number;
  closesAt: string;
}

/**
 * What a visitor can do now: vote in an open round, or enter the stage
 * taking entries. Soonest deadline first, because that is the one to act
 * on first. Empty between the two, when there is nothing to do.
 */
export function actionsNow(timeline: TimelineWeek[]): NowAction[] {
  const actions: NowAction[] = [];
  for (const { week, status } of timeline) {
    if (status.kind === "voting") {
      actions.push({ kind: "vote", weekNo: week.weekNo, closesAt: week.voteClosesAt });
    }
    if (status.kind === "entries") {
      actions.push({ kind: "enter", weekNo: week.weekNo, closesAt: week.entriesCloseAt });
    }
  }
  return actions.sort((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt));
}
