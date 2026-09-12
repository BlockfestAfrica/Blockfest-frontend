/**
 * The two rules that decide whether a creator can enter this week.
 *
 * Both of these were wrong in ways that cost the creator the week and the
 * points, and both were invisible: the page rendered, the form rendered, and
 * the only symptom was a message telling the creator something untrue.
 */

import { describe, expect, it } from "vitest";
import { platformsUsedThisWeek } from "@/lib/creator-session";

type Row = { weekNo: number; platform: string; status: string };

const row = (over: Partial<Row> = {}): Row => ({
  weekNo: 1,
  platform: "x",
  status: "pending",
  ...over,
});

describe("which platforms are used up", () => {
  it("counts a pending entry", () => {
    expect(platformsUsedThisWeek([row()], 1)).toEqual(["x"]);
  });

  it("counts an approved entry", () => {
    expect(platformsUsedThisWeek([row({ status: "approved" })], 1)).toEqual([
      "x",
    ]);
  });

  /**
   * The one that matters. Migration 0011 made the unique index partial on
   * status <> 'rejected' so this resubmission is allowed, and the page was
   * blocking it.
   */
  it("does NOT count a rejected entry, so it can be sent again", () => {
    expect(platformsUsedThisWeek([row({ status: "rejected" })], 1)).toEqual([]);
  });

  it("frees the platform even when it is the creator's only one", () => {
    // The worst case: one registered account, rejected on Tuesday. Before this
    // the creator read "you have submitted on every account you registered"
    // and had no way through.
    const used = platformsUsedThisWeek([row({ status: "rejected" })], 1);
    const registered = ["x"];
    expect(registered.filter((p) => !used.includes(p))).toEqual(["x"]);
  });

  it("keeps a platform used up when a later entry on it is still pending", () => {
    // Rejected, resubmitted, waiting. The platform is in use again.
    const used = platformsUsedThisWeek(
      [row({ status: "rejected" }), row({ status: "pending" })],
      1,
    );
    expect(used).toEqual(["x"]);
  });

  it("ignores other weeks", () => {
    expect(platformsUsedThisWeek([row({ weekNo: 2 })], 1)).toEqual([]);
  });

  it("handles a creator with nothing submitted", () => {
    expect(platformsUsedThisWeek([], 1)).toEqual([]);
  });
});
