import { describe, expect, it } from "vitest";
import { voteWindowState } from "@/lib/winners";

/*
 * The defect this guards.
 *
 * The public page decided "is the vote open" from closes_at alone. Rounds
 * are staged the day before they run: the console pre-fills Sunday 08:00 to
 * Sunday 18:00 and the team opens the round on Saturday. So from Saturday
 * evening the page said "Open now" and rendered live ballots, cast_vote
 * refused every one of them with "voting for this round is not open", and
 * the nominee email correctly said it opened Sunday morning.
 *
 * Nothing was corrupted. The cost was turnout on the one prize decided
 * purely by turnout, and two public artefacts of the same announcement
 * disagreeing in front of the people being asked to share it.
 */

const SAT_EVENING = Date.parse("2026-09-26T19:00:00+01:00");
const SUN_MORNING = Date.parse("2026-09-27T09:00:00+01:00");
const SUN_NIGHT = Date.parse("2026-09-27T21:00:00+01:00");

const round = {
  opensAt: new Date("2026-09-27T08:00:00+01:00").toISOString(),
  closesAt: new Date("2026-09-27T18:00:00+01:00").toISOString(),
};

describe("voteWindowState", () => {
  it("is not open before it opens, which is the whole bug", () => {
    expect(voteWindowState(round, SAT_EVENING)).toBe("before");
  });

  it("is open inside the window", () => {
    expect(voteWindowState(round, SUN_MORNING)).toBe("open");
  });

  it("is closed after it closes", () => {
    expect(voteWindowState(round, SUN_NIGHT)).toBe("closed");
  });

  it("opens exactly on the instant, not a tick later", () => {
    expect(voteWindowState(round, Date.parse(round.opensAt))).toBe("open");
  });

  it("closes exactly on the instant", () => {
    expect(voteWindowState(round, Date.parse(round.closesAt))).toBe("closed");
  });

  it("has no round when there is no entry", () => {
    expect(voteWindowState(undefined, SUN_MORNING)).toBe("none");
  });

  it("treats an unreadable closes_at as no round, never as open forever", () => {
    expect(voteWindowState({ opensAt: round.opensAt, closesAt: "" }, SUN_MORNING)).toBe("none");
    expect(
      voteWindowState({ opensAt: round.opensAt, closesAt: "not a date" }, SUN_MORNING),
    ).toBe("none");
  });

  it("falls through to open when opens_at is unreadable, not to a dead vote", () => {
    // Deliberate asymmetry. The engine re-checks the window on every cast,
    // so guessing open costs a button that answers honestly; guessing
    // not-yet would hide a live ballot for the whole round.
    expect(voteWindowState({ opensAt: "", closesAt: round.closesAt }, SUN_MORNING)).toBe("open");
    expect(
      voteWindowState({ opensAt: "not a date", closesAt: round.closesAt }, SUN_MORNING),
    ).toBe("open");
  });
});
