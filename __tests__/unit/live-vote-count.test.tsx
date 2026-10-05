import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveVoteCount } from "@/components/campaigns/live-vote-count";
import { INTEGRITY_NOTICE } from "@/components/campaigns/integrity-ticker";
import {
  boardState,
  rankBoard,
  readBoard,
  REFRESH_MS,
  type VoteBoard,
} from "@/lib/vote-board";

/*
 * The count under the ballot.
 *
 * Owner brief: the count public and moving as people vote, without hitting
 * the database every moment, so it refreshes on a five minute beat and says
 * when it last did. These pin the ranking rules (nobody leads a tie), the
 * reader that refuses a malformed answer, and the component's refresh,
 * which only asks while the tab is showing.
 */

const SUNDAY = new Date("2026-09-27T15:00:00Z");

const board = (over: Partial<VoteBoard> = {}): VoteBoard => ({
  weekNo: 1,
  opensAt: "2026-09-27T07:00:00.000Z",
  closesAt: "2026-09-29T07:00:00.000Z",
  closed: false,
  final: false,
  flagged: false,
  asOf: "2026-09-27T14:58:00.000Z",
  nominees: [
    { nomineeId: "a", name: "Ada Obi", votes: 12 },
    { nomineeId: "b", name: "Ben Eze", votes: 30 },
    { nomineeId: "c", name: "Cy Ade", votes: 8 },
  ],
  ...over,
});

describe("rankBoard", () => {
  it("puts the most votes first with shares of the whole", () => {
    const { rows, total, levelAtTop } = rankBoard(board().nominees);
    expect(rows.map((r) => [r.name, r.rank, r.share, r.leading])).toEqual([
      ["Ben Eze", 1, 60, true],
      ["Ada Obi", 2, 24, false],
      ["Cy Ade", 3, 16, false],
    ]);
    expect(total).toBe(50);
    expect(levelAtTop).toBe(false);
  });

  it("shares a rank on a tie, keeps ballot order inside it, and leads nobody", () => {
    const { rows, levelAtTop } = rankBoard([
      { nomineeId: "a", name: "Ada", votes: 5 },
      { nomineeId: "b", name: "Ben", votes: 9 },
      { nomineeId: "c", name: "Cy", votes: 9 },
      { nomineeId: "d", name: "Di", votes: 1 },
    ]);
    expect(rows.map((r) => [r.name, r.rank, r.leading])).toEqual([
      ["Ben", 1, false],
      ["Cy", 1, false],
      ["Ada", 3, false],
      ["Di", 4, false],
    ]);
    expect(levelAtTop).toBe(true);
  });

  it("marks no leader and no tie while nobody has voted", () => {
    const { rows, total, levelAtTop } = rankBoard([
      { nomineeId: "a", name: "Ada", votes: 0 },
      { nomineeId: "b", name: "Ben", votes: 0 },
    ]);
    expect(total).toBe(0);
    expect(levelAtTop).toBe(false);
    expect(rows.every((r) => r.share === 0 && !r.leading && r.rank === 1)).toBe(true);
  });
});

describe("boardState", () => {
  const now = SUNDAY.getTime();
  it("follows the clock, the owner's close and publication", () => {
    expect(boardState(board({ opensAt: "2026-09-27T18:00:00Z" }), now)).toBe("before");
    expect(boardState(board(), now)).toBe("open");
    expect(boardState(board({ closesAt: "2026-09-27T14:00:00Z" }), now)).toBe("closed");
    expect(boardState(board({ closed: true }), now)).toBe("closed");
    expect(boardState(board({ closed: true, final: true }), now)).toBe("final");
  });
});

describe("readBoard", () => {
  it("rebuilds a good answer field by field", () => {
    const extra = { ...board(), email: "x@e.com" };
    const read = readBoard({ ok: true, board: extra });
    expect(read).toEqual(board());
    expect(read).not.toHaveProperty("email");
  });

  it("refuses anything malformed whole", () => {
    expect(readBoard({ ok: false, board: null })).toBeNull();
    expect(readBoard({ ok: true, board: null })).toBeNull();
    expect(readBoard({ ok: true, board: { ...board(), asOf: "soon" } })).toBeNull();
    expect(
      readBoard({ ok: true, board: { ...board(), nominees: [{ nomineeId: "a", name: "A", votes: -1 }] } }),
    ).toBeNull();
    expect(
      readBoard({ ok: true, board: { ...board(), nominees: [{ nomineeId: "a", name: "A", votes: "3" }] } }),
    ).toBeNull();
  });
});

describe("LiveVoteCount", () => {
  let answer: unknown;
  const fetchMock = vi.fn(async () => ({ json: async () => answer }));
  let visibility: DocumentVisibilityState = "visible";

  beforeEach(() => {
    answer = { ok: true, board: board() };
    visibility = "visible";
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    vi.useFakeTimers();
    vi.setSystemTime(SUNDAY);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const settle = () => act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  it("draws the ranked count, the total and when it was read", async () => {
    render(<LiveVoteCount />);
    await settle();
    expect(screen.getByRole("heading", { name: "Live count" })).toBeTruthy();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Ben Eze");
    expect(items[0]).toContain("in the lead");
    expect(items[0]).toContain("30 votes,");
    expect(items[0]).toContain("60%");
    // The week is the card's own heading, so the count does not say it again.
    expect(screen.getByText("50 votes")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Week 1 ·");
    // 14:58 UTC is 15:58 in Lagos.
    expect(screen.getByText("15:58").tagName).toBe("TIME");
    expect(document.body.textContent).toContain("Refreshes every 5 minutes.");
  });

  it("asks again every five minutes, but not while the tab is hidden", async () => {
    render(<LiveVoteCount />);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    visibility = "hidden";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Back on the tab after a missed beat: asks at once.
    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps a newer count when an older copy comes back", async () => {
    render(<LiveVoteCount />);
    await settle();
    answer = {
      ok: true,
      board: board({
        asOf: "2026-09-27T14:50:00.000Z",
        nominees: [{ nomineeId: "a", name: "Ada Obi", votes: 1 }],
      }),
    };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS);
    });
    expect(screen.getByText("50 votes")).toBeTruthy();
  });

  it("keeps the last count when a refresh fails", async () => {
    render(<LiveVoteCount />);
    await settle();
    answer = { ok: false, board: null };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS);
    });
    expect(screen.getByText("50 votes")).toBeTruthy();
  });

  it("shows nothing before voting opens, or when there is no count", async () => {
    answer = { ok: true, board: board({ opensAt: "2026-09-27T18:00:00Z" }) };
    const { container, unmount } = render(<LiveVoteCount />);
    await settle();
    expect(container.innerHTML).toBe("");
    unmount();

    answer = { ok: false, board: null };
    const second = render(<LiveVoteCount />);
    await settle();
    expect(second.container.innerHTML).toBe("");
  });

  it("stays up once voting closes; once final it is not drawn again for a fresh visit, and stops asking", async () => {
    answer = { ok: true, board: board({ closed: true }) };
    const { unmount } = render(<LiveVoteCount />);
    await settle();
    expect(screen.getByRole("heading", { name: "Voting closed" })).toBeTruthy();
    unmount();

    fetchMock.mockClear();
    answer = { ok: true, board: board({ closed: true, final: true }) };
    render(<LiveVoteCount />);
    await settle();
    // The final count lives with its week under "Winners so far"; drawing
    // it here too said the same numbers twice on one page.
    expect(screen.queryByRole("heading", { name: "Final count" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Community Favourite vote count" })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS * 2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops saying live at the close itself, not at the next refresh", async () => {
    answer = { ok: true, board: board({ closesAt: "2026-09-27T15:01:00.000Z" }) };
    render(<LiveVoteCount />);
    await settle();
    expect(screen.getByRole("heading", { name: "Live count" })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(62_000);
    });
    expect(screen.getByRole("heading", { name: "Voting closed" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears the board when the answer says there is no round", async () => {
    render(<LiveVoteCount />);
    await settle();
    answer = { ok: true, board: null };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS);
    });
    expect(document.body.textContent).not.toContain("Live count");
  });

  it("points a visitor who watched it go final at a reload, since the winner above is from page load", async () => {
    render(<LiveVoteCount />);
    await settle();
    answer = {
      ok: true,
      board: board({ closed: true, final: true, asOf: "2026-09-27T15:04:00.000Z" }),
    };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS);
    });
    expect(screen.getByRole("heading", { name: "Final count" })).toBeTruthy();
    const reload = screen.getByRole("link", { name: "Reload the page" });
    expect(reload.getAttribute("href")).toBe("/campaigns/monica-money-story/winners");
  });

  it("says the count can move both ways during review", async () => {
    render(<LiveVoteCount />);
    await settle();
    expect(document.body.textContent).toContain("Review can still add or set aside votes");
  });

  it("reads ranks out, so a tie is heard as joint", async () => {
    answer = {
      ok: true,
      board: board({
        nominees: [
          { nomineeId: "a", name: "Ada Obi", votes: 9 },
          { nomineeId: "b", name: "Ben Eze", votes: 9 },
        ],
      }),
    };
    render(<LiveVoteCount />);
    await settle();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/^Rank 1:Ada Obi/);
    expect(items[1]).toMatch(/^Rank 1:Ben Eze/);
  });

  it("says why nobody is marked ahead on a tie", async () => {
    answer = {
      ok: true,
      board: board({
        nominees: [
          { nomineeId: "a", name: "Ada Obi", votes: 9 },
          { nomineeId: "b", name: "Ben Eze", votes: 9 },
        ],
      }),
    };
    render(<LiveVoteCount />);
    await settle();
    expect(document.body.textContent).toContain("Level at the top.");
    expect(document.body.textContent).not.toContain("in the lead");
  });
});

describe("the integrity notice", () => {
  /*
   * Owner ask: a moving line on top of the count once fraud is acted on, so
   * voters see it is tracked, without detail. It shows only when votes in
   * the round were removed as fraud, reads once to a screen reader, and can
   * be paused (WCAG 2.2.2).
   */
  let answer: unknown;
  const fetchMock = vi.fn(async () => ({ json: async () => answer }));
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(SUNDAY);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

  it("stays away while nothing has been removed as fraud", async () => {
    answer = { ok: true, board: board() };
    render(<LiveVoteCount />);
    await settle();
    expect(document.body.textContent).not.toContain("suspicious votes");
    expect(screen.queryByRole("button", { name: "Pause the notice" })).toBeNull();
  });

  it("appears inside the count, under its heading and before the numbers, once votes were removed as fraud, and can be paused", async () => {
    answer = { ok: true, board: board({ flagged: true }) };
    render(<LiveVoteCount />);
    await settle();
    expect(document.body.textContent).toContain(
      "We spotted suspicious votes and removed them · Only verified, genuine votes count",
    );
    const pause = screen.getByRole("button", { name: "Pause the notice" });
    expect(pause.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pause);
    const play = screen.getByRole("button", { name: "Play the notice" });
    expect(play.getAttribute("aria-pressed")).toBe("true");
    // Part of the count it explains (the owner, 5 October): under the
    // "Live count" heading, before the first number.
    const notice = play.closest("div.rounded-full")!;
    const count = screen.getByRole("region", { name: "Community Favourite vote count" });
    expect(count.contains(notice)).toBe(true);
    const heading = within(count).getByRole("heading", { name: "Live count" });
    const firstRow = within(count).getAllByRole("listitem")[0];
    expect(heading.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says nothing about how many or whose", () => {
    expect(INTEGRITY_NOTICE.join(" ")).not.toMatch(/\d|@/);
  });
});

