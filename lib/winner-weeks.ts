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
  now,
}: {
  stages: CampaignStage[];
  winners: PublishedWinner[];
  rounds: PublicRound[];
  finals: Record<number, VoteBoardRow[]>;
  now: number;
}): { live: WinnersWeek[]; record: WinnersWeek[] } {
  const started = stages.filter((s) => new Date(s.startsAt).getTime() <= now);
  const currentWeek = started.length ? started[started.length - 1].number : 1;

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

  const live = weeks
    .filter(isLive)
    .sort(
      (a, b) =>
        Number(voting(b)) - Number(voting(a)) ||
        Number(a.current) - Number(b.current) ||
        b.weekNo - a.weekNo,
    );
  const record = weeks
    .filter((w) => !isLive(w) && (w.cotw || w.cf))
    .sort((a, b) => b.weekNo - a.weekNo);

  return { live, record };
}
