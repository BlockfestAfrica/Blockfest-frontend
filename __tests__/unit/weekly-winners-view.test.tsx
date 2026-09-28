/**
 * Weekly winners, in the ballot's anatomy.
 *
 * The winners page is where the approved ballot lives, and the section above
 * it was a trophy, a gold eyebrow and a gold pill per award, each in its own
 * box. These pin the rebuilt section: one card per week with a row per
 * award, the winning entry as named platform marks in the ballot's order,
 * long notes clamped with a way to read them, and the week being voted on
 * saying so rather than leaving a visitor to connect it with the ballot.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeeklyWinners } from "@/components/campaigns/weekly-winners";
import type { PublishedWinner } from "@/lib/winners";
import { MONICA_FIRST_LEADERBOARD, MONICA_FIRST_LEADERBOARD_ENDS } from "@/lib/campaigns";

const LONG =
  "Ben's split-screen video compared a month of cash spending against the same month on Monica, receipts included, and the comments turned into a thread of people doing their own.";

const W2_COTW: PublishedWinner = {
  weekNo: 2,
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
const W2_CF: PublishedWinner = {
  weekNo: 2,
  category: "community_favourite",
  name: "Ada Obi",
  prizeNaira: 100_000,
  note: null,
  links: [{ platform: "x", url: "https://x.com/ada/status/2" }],
};
const W1_CF: PublishedWinner = {
  weekNo: 1,
  category: "community_favourite",
  name: "Tolu Adeyemi",
  prizeNaira: 100_000,
  note: null,
  links: [],
};

const week = (n: number) => screen.getByRole("region", { name: `Week ${n}` });

/** The pending Community Favourite row's state line. */
const cfLine = (n: number) =>
  [...week(n).querySelectorAll(":scope > ul > li")]
    .find((li) => li.querySelector("p")?.textContent === "Community Favourite")
    ?.querySelectorAll("p")[1]?.textContent;

afterEach(() => {
  vi.useRealTimers();
});

describe("weekly winners", () => {
  it("draws one card per week, newest first, with a row per award", () => {
    render(<WeeklyWinners winners={[W2_COTW, W2_CF, W1_CF]} vote={null} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Week 2",
      "Week 1",
    ]);
    const rows = [...week(2).querySelectorAll(":scope > ul > li")];
    expect(rows.map((li) => li.querySelector("p")?.textContent)).toEqual(["Ben Eze", "Ada Obi"]);
    expect(week(1).querySelectorAll(":scope > ul > li")).toHaveLength(1);
    expect(week(2).textContent).toContain("Creator of the Week · ₦300,000");
    expect(week(2).textContent).toContain("Community Favourite · ₦100,000");
  });

  it("links the winning entry as marks named for whose and where, X, Instagram, TikTok", () => {
    render(<WeeklyWinners winners={[W2_COTW]} vote={null} />);
    const entry = screen.getByRole("list", { name: "Ben Eze's winning entry" });
    const names = within(entry)
      .getAllByRole("link")
      .map((a) => a.getAttribute("aria-label"));
    expect(names).toEqual([
      "Ben Eze's winning post on X (opens in a new tab)",
      "Ben Eze's winning post on Instagram (opens in a new tab)",
      "Ben Eze's winning post on TikTok (opens in a new tab)",
    ]);
    const x = within(entry).getAllByRole("link")[0];
    expect(x.getAttribute("href")).toBe("https://x.com/ben/status/2");
    expect(x.getAttribute("target")).toBe("_blank");
  });

  it("shows the week being voted on, with a pending Community Favourite row pointing at the ballot", () => {
    render(<WeeklyWinners winners={[W2_COTW, W2_CF, W1_CF]} vote={{ weekNo: 3, state: "open" }} />);
    const three = week(3);
    expect(three.textContent).toContain("Creator of the WeekNot announced yet");
    // State only: who decides is the section hint's to say, once.
    expect(cfLine(3)).toBe("Voting now");
    expect(three.textContent).not.toContain("public vote");
    const vote = within(three).getByRole("link", { name: "Vote for the week 3 Community Favourite" });
    expect(vote.getAttribute("href")).toBe("#shortlist");
    // Newest first, the week on the ballot included.
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Week 3",
      "Week 2",
      "Week 1",
    ]);
  });

  it("says Not announced yet only for the week the ballot is about", () => {
    // Week 1 has no Creator of the Week here, and is not the vote's week.
    render(<WeeklyWinners winners={[W2_COTW, W1_CF]} vote={{ weekNo: 2, state: "open" }} />);
    expect(week(1).textContent).not.toContain("Not announced yet");
    expect(week(2).textContent).not.toContain("Not announced yet");
    expect(cfLine(2)).toBe("Voting now");
  });

  it("drops the pending row once the week's Community Favourite is announced", () => {
    render(<WeeklyWinners winners={[W2_COTW, W2_CF]} vote={{ weekNo: 2, state: "open" }} />);
    expect(cfLine(2)).toBeUndefined();
    expect(week(2).textContent).not.toContain("Voting");
    expect(screen.queryByRole("link", { name: /Vote for the week/ })).toBeNull();
  });

  it("says the vote has closed, with no Vote, after the close", () => {
    render(<WeeklyWinners winners={[]} vote={{ weekNo: 3, state: "closed" }} />);
    expect(cfLine(3)).toBe("Voting has closed");
    expect(screen.queryByRole("link", { name: /Vote for the week/ })).toBeNull();
  });

  it("says the vote opens soon, with no Vote and no gold, before it opens", () => {
    // A round staged on the Saturday for a Sunday open: nothing is being decided yet.
    render(<WeeklyWinners winners={[]} vote={{ weekNo: 3, state: "before" }} />);
    expect(cfLine(3)).toBe("Voting opens soon");
    expect(week(3).textContent).not.toContain("Voting now");
    expect(screen.queryByRole("link", { name: /Vote for the week/ })).toBeNull();
    expect(week(3).innerHTML).not.toContain("border-l-brand-gold");
  });

  it("claims nothing about a vote whose window it cannot read", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-27T12:00:00+01:00"));
    render(<WeeklyWinners winners={[]} vote={{ weekNo: 3, state: "none" }} />);
    expect(screen.queryByRole("region", { name: "Week 3" })).toBeNull();
    expect(document.body.textContent).toContain(
      `Nothing announced yet; the first winners appear here on ${MONICA_FIRST_LEADERBOARD}.`,
    );
  });

  it("names the first winners' day only until it has gone", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // The last second of the Sunday it names: still a promise that can be kept.
    vi.setSystemTime(new Date(new Date(MONICA_FIRST_LEADERBOARD_ENDS).getTime() - 1000));
    const { unmount } = render(<WeeklyWinners winners={[]} vote={null} />);
    expect(document.body.textContent).toContain(`the first winners appear here on ${MONICA_FIRST_LEADERBOARD}.`);
    unmount();
    // The Monday after: no date in the past.
    vi.setSystemTime(new Date(MONICA_FIRST_LEADERBOARD_ENDS));
    render(<WeeklyWinners winners={[]} vote={null} />);
    expect(document.body.textContent).toContain(
      "Nothing announced yet; winners appear here once they are announced.",
    );
    expect(document.body.textContent).not.toContain(MONICA_FIRST_LEADERBOARD);
  });

  describe("a long note", () => {
    // jsdom defines both on Element; the overrides shadow them on
    // HTMLElement, so deleting those puts the originals back.
    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
      Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    });

    it("is clamped to two lines with More, and opens in place, whole in the DOM throughout", () => {
      // jsdom does no layout: stand in for a note that overflows its clamp.
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 80 });
      Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 40 });
      render(<WeeklyWinners winners={[W2_COTW]} vote={null} />);
      const note = screen.getByText(LONG);
      expect(note.className).toContain("line-clamp-2");
      // Named for whose note, so several on a page are told apart, with the
      // visible word first; and a full 44px target, not the word's width.
      // jsdom's name computation trims the hidden suffix's leading space,
      // which browsers keep, so the name is matched loosely and the text
      // exactly.
      const more = screen.getByRole("button", { name: /^More ?about Ben Eze$/ });
      expect(more.textContent).toBe("More about Ben Eze");
      expect(more.className).toContain("min-w-11");
      expect(more.getAttribute("aria-expanded")).toBe("false");
      expect(more.getAttribute("aria-controls")).toBe(note.id);
      expect(note.className).toContain("[overflow-wrap:anywhere]");
      fireEvent.click(more);
      expect(note.className).not.toContain("line-clamp-2");
      expect(screen.getByRole("button", { name: /^Less ?about Ben Eze$/ }).getAttribute("aria-expanded")).toBe("true");
    });

    it("offers no More when nothing is hidden", () => {
      render(<WeeklyWinners winners={[W2_COTW]} vote={null} />);
      expect(screen.getByText(LONG)).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^More/ })).toBeNull();
    });
  });
});
