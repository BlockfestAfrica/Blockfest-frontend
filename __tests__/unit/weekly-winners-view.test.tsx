/**
 * The winners page, week by week.
 *
 * The owner saw week 1's final count twice, one under the other, and nothing
 * saying which week was which; then, on 5 October, the moving fraud notice
 * under a vote long closed, and no way to see at a glance what had happened
 * and what to do now. He picked "Do this now" first, an index of every
 * week, then every week in calendar order. These render the real pieces from
 * the real week model at moments of the campaign and pin what each says.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoThisNow, WeekCard, WeekStrip } from "@/components/campaigns/weekly-winners";
import { monicaStages } from "@/lib/campaigns";
import { actionsNow, weekTimeline, winnersByWeek, type TimelineWeek } from "@/lib/winner-weeks";
import type { PublicRound, PublishedWinner, ShortlistEntry, VoteWindowState } from "@/lib/winners";

/* The page's data calls, answered from each test; everything else real.
   The live count fetches in the browser, so it is a marker here. */
const data = vi.hoisted(() => ({
  winners: [] as unknown[],
  shortlist: [] as unknown[],
  finals: {} as Record<number, unknown[]>,
  rounds: [] as unknown[],
  flagged: [] as number[],
}));
vi.mock("@/lib/winners", async (original) => ({
  ...(await original<typeof import("@/lib/winners")>()),
  publishedWinners: async () => data.winners,
  currentShortlist: async () => data.shortlist,
  finalCounts: async () => data.finals,
  publicRounds: async () => data.rounds,
  flaggedWeeks: async () => data.flagged,
}));
vi.mock("@/components/campaigns/live-vote-count", () => ({
  LiveVoteCount: () => <div data-testid="live-count" />,
}));

const LONG =
  "Ben's split-screen video compared a month of cash spending against the same month on Monica, receipts included, and the comments turned into a thread of people doing their own.";

const W1_COTW: PublishedWinner = {
  weekNo: 1,
  category: "creator_of_week",
  name: "Ben Eze",
  prizeNaira: 300_000,
  note: LONG,
  links: [
    { platform: "tiktok", url: "https://www.tiktok.com/@ben/video/2" },
    { platform: "instagram", url: "https://www.instagram.com/reel/ben/" },
    { platform: "x", url: "https://x.com/ben/status/2" },
  ],
};
const W1_CF: PublishedWinner = {
  weekNo: 1,
  category: "community_favourite",
  name: "Ada Obi",
  prizeNaira: 100_000,
  note: null,
  links: [{ platform: "x", url: "https://x.com/ada/status/2" }],
};
const W2_COTW: PublishedWinner = { ...W1_CF, weekNo: 2, category: "creator_of_week", name: "Chidi Eze", prizeNaira: 300_000 };
const R1: PublicRound = { weekNo: 1, status: "published", opensAt: "2026-09-27T09:00:00.000Z", closesAt: "2026-09-29T20:00:00.000Z" };
const R2: PublicRound = { weekNo: 2, status: "open", opensAt: "2026-10-04T09:00:00.000Z", closesAt: "2026-10-06T20:00:00.000Z" };
const FINALS = {
  1: [
    { nomineeId: "a", name: "Ada Obi", votes: 602 },
    { nomineeId: "b", name: "MDee Boss", votes: 554 },
  ],
};
const SHORTLIST: ShortlistEntry[] = ["Tobi Ade", "Ngozi Umeh"].map((name, i) => ({
  name,
  weekNo: 2,
  links: [],
  roundId: "r2",
  nomineeId: `n${i}`,
  opensAt: R2.opensAt,
  closesAt: R2.closesAt,
}));

const weeksAt = (when: string, winners: PublishedWinner[], rounds: PublicRound[], flagged: number[] = []) =>
  winnersByWeek({ stages: monicaStages, winners, rounds, finals: FINALS, flagged, now: new Date(when).getTime() });

/** Every week at a moment, as the page places them. */
const timelineAt = (when: string, winners: PublishedWinner[], rounds: PublicRound[], flagged: number[] = []) =>
  weekTimeline(monicaStages, weeksAt(when, winners, rounds, flagged), new Date(when).getTime());

/** One week's card, as the page draws it. */
function drawWeek(
  timeline: TimelineWeek[],
  n: number,
  opts: { shortlist?: ShortlistEntry[]; ballotState?: VoteWindowState; countHere?: boolean; shortlistHere?: boolean } = {},
) {
  return render(
    <WeekCard
      entry={timeline.find((t) => t.week.weekNo === n)!}
      last={n === monicaStages.length}
      shortlist={opts.shortlist ?? []}
      ballotState={opts.ballotState ?? "none"}
      countHere={opts.countHere ?? false}
      shortlistHere={opts.shortlistHere ?? false}
    />,
  );
}

const card = (n: number) => screen.getByRole("region", { name: new RegExp(`^Week ${n}\\b`) });

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  vi.useRealTimers();
});

describe("a week that is happening now", () => {
  it("names the week and its dates, says entries are open, and when each award comes", () => {
    const t = timelineAt("2026-09-30T12:00:00+01:00", [W1_COTW, W1_CF], [R1]);
    drawWeek(t, 2);
    const week = card(2);
    expect(within(week).getByRole("heading", { level: 3 }).textContent).toBe(
      "Week 2, 28 September – 3 October",
    );
    expect(week.textContent).toContain("Entries open");
    expect(week.textContent).toContain("Entries close Saturday 3 October at 12:00 noon");
    expect(week.textContent).toContain("Announced Sunday 4 October");
    // No day promised for the vote while entries are still coming in.
    expect(week.textContent).toContain("A public vote on the shortlist, once entries close");
  });

  it("holds the vote as its Community Favourite row, on #shortlist, with the clock and the rule said once", () => {
    const t = timelineAt("2026-10-05T12:00:00+01:00", [W1_COTW, W1_CF, W2_COTW], [R1, R2]);
    const { container } = drawWeek(t, 2, { shortlist: SHORTLIST, ballotState: "open", shortlistHere: true });
    const week = card(2);
    expect(week.textContent).toContain("Voting now");
    expect(week.textContent).toContain("Chidi Eze");
    expect(week.textContent).toMatch(/one vote per email address, confirmed by a six digit code/);
    expect(within(week).getAllByRole("button", { name: /Vote/ }).length).toBe(SHORTLIST.length);
    // #shortlist is the ballot itself, once.
    expect(container.querySelectorAll("#shortlist")).toHaveLength(1);
    expect(container.querySelector("#shortlist")!.textContent).toContain("Tobi Ade");
    // Entries are yesterday's news once the vote is on.
    expect(week.textContent).not.toContain("Entries close");
    // No card inside the card: the ballot has no border of its own here.
    expect(week.querySelector(".rounded-xl .rounded-xl")).toBeNull();
  });

  it("drops the entries line on the Sunday its vote opens, while it is still the current week", () => {
    const t = timelineAt("2026-10-04T15:00:00+01:00", [W1_COTW, W1_CF, W2_COTW], [R1, R2]);
    expect(t.find((x) => x.week.weekNo === 2)!.week.current).toBe(true);
    drawWeek(t, 2, { shortlist: SHORTLIST, ballotState: "open", shortlistHere: true });
    expect(card(2).textContent).toContain("Voting now");
    expect(card(2).textContent).not.toContain("Entries close");
  });

  it("says the votes are in review once voting has closed, with no Vote, and keeps #shortlist on the week", () => {
    const closed = { ...R2, status: "closed" as const };
    const t = timelineAt("2026-10-06T22:00:00+01:00", [W1_COTW, W1_CF, W2_COTW], [R1, closed]);
    const { container } = drawWeek(t, 2, { shortlistHere: true });
    const week = card(2);
    expect(week.textContent).toContain("Votes in review");
    expect(week.textContent).toContain("Voting has closed. The Community Favourite is confirmed after review.");
    expect(within(week).queryByRole("button", { name: /Vote/ })).toBeNull();
    // The emails' link still lands on this week's vote.
    expect(container.querySelector("#week-2 #shortlist")).toBeTruthy();
  });

  it("says a late week is awaiting results, and promises neither a day that has gone nor a vote that cannot open", () => {
    const t = timelineAt("2026-10-05T09:00:00+01:00", [W1_COTW, W1_CF], [R1]);
    drawWeek(t, 2);
    const week = card(2);
    expect(week.textContent).toContain("Awaiting results");
    expect(week.textContent).toContain("Not announced yet");
    expect(week.textContent).not.toContain("Vote opens");
    expect(week.textContent).not.toContain("Sunday 4 October");
  });
});

describe("a week still to come", () => {
  it("is one quiet line: when it starts and when its entries close", () => {
    const t = timelineAt("2026-10-05T12:00:00+01:00", [W1_COTW, W1_CF], [R1]);
    const { container } = drawWeek(t, 4);
    const week = card(4);
    expect(week.textContent).toContain("Starts 12 October");
    expect(week.textContent).toContain("The last week. Entries close Saturday 17 October at 12:00 noon.");
    expect(container.querySelector("ul")).toBeNull();
    expect(week.className).toContain("border-dashed");
  });
});

describe("a finished week", () => {
  const t = () => timelineAt("2026-09-30T12:00:00+01:00", [W1_COTW, W1_CF], [R1]);

  it("says its winners are announced and names each award's winner in a row of its own", () => {
    drawWeek(t(), 1);
    const week = card(1);
    expect(week.textContent).toContain("Winners announced");
    const row = (name: string, award: string) =>
      screen.getAllByText(name).find((el) => el.closest("li")?.textContent?.includes(award));
    expect(row("Ben Eze", "Creator of the Week")).toBeTruthy();
    expect(row("Ada Obi", "Community Favourite")).toBeTruthy();
  });

  it("says its count once, closed, with the total, and opens to the ranked count", () => {
    const { container } = drawWeek(t(), 1);
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(1);
    expect(details[0].open).toBe(false);
    expect(details[0].querySelector("summary")!.textContent).toMatch(/Final vote count, week 1\s*1,156 verified votes/);
  });

  it("says removed fraud once, quietly, inside its count, with no moving notice", () => {
    const flagged = timelineAt("2026-09-30T12:00:00+01:00", [W1_COTW, W1_CF], [R1], [1]);
    const { container } = drawWeek(flagged, 1);
    const count = container.querySelector("details")!;
    expect(count.textContent).toContain(
      "Suspicious votes were found in this round and removed before the winner was confirmed.",
    );
    // The owner, 5 October: the moving notice is for the live vote only.
    expect(container.textContent).not.toMatch(/genuine votes count/i);
    expect(screen.queryByRole("button", { name: /the notice/ })).toBeNull();
  });

  it("shows only the award a finished week has, and promises none it will not get", () => {
    // Week 2's Creator of the Week is in; its vote was never run, and the
    // window for a late one closed with stage 3.
    const t = timelineAt("2026-10-13T12:00:00+01:00", [W1_COTW, W1_CF, W2_COTW], [R1]);
    drawWeek(t, 2);
    const week = card(2);
    expect(week.textContent).toContain("Announced");
    expect(week.textContent).not.toContain("Winners announced");
    expect(week.textContent).toContain("Chidi Eze");
    expect(week.textContent).not.toContain("Not announced yet");
    expect(week.textContent).not.toContain("Community Favourite");
  });

  it("says nothing about fraud for a week without removals", () => {
    const { container } = drawWeek(t(), 1);
    expect(container.textContent).not.toMatch(/suspicious|genuine votes count/i);
  });

  it("links the winning entry as marks named for whose and where, X, Instagram, TikTok", () => {
    drawWeek(t(), 1);
    const entry = screen.getByRole("list", { name: "Ben Eze's winning entry" });
    expect(within(entry).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
      "Ben Eze's winning post on X (opens in a new tab)",
      "Ben Eze's winning post on Instagram (opens in a new tab)",
      "Ben Eze's winning post on TikTok (opens in a new tab)",
    ]);
  });

  it("clamps a long note to two lines with More, and opens it in place", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 80 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 40 });
    drawWeek(t(), 1);
    const note = screen.getByText(LONG);
    expect(note.className).toContain("line-clamp-2");
    fireEvent.click(screen.getByRole("button", { name: /^More ?about Ben Eze$/ }));
    expect(note.className).not.toContain("line-clamp-2");
  });
});

describe("the index of every week", () => {
  it("links all four weeks to their cards, each saying where it stands, done to come", () => {
    const t = timelineAt("2026-10-05T12:00:00+01:00", [W1_COTW, W1_CF, W2_COTW], [R1, R2]);
    render(<WeekStrip timeline={t} />);
    const nav = screen.getByRole("navigation", { name: "Jump to a week" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#week-1", "#week-2", "#week-3", "#week-4"]);
    expect(links.map((a) => a.textContent)).toEqual([
      "Week 1, 16–24 Sep: Winners announced",
      "Week 2, 28 Sep – 3 Oct: Voting now",
      "Week 3, 5–10 Oct: Entries open",
      "Week 4, 12–17 Oct: Starts 12 Oct",
    ]);
  });
});

describe("do this now", () => {
  const at = "2026-10-05T12:00:00+01:00";
  const t = () => timelineAt(at, [W1_COTW, W1_CF, W2_COTW], [R1, R2]);
  /* The rows go at their deadlines by the browser's clock, so the clock is
     the scenario's, not the machine's: without this, these passed on the
     Monday they were written and failed every deploy once the week 2 vote
     had really closed. */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(at));
  });

  it("lists the vote and the entry, soonest first, each with its deadline and one button", () => {
    render(<DoThisNow actions={actionsNow(t())} ballotWeek={2} />);
    const region = screen.getByRole("region", { name: "Do this now" });
    const rows = within(region).getAllByRole("listitem");
    expect(rows.map((r) => r.querySelector("p")!.textContent)).toEqual([
      "Vote for week 2's Community Favourite",
      "Enter week 3's challenge",
    ]);
    expect(rows[0].textContent).toContain("Closes Tuesday 6 October at 21:00");
    expect(rows[1].textContent).toContain("Entries close Saturday 10 October at 12:00 noon");
    // The vote lands on the Vote buttons; entering happens on the creator page.
    expect(within(rows[0]).getByRole("link").getAttribute("href")).toBe("#shortlist");
    expect(within(rows[1]).getByRole("link", { name: /Enter week 3/ }).getAttribute("href")).toBe(
      "/campaigns/monica-money-story/me",
    );
    // The creator page only knows registered creators: a way in for the rest.
    expect(within(rows[1]).getByRole("link", { name: "Join the campaign" }).getAttribute("href")).toBe(
      "/campaigns/monica-money-story/register",
    );
    // A plain anchor, not the router's Link (which also renders an <a>):
    // only the browser's own fragment jump moves keyboard focus with it.
    const parts = readFileSync(join(process.cwd(), "components/campaigns/weekly-winners.tsx"), "utf8");
    expect(parts).toMatch(/<a\s+href=\{ballotWeek === action\.weekNo \? "#shortlist"/);
    expect(within(rows[0]).queryByRole("link", { name: "Join the campaign" })).toBeNull();
  });

  it("takes each row away at its own deadline, and the card with the last", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(at));
    render(<DoThisNow actions={actionsNow(t())} ballotWeek={2} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // Week 2's vote closes Tuesday 6 October at 21:00 Lagos.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Date.parse("2026-10-06T20:00:01Z") - Date.now());
    });
    expect(screen.queryByText("Vote for week 2's Community Favourite")).toBeNull();
    expect(screen.getByText("Enter week 3's challenge")).toBeTruthy();
    // Week 3's entries close Saturday 10 October at noon.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Date.parse("2026-10-10T11:00:01Z") - Date.now());
    });
    expect(screen.queryByRole("region", { name: "Do this now" })).toBeNull();
  });

  it("sends the vote to its week when the ballot is not on the page", () => {
    render(<DoThisNow actions={actionsNow(t())} ballotWeek={null} />);
    expect(screen.getByRole("link", { name: /Vote now on week 2/ }).getAttribute("href")).toBe("#week-2");
  });

  it("is not drawn when there is nothing to do", () => {
    const { container } = render(<DoThisNow actions={[]} ballotWeek={null} />);
    expect(container.textContent).toBe("");
  });
});

describe("the page, rendered", () => {
  const draw = async (when: string, d: Partial<typeof data>) => {
    Object.assign(data, { winners: [], shortlist: [], finals: FINALS, rounds: [], flagged: [] }, d);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(when));
    const { default: WinnersPage } = await import("@/app/campaigns/monica-money-story/winners/page");
    return render(await WinnersPage());
  };
  const anchors = (c: HTMLElement) => c.querySelectorAll("#shortlist");

  it("puts what to do first, then all four weeks in calendar order", async () => {
    const { container } = await draw("2026-10-05T12:00:00+01:00", {
      winners: [W1_COTW, W1_CF, W2_COTW],
      rounds: [R1, R2],
      shortlist: SHORTLIST,
    });
    const order = [...container.querySelectorAll("#do-now, nav[aria-label='Jump to a week'], section[id^='week-']")].map(
      (el) => el.id || "strip",
    );
    expect(order).toEqual(["do-now", "strip", "week-1", "week-2", "week-3", "week-4"]);
  });

  it("puts #shortlist on the ballot, once, and the live count in the voting week only", async () => {
    const { container } = await draw("2026-10-05T12:00:00+01:00", {
      winners: [W1_COTW, W1_CF, W2_COTW],
      rounds: [R1, R2],
      shortlist: SHORTLIST,
      flagged: [1],
    });
    expect(anchors(container)).toHaveLength(1);
    expect(container.querySelector("#week-2 #shortlist")!.tagName).toBe("LI");
    expect(screen.getAllByTestId("live-count")).toHaveLength(1);
    expect(container.querySelector("#week-2 [data-testid='live-count']")).toBeTruthy();
    // Week 1 had fraud removed: said once, quietly, in its count, never moving.
    expect(container.querySelector("#week-1")!.textContent).not.toMatch(/genuine votes count/i);
    expect(container.querySelector("#week-1 details")!.textContent).toContain("Suspicious votes were found");
  });

  it("keeps #shortlist on the week in review once its ballot has gone", async () => {
    const { container } = await draw("2026-10-06T22:00:00+01:00", {
      winners: [W1_COTW, W1_CF, W2_COTW],
      rounds: [R1, { ...R2, status: "closed" }],
    });
    expect(anchors(container)).toHaveLength(1);
    expect(container.querySelector("#week-2 #shortlist")!.tagName).toBe("SPAN");
    expect(container.querySelector("#week-2 [data-testid='live-count']")).toBeTruthy();
    expect(screen.queryByText(/Vote for week 2/)).toBeNull();
  });

  it("follows the newest vote when last week's is still in review", async () => {
    const R3: PublicRound = { weekNo: 3, status: "open", opensAt: "2026-10-11T08:00:00.000Z", closesAt: "2026-10-13T08:00:00.000Z" };
    const { container } = await draw("2026-10-11T12:00:00+01:00", {
      winners: [W1_COTW, W1_CF, W2_COTW],
      rounds: [R1, { ...R2, status: "closed" }, R3],
      shortlist: SHORTLIST.map((e) => ({ ...e, weekNo: 3, opensAt: R3.opensAt, closesAt: R3.closesAt })),
    });
    expect(anchors(container)).toHaveLength(1);
    expect(container.querySelector("#week-3 #shortlist")).toBeTruthy();
    expect(screen.getAllByTestId("live-count")).toHaveLength(1);
    expect(container.querySelector("#week-3 [data-testid='live-count']")).toBeTruthy();
    expect(container.querySelector("#week-2")!.textContent).toContain("Votes in review");
  });
});
