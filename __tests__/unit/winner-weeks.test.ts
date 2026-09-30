/**
 * Which weeks the winners page shows as happening now, and which as record.
 *
 * The owner saw week 1's final count twice, one under the other, and no
 * sign of which week was running. The page now places every week once:
 * live (the running stage, and any week whose vote is on) or record (a week
 * whose winners are in). These walk the campaign's real calendar, moment by
 * moment, and pin where each week lands.
 */

import { describe, expect, it } from "vitest";
import { monicaStages } from "@/lib/campaigns";
import { announcementSunday, winnersByWeek } from "@/lib/winner-weeks";
import type { PublicRound, PublishedWinner } from "@/lib/winners";

const win = (
  weekNo: number,
  category: PublishedWinner["category"],
  name = `W${weekNo} ${category}`,
): PublishedWinner => ({ weekNo, category, name, prizeNaira: 1, note: null, links: [] });

const W1 = [win(1, "creator_of_week"), win(1, "community_favourite")];
const W2_COTW = win(2, "creator_of_week");
const R1: PublicRound = {
  weekNo: 1,
  status: "published",
  opensAt: "2026-09-27T09:00:00.000Z",
  closesAt: "2026-09-29T20:00:00.000Z",
};
const r2 = (status: PublicRound["status"], over: Partial<PublicRound> = {}): PublicRound => ({
  weekNo: 2,
  status,
  opensAt: "2026-10-04T09:00:00.000Z",
  closesAt: "2026-10-06T20:00:00.000Z",
  ...over,
});
const FINALS = { 1: [{ nomineeId: "a", name: "A", votes: 3 }] };

const at = (iso: string) => new Date(iso).getTime();
const place = (
  winners: PublishedWinner[],
  rounds: PublicRound[],
  when: string,
  flagged: number[] = [],
) => {
  const { live, record } = winnersByWeek({
    stages: monicaStages,
    winners,
    rounds,
    finals: FINALS,
    flagged,
    now: at(when),
  });
  return {
    live: live.map((w) => `${w.weekNo}:${w.vote}${w.current ? ":current" : ""}`),
    record: record.map((w) => w.weekNo),
    weeks: [...live, ...record],
  };
};

describe("the announcement Sunday", () => {
  it("is the Sunday after each stage closes, from Lagos midnight", () => {
    // Stage 1 closed on a Thursday night; its winners came on Sunday 27 September.
    expect(announcementSunday(monicaStages[0].endsAt)).toBe("2026-09-26T23:00:00.000Z");
    // The later stages close on Saturday at noon; theirs come the next day.
    expect(announcementSunday(monicaStages[1].endsAt)).toBe("2026-10-03T23:00:00.000Z");
    expect(announcementSunday(monicaStages[3].endsAt)).toBe("2026-10-17T23:00:00.000Z");
  });
});

describe("the page, through the campaign", () => {
  it("today: week 2 is running, week 1 is on record with its count", () => {
    const p = place(W1, [R1], "2026-09-30T12:00:00+01:00");
    expect(p.live).toEqual(["2:none:current"]);
    expect(p.record).toEqual([1]);
    const w1 = p.weeks.find((w) => w.weekNo === 1)!;
    expect(w1.finalCount).toEqual(FINALS[1]);
    const w2 = p.weeks.find((w) => w.weekNo === 2)!;
    expect(w2.entriesOpen).toBe(true);
    expect(w2.announceAhead).toBe(true);
  });

  it("Saturday afternoon: entries have closed and the Sunday is still ahead", () => {
    const p = place(W1, [R1], "2026-10-03T15:00:00+01:00");
    const w2 = p.weeks.find((w) => w.weekNo === 2)!;
    expect(w2.entriesOpen).toBe(false);
    expect(w2.announceAhead).toBe(true);
  });

  it("the Sunday: Creator of the Week is in and the vote is open, in the same live week", () => {
    const p = place([...W1, W2_COTW], [R1, r2("open")], "2026-10-04T15:00:00+01:00");
    expect(p.live).toEqual(["2:open:current"]);
    expect(p.record).toEqual([1]);
  });

  it("the Monday: week 3 has started, and week 2's vote comes first because it can be acted on", () => {
    const p = place([...W1, W2_COTW], [R1, r2("open")], "2026-10-05T12:00:00+01:00");
    expect(p.live).toEqual(["2:open", "3:none:current"]);
  });

  it("a round staged before it opens says so", () => {
    const p = place([...W1, W2_COTW], [R1, r2("open")], "2026-10-04T08:00:00+01:00");
    expect(p.live[0]).toBe("2:before:current");
  });

  it("past its close, and once an owner closes it, the vote is in review, still live", () => {
    expect(
      place([...W1, W2_COTW], [R1, r2("open")], "2026-10-06T22:00:00+01:00").live[0],
    ).toBe("2:closed");
    expect(
      place([...W1, W2_COTW], [R1, r2("closed")], "2026-10-06T22:00:00+01:00").live[0],
    ).toBe("2:closed");
  });

  it("once both awards are announced the week moves to the record, newest first", () => {
    const p = place(
      [...W1, W2_COTW, win(2, "community_favourite")],
      [R1, r2("published")],
      "2026-10-07T12:00:00+01:00",
    );
    expect(p.live).toEqual(["3:none:current"]);
    expect(p.record).toEqual([2, 1]);
  });

  it("after the last week, everything is record and nothing is live", () => {
    const all = [1, 2, 3, 4].flatMap((n) => [win(n, "creator_of_week"), win(n, "community_favourite")]);
    const p = place(all, [], "2026-10-25T12:00:00+01:00");
    expect(p.live).toEqual([]);
    expect(p.record).toEqual([4, 3, 2, 1]);
  });

  it("never shows a stage that has not started", () => {
    const p = place(W1, [R1], "2026-09-30T12:00:00+01:00");
    expect(p.weeks.map((w) => w.weekNo)).not.toContain(3);
    expect(p.weeks.map((w) => w.weekNo)).not.toContain(4);
  });

  it("keeps a late week on the page, first, and stops promising a Sunday that has gone", () => {
    // Monday of week 3, and nothing for week 2 is announced yet. It used to
    // vanish: not current, no vote, no winner. It stays, ahead of week 3.
    const p = place(W1, [R1], "2026-10-05T09:00:00+01:00");
    expect(p.live).toEqual(["2:none", "3:none:current"]);
    expect(p.weeks.find((w) => w.weekNo === 2)!.announceAhead).toBe(false);
    const lateSunday = place(W1, [R1], "2026-10-04T23:30:00+01:00");
    expect(lateSunday.weeks.find((w) => w.weekNo === 2)!.announceAhead).toBe(true);
  });

  it("keeps last week live until both its awards are in, but not forever", () => {
    const midweek = place([...W1, W2_COTW], [R1], "2026-10-07T12:00:00+01:00");
    expect(midweek.live).toEqual(["2:none", "3:none:current"]);
    expect(midweek.record).toEqual([1]);
    // Once another stage starts, a week whose vote never ran goes to the
    // record with what was announced.
    const later = place([...W1, W2_COTW], [R1], "2026-10-12T12:00:00+01:00");
    expect(later.record).toEqual([2, 1]);
    expect(later.live).toEqual(["3:none", "4:none:current"]);
  });

  it("an announced Community Favourite ends the vote, whatever the round says", () => {
    const p = place(
      [...W1, W2_COTW, win(2, "community_favourite")],
      [R1, r2("open")],
      "2026-10-05T12:00:00+01:00",
    );
    expect(p.record).toEqual([2, 1]);
    expect(p.live).toEqual(["3:none:current"]);
  });

  it("puts an open vote above one in review, so #shortlist lands on the ballot", () => {
    const w3 = win(3, "creator_of_week");
    const r3: PublicRound = { weekNo: 3, status: "open", opensAt: "2026-10-11T11:00:00.000Z", closesAt: "2026-10-13T11:00:00.000Z" };
    const rounds = [R1, r2("closed"), r3];
    expect(place([...W1, W2_COTW, w3], rounds, "2026-10-11T15:00:00+01:00").live).toEqual([
      "3:open:current",
      "2:closed",
    ]);
    expect(place([...W1, W2_COTW, w3], rounds, "2026-10-12T09:00:00+01:00").live).toEqual([
      "3:open",
      "2:closed",
      "4:none:current",
    ]);
  });

  it("moves on after the last week: a late final week awaits results, the one before is record", () => {
    const done = [1, 2].flatMap((n) => [win(n, "creator_of_week"), win(n, "community_favourite")]);
    const p = place([...done, win(3, "creator_of_week")], [], "2026-10-19T10:00:00+01:00");
    expect(p.live).toEqual(["4:none"]);
    expect(p.record).toEqual([3, 2, 1]);
    // Still the final week's own Sunday: it is the running week, as before,
    // with the week waiting on its results ahead of it.
    expect(place(done, [], "2026-10-18T15:00:00+01:00").live).toEqual(["3:none", "4:none:current"]);
  });

  it("marks a published week whose round had fraud removed, and no other", () => {
    const p = place(W1, [R1], "2026-09-30T12:00:00+01:00", [1, 2]);
    expect(p.weeks.find((w) => w.weekNo === 1)!.finalFlagged).toBe(true);
    // Week 2 has no announced Community Favourite, so nothing is final to flag.
    expect(p.weeks.find((w) => w.weekNo === 2)!.finalFlagged).toBe(false);
  });

  it("reads the newest round of a week when a week has two", () => {
    const p = place(
      [...W1, W2_COTW],
      [R1, r2("closed", { opensAt: "2026-10-04T09:00:00.000Z" }), r2("open", { opensAt: "2026-10-05T09:00:00.000Z", closesAt: "2026-10-07T20:00:00.000Z" })],
      "2026-10-06T12:00:00+01:00",
    );
    expect(p.live[0]).toBe("2:open");
  });
});
