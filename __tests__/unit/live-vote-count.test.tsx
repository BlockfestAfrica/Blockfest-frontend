import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveVoteCount } from "@/components/campaigns/live-vote-count";
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
    expect(screen.getByText("50 votes")).toBeTruthy();
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

  it("stays up once voting closes, and stops asking once the result is final", async () => {
    answer = { ok: true, board: board({ closed: true }) };
    const { unmount } = render(<LiveVoteCount />);
    await settle();
    expect(screen.getByRole("heading", { name: "Voting closed" })).toBeTruthy();
    unmount();

    fetchMock.mockClear();
    answer = { ok: true, board: board({ closed: true, final: true }) };
    render(<LiveVoteCount />);
    await settle();
    expect(screen.getByRole("heading", { name: "Final count" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("Refreshes every");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS * 2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
