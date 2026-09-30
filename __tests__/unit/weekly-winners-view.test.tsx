/**
 * The winners page, week by week.
 *
 * The owner saw week 1's final count twice, one under the other, and nothing
 * saying which week was which. These render the real week cards from the
 * real week model at moments of the campaign and pin what each says: the
 * running week and its dates, what is next for each award, the vote inside
 * the week it decides, and the record with each count said once.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveWeek, WinnersRecord } from "@/components/campaigns/weekly-winners";
import { monicaStages } from "@/lib/campaigns";
import { winnersByWeek } from "@/lib/winner-weeks";
import type { PublicRound, PublishedWinner, ShortlistEntry } from "@/lib/winners";

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

const weeksAt = (when: string, winners: PublishedWinner[], rounds: PublicRound[]) =>
  winnersByWeek({ stages: monicaStages, winners, rounds, finals: FINALS, now: new Date(when).getTime() });

const card = (n: number) => screen.getByRole("region", { name: new RegExp(`^Week ${n}\\b`) });

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
});

describe("a week that is happening now", () => {
  it("names the week, its dates and that it is this week, with when each award comes", () => {
    const { live } = weeksAt("2026-09-30T12:00:00+01:00", [W1_COTW, W1_CF], [R1]);
    render(<LiveWeek week={live[0]} shortlist={[]} ballotState="none" />);
    const week = card(2);
    expect(within(week).getByRole("heading", { level: 3 }).textContent).toBe(
      "Week 2, 28 September – 3 October",
    );
    expect(week.textContent).toContain("This week");
    expect(week.textContent).toContain("Entries close Saturday, 3 October at 12:00");
    expect(week.textContent).toContain("Announced Sunday 4 October");
    expect(week.textContent).toContain("Vote opens Sunday 4 October");
  });

  it("holds the vote as its Community Favourite row, with the clock and the rule said once", () => {
    const { live } = weeksAt("2026-10-05T12:00:00+01:00", [W1_COTW, W1_CF, W2_COTW], [R1, R2]);
    const week2 = live.find((w) => w.weekNo === 2)!;
    render(<LiveWeek week={week2} shortlist={SHORTLIST} ballotState="open" />);
    const week = card(2);
    expect(week.textContent).toContain("Voting now");
    expect(week.textContent).toContain("Chidi Eze");
    expect(week.textContent).toMatch(/one vote per email address, confirmed by a six digit code/);
    expect(within(week).getAllByRole("button", { name: /Vote/ }).length).toBe(SHORTLIST.length);
    // Entries are yesterday's news once the vote is on.
    expect(week.textContent).not.toContain("Entries close");
    // No card inside the card: the ballot has no border of its own here.
    expect(week.querySelector(".rounded-xl .rounded-xl")).toBeNull();
  });

  it("says the votes are in review once voting has closed, with no Vote", () => {
    const closed = { ...R2, status: "closed" as const };
    const { live } = weeksAt("2026-10-06T22:00:00+01:00", [W1_COTW, W1_CF, W2_COTW], [R1, closed]);
    render(<LiveWeek week={live[0]} shortlist={[]} ballotState="none" />);
    const week = card(2);
    expect(week.textContent).toContain("Votes in review");
    expect(week.textContent).toContain("Voting has closed. The Community Favourite is confirmed after review.");
    expect(within(week).queryByRole("button", { name: /Vote/ })).toBeNull();
  });

  it("says a late week is awaiting results, and promises neither a day that has gone nor a vote that cannot open", () => {
    const { live } = weeksAt("2026-10-05T09:00:00+01:00", [W1_COTW, W1_CF], [R1]);
    render(<LiveWeek week={live[0]} shortlist={[]} ballotState="none" />);
    const week = card(2);
    expect(week.textContent).toContain("Awaiting results");
    expect(week.textContent).toContain("Not announced yet");
    // Last week's vote cannot open once the next stage has begun.
    expect(week.textContent).not.toContain("Vote opens");
    expect(week.textContent).not.toContain("Sunday 4 October");
  });
});

describe("the record", () => {
  const record = () => weeksAt("2026-09-30T12:00:00+01:00", [W1_COTW, W1_CF], [R1]).record;

  it("groups each finished week under its own name, and counts the weeks", () => {
    render(<WinnersRecord weeks={record()} of={4} />);
    expect(screen.getByRole("heading", { level: 2, name: "Winners so far" })).toBeTruthy();
    expect(screen.getByText(/1 of 4 weeks announced/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: /^Week 1/ })).toBeTruthy();
    // Each award is a row naming its winner and its award; the count below
    // also names the nominees, so the row is found by its award line.
    const row = (name: string, award: string) =>
      screen.getAllByText(name).find((el) => el.closest("li")?.textContent?.includes(award));
    expect(row("Ben Eze", "Creator of the Week")).toBeTruthy();
    expect(row("Ada Obi", "Community Favourite")).toBeTruthy();
  });

  it("says the week's count once, closed, with the total, and opens to the ranked count", () => {
    const { container } = render(<WinnersRecord weeks={record()} of={4} />);
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(1);
    expect(details[0].open).toBe(false);
    expect(details[0].querySelector("summary")!.textContent).toMatch(/Week 1 vote count\s*1,156 verified votes/);
  });

  it("keeps the fraud notice with a week whose round had votes removed, outside its closed count", () => {
    const flaggedRecord = winnersByWeek({
      stages: monicaStages,
      winners: [W1_COTW, W1_CF],
      rounds: [R1],
      finals: FINALS,
      flagged: [1],
      now: new Date("2026-09-30T12:00:00+01:00").getTime(),
    }).record;
    const { container } = render(<WinnersRecord weeks={flaggedRecord} of={4} />);
    const notice = container.querySelector("[role='status'], [aria-label]");
    expect(container.textContent).toMatch(/genuine votes count/i);
    expect(container.querySelector("details")!.textContent).not.toMatch(/genuine votes count/i);
    expect(notice).toBeTruthy();
  });

  it("shows no fraud notice for a week without removals", () => {
    const { container } = render(<WinnersRecord weeks={record()} of={4} />);
    expect(container.textContent).not.toMatch(/genuine votes count/i);
  });

  it("links the winning entry as marks named for whose and where, X, Instagram, TikTok", () => {
    render(<WinnersRecord weeks={record()} of={4} />);
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
    render(<WinnersRecord weeks={record()} of={4} />);
    const note = screen.getByText(LONG);
    expect(note.className).toContain("line-clamp-2");
    fireEvent.click(screen.getByRole("button", { name: /^More ?about Ben Eze$/ }));
    expect(note.className).not.toContain("line-clamp-2");
  });

  it("is called the winners once every week is in", () => {
    const all = [1, 2, 3, 4].flatMap((n) => [
      { ...W1_COTW, weekNo: n, note: null },
      { ...W1_CF, weekNo: n },
    ]);
    const { record: done } = weeksAt("2026-10-25T12:00:00+01:00", all, []);
    render(<WinnersRecord weeks={done} of={4} />);
    expect(screen.getByRole("heading", { level: 2, name: "The winners" })).toBeTruthy();
  });
});

describe("the page", () => {
  const page = readFileSync(join(process.cwd(), "app/campaigns/monica-money-story/winners/page.tsx"), "utf8");

  it("places every week once, and keeps #shortlist for the emails and stage cards", () => {
    expect(page).toContain("winnersByWeek(");
    expect(page).toMatch(/id="shortlist"/);
    expect(page).toContain("Happening now");
    // No second section for the vote: it lives in its week now.
    expect(page).not.toContain("Community Favourite vote");
    expect(page).not.toContain("<Ballot");
  });

  it("draws the live count once, under the week whose round opened last", () => {
    expect(page.match(/<LiveVoteCount \/>/g)).toHaveLength(1);
    expect(page).toMatch(/week\.weekNo === countWeek && <LiveVoteCount \/>/);
  });
});
