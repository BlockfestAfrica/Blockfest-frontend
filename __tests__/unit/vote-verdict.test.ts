import { describe, expect, it } from "vitest";
import { voteVerdict } from "@/lib/admin/winners";

/*
 * The announce card's reading of a finished vote.
 *
 * An exact tie used to be reported with the same state as "nobody voted",
 * so the console told the announcer "No countable votes came in" directly
 * above a round card listing 31, 31, 24, 19, 11, and then offered a picker
 * of all five nominees. The engine accepts only the two at the top: every
 * other name is refused with P0806, while the shortlist is public and the
 * announcement is already late.
 *
 * The rule the two states encode is genuinely different. Nobody voting
 * falls back to Blockfest choosing from the whole shortlist (P0807). A tie
 * does not: the engine accepts a tied leader and nobody else.
 */

const N = (id: string, votes: number) => ({
  enrolmentId: id,
  name: id.toUpperCase(),
  votes,
});

const verdict = (
  nominees: ReturnType<typeof N>[],
  frozenPoints: Record<string, number>,
  settled = true,
) => voteVerdict(nominees, frozenPoints, settled);


describe("the announce card's verdict", () => {
  it("does not call a tie 'no votes'", () => {
    const v = verdict([N("a", 31), N("b", 31), N("c", 24)], { a: 500, b: 500 });
    expect(v.state).toBe("tied");
    expect(v.votes, "the figure the copy quotes back").toBe(31);
  });

  it("offers only the tied leaders, because the engine refuses the rest", () => {
    const v = verdict([N("a", 31), N("b", 31), N("c", 24), N("d", 19)], {
      a: 500,
      b: 500,
      c: 900,
    });
    expect(v.nomineeEnrolmentIds).toEqual(["a", "b"]);
    expect(v.nomineeEnrolmentIds, "c leads on points but lost the vote")
      .not.toContain("c");
  });

  it("still breaks a vote tie on the frozen standings when it can", () => {
    const v = verdict([N("a", 31), N("b", 31)], { a: 400, b: 900 });
    expect(v.state).toBe("decided");
  });

  it("keeps the whole shortlist when nobody actually voted", () => {
    const v = verdict([N("a", 0), N("b", 0), N("c", 0)], {});
    expect(v.state).toBe("zero");
    expect(v.nomineeEnrolmentIds, "P0807 allows any shortlisted name here")
      .toEqual(["a", "b", "c"]);
  });

  it("says nothing at all before the sweep is certified", () => {
    const v = verdict([N("a", 31), N("b", 2)], { a: 1 }, false);
    expect(v.state).toBe("pending");
  });
});
