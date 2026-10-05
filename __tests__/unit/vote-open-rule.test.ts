/**
 * When a week's Community Favourite vote may be opened.
 *
 * Stage 2's vote was missed on its Sunday, and on the Monday the console hid
 * the form. These pin the rule the console, the route and the morning email
 * now share: on its own Sunday as before, and late for the week just ended,
 * recorded and unannounced, closing by the time the next stage closes.
 */

import { describe, expect, it } from "vitest";
import { openRefusal, voteOpening } from "@/lib/vote-open-rule";

const lagos = (local: string) => new Date(`${local}+01:00`);
const MONDAY = lagos("2026-10-05T10:00:00");
const facts = { recorded: true, favouriteAnnounced: false };

describe("opening a vote", () => {
  it("lets the week just ended open late, recorded and unannounced, closing by the next stage's close", () => {
    expect(voteOpening({ weekNo: 2, now: MONDAY, ...facts })).toEqual({
      open: true,
      closeBy: "2026-10-10T12:00:00+01:00",
    });
  });

  it("refuses a late vote with no recorded standings, since it could never be closed", () => {
    const opening = voteOpening({ weekNo: 2, now: MONDAY, ...facts, recorded: false });
    expect(opening.open).toBe(false);
    expect(!opening.open && opening.reason).toMatch(/never recorded/);
  });

  it("refuses a late vote once its Community Favourite is announced", () => {
    expect(voteOpening({ weekNo: 2, now: MONDAY, ...facts, favouriteAnnounced: true })).toEqual({
      open: false,
      reason: "Week 2's Community Favourite is already announced.",
    });
  });

  it("stops at the next stage's close, to the minute", () => {
    expect(voteOpening({ weekNo: 2, now: lagos("2026-10-10T11:59:00"), ...facts }).open).toBe(true);
    expect(voteOpening({ weekNo: 2, now: lagos("2026-10-10T12:00:00"), ...facts }).open).toBe(false);
  });

  it("refuses older weeks and weeks not started", () => {
    expect(voteOpening({ weekNo: 1, now: MONDAY, ...facts })).toEqual({
      open: false,
      reason:
        "A missed vote can be opened until the stage after it closes, and stage 2 closed Saturday, 3 October at 12:00 noon.",
    });
    expect(voteOpening({ weekNo: 4, now: MONDAY, ...facts })).toEqual({
      open: false,
      reason: "Week 4 has not started yet.",
    });
  });

  it("treats the week's own Sunday as before: open, with no late deadline", () => {
    const sunday = lagos("2026-10-04T09:00:00");
    expect(voteOpening({ weekNo: 2, now: sunday, ...facts, recorded: false })).toEqual({
      open: true,
      closeBy: null,
    });
    // After the last stage the last week stays current.
    expect(voteOpening({ weekNo: 4, now: lagos("2026-10-18T09:00:00"), ...facts })).toEqual({
      open: true,
      closeBy: null,
    });
    // And the next late window is the week after's.
    expect(voteOpening({ weekNo: 3, now: lagos("2026-10-12T09:00:00"), ...facts })).toEqual({
      open: true,
      closeBy: "2026-10-17T12:00:00+01:00",
    });
  });
});

describe("what the route refuses", () => {
  const late = (closes: string, over: Partial<typeof facts> = {}) =>
    openRefusal({ weekNo: 2, now: MONDAY, ...facts, ...over, closesAt: lagos(closes) });

  it("lets a late vote close up to the next stage's close, and not a minute after", () => {
    expect(late("2026-10-07T08:00:00")).toBeNull();
    expect(late("2026-10-10T12:00:00")).toBeNull();
    expect(late("2026-10-10T12:01:00")).toBe(
      "A late week 2 vote has to close by Saturday, 10 October at 12:00 noon, when stage 3 closes, so it is finished before week 3's own vote.",
    );
  });

  it("says why a past week cannot be opened", () => {
    expect(late("2026-10-07T08:00:00", { recorded: false })).toMatch(
      /^Week 2's vote cannot be opened now\. Its standings were never recorded/,
    );
  });

  it("refuses a close already past", () => {
    expect(late("2026-10-05T09:59:00")).toBe("The close time has already passed.");
  });

  it("on the Sunday, needs the week recorded only for a vote that runs into the next stage", () => {
    const sunday = lagos("2026-10-04T09:00:00");
    const onSunday = (closes: string) =>
      openRefusal({ weekNo: 2, now: sunday, recorded: false, favouriteAnnounced: false, closesAt: lagos(closes) });
    expect(onSunday("2026-10-04T20:00:00")).toBeNull();
    expect(onSunday("2026-10-06T08:00:00")).toBe(
      "Record the week 2 standings first: this vote closes after stage 3 starts, and closing it needs them.",
    );
  });
});
