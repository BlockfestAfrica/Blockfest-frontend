/**
 * The two rules that decide whether a creator can enter this week.
 *
 * Both of these were wrong in ways that cost the creator the week and the
 * points, and both were invisible: the page rendered, the form rendered, and
 * the only symptom was a message telling the creator something untrue.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
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

/**
 * One failing query must not take the whole page down.
 *
 * This page served 500 to every signed-in creator for an afternoon. Everything
 * on it came from a single Promise.all, which rejects if any one promise does,
 * and three of the five loads had no error handling at all. On launch morning a
 * database blip on any one of them would do it to every creator at once.
 */
describe("loading a creator's page when part of it fails", () => {
  const mods = {
    openChallenge: vi.fn(),
    registeredPlatforms: vi.fn(),
    creatorSubmissions: vi.fn(),
  };

  beforeEach(() => {
    vi.resetModules();
    for (const fn of Object.values(mods)) fn.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  async function load() {
    vi.doMock("@/lib/db/client", () => ({ getDb: () => ({}) }));
    const real = await vi.importActual<
      typeof import("@/lib/creator-session")
    >("@/lib/creator-session");
    return real;
  }

  it("does not let a broken points history read as no points", async () => {
    // The total above the list comes from campaign_creators and is correct even
    // when the ledger read fails. An empty list beside a non-zero total would
    // have a creator believing their bonuses were taken away.
    const { creatorPageData } = await load();
    const data = await creatorPageData("not-a-real-uuid");
    expect(data.history).toEqual([]);
    expect(data.failed.history).toBe(true);
  });

  it("reports a failure rather than reading as empty", async () => {
    // The distinction that matters. A creator shown "nothing yet" when their
    // entries merely could not be read concludes their work was lost, and
    // submits it again.
    const { creatorPageData } = await load();
    const data = await creatorPageData("not-a-real-uuid");

    expect(data.submissions, "falls back to empty").toEqual([]);
    expect(
      data.failed.submissions,
      "but says so, so the page does not claim there are none",
    ).toBe(true);
  });

  it("does not reject, whatever happens underneath", async () => {
    const { creatorPageData } = await load();
    await expect(creatorPageData("not-a-real-uuid")).resolves.toBeTruthy();
  });

  it("tells the caller which parts are missing, not just that something is", async () => {
    const { creatorPageData } = await load();
    const data = await creatorPageData("not-a-real-uuid");
    expect(Object.keys(data.failed).sort()).toEqual([
      "challenge",
      "history",
      "platforms",
      "submissions",
    ]);
  });
});
