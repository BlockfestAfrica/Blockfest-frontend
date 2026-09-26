import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeaderboardTable } from "@/components/campaigns/leaderboard-table";
import type { LeaderboardRow } from "@/lib/leaderboard-row";

/*
 * What a visitor can read off the board beside each name, rendered for real:
 * stages as "N of 4", movement since the last recorded standings, weekly
 * prizes, platforms, and their own row marked when they are signed in.
 */

const row = (over: Partial<LeaderboardRow> & Pick<LeaderboardRow, "rank" | "name">): LeaderboardRow => ({
  points: 100,
  stages: 1,
  previousRank: null,
  badges: [],
  platforms: [],
  ...over,
});

const ROWS: LeaderboardRow[] = [
  row({ rank: 1, name: "Ada Obi", points: 350, stages: 2, previousRank: 3, platforms: ["x", "instagram", "tiktok"] }),
  row({ rank: 2, name: "Ben Eze", points: 300, previousRank: 1, badges: [{ weekNo: 1, category: "creator_of_week" }], platforms: ["x"] }),
  row({ rank: 3, name: "Cy Ade", points: 200, previousRank: null }),
  row({ rank: 4, name: "Dee Uba", points: 150, previousRank: 4 }),
];

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, me: null }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const signedInAs = (me: { rank: number; name: string; points: number } | null) =>
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, me }) });

async function renderBoard(rows = ROWS, movementSince: number | null = 1) {
  await act(async () => {
    render(<LeaderboardTable rows={rows} movementSince={movementSince} stageCount={4} />);
  });
}

const rowOf = (name: string) => screen.getByText(name).closest("tr")!;

describe("stages", () => {
  it("heads the column Stages and reads each as N of 4", async () => {
    await renderBoard();
    expect(screen.getByRole("button", { name: /Stages/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Entries/ })).toBeNull();
    expect(rowOf("Ada Obi").textContent).toContain("2 of 4");
    expect(rowOf("Ben Eze").textContent).toContain("1 of 4");
  });

  it("sorts by stages, most first", async () => {
    await renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /Stages/ }));
    const names = screen.getAllByRole("row").slice(1).map((r) => r.querySelector("td:nth-child(2) span")?.textContent);
    expect(names[0]).toBe("Ada Obi");
  });
});

describe("movement", () => {
  it("shows places gained and lost, in words as well as arrows", async () => {
    await renderBoard();
    expect(rowOf("Ada Obi").textContent).toContain("▲2");
    expect(within(rowOf("Ada Obi")).getByText(/Up 2 since the Stage 1 standings/)).toBeTruthy();
    expect(rowOf("Ben Eze").textContent).toContain("▼1");
    expect(within(rowOf("Ben Eze")).getByText(/Down 1 since the Stage 1 standings/)).toBeTruthy();
  });

  it("marks a creator who was not on the last standings as new", async () => {
    await renderBoard();
    expect(within(rowOf("Cy Ade")).getByText(/New/)).toBeTruthy();
  });

  it("draws nothing for no change", async () => {
    await renderBoard();
    expect(rowOf("Dee Uba").textContent).not.toMatch(/[▲▼]|New/);
  });

  it("shows no movement at all when there is nothing to measure from", async () => {
    await renderBoard(ROWS, null);
    const body = screen.getAllByRole("row").slice(1).map((r) => r.textContent).join(" ");
    expect(body).not.toMatch(/[▲▼]|New|since the Stage/);
  });
});

describe("prizes and platforms", () => {
  it("names a weekly prize beside the winner", async () => {
    await renderBoard();
    expect(rowOf("Ben Eze").textContent).toContain("Creator of the Week, Stage 1");
    expect(rowOf("Ada Obi").textContent).not.toContain("Creator of the Week");
  });

  it("says in words which platforms a creator was approved on", async () => {
    await renderBoard();
    expect(within(rowOf("Ada Obi")).getByText("Approved on X, Instagram and TikTok")).toBeTruthy();
    expect(within(rowOf("Ben Eze")).getByText("Approved on X")).toBeTruthy();
    expect(within(rowOf("Cy Ade")).queryByText(/Approved on/)).toBeNull();
  });
});

describe("the signed-in creator", () => {
  it("asks who is looking without caching the answer", async () => {
    await renderBoard();
    expect(fetchMock).toHaveBeenCalledWith("/api/campaigns/monica/standing", { cache: "no-store" });
  });

  it("marks their row when rank, name and points all agree", async () => {
    signedInAs({ rank: 2, name: "Ben Eze", points: 300 });
    await renderBoard();
    expect(rowOf("Ben Eze").getAttribute("aria-current")).toBe("true");
    expect(within(rowOf("Ben Eze")).getByText("You")).toBeTruthy();
    expect(rowOf("Ada Obi").getAttribute("aria-current")).toBeNull();
  });

  it("marks nobody when the name does not match the rank, as on a stale board", async () => {
    signedInAs({ rank: 2, name: "Somebody Else", points: 300 });
    await renderBoard();
    expect(screen.queryByText("You")).toBeNull();
    expect(document.querySelector('[aria-current="true"]')).toBeNull();
  });

  it("never marks a stranger who shares their name and held their rank on an older board", async () => {
    // Names are not unique. On a board minutes old, another "Same Name" can
    // sit at the rank the live answer gives; their points give them away.
    const rows = [
      row({ rank: 1, name: "Same Name", points: 880 }),
      row({ rank: 2, name: "Other", points: 500 }),
      row({ rank: 3, name: "Same Name", points: 120 }),
    ];
    signedInAs({ rank: 1, name: "Same Name", points: 130 });
    await renderBoard(rows, null);
    expect(document.querySelector('[aria-current="true"]')).toBeNull();
    expect(screen.getByText(/You are at/).textContent).toMatch(/reload the page to see yourself/);
  });

  it("marks nobody when signed out", async () => {
    await renderBoard();
    expect(screen.queryByText("You")).toBeNull();
  });

  it("keeps their own row in view when it is below the ten on show", async () => {
    const many = Array.from({ length: 30 }, (_, i) => row({ rank: i + 1, name: `Creator ${i + 1}`, points: 1000 - i }));
    signedInAs({ rank: 25, name: "Creator 25", points: 976 });
    await renderBoard(many, null);
    expect(screen.getByText("Your place")).toBeTruthy();
    expect(rowOf("Creator 25").getAttribute("aria-current")).toBe("true");
    // The other rows below the ten stay hidden.
    expect(screen.queryByText("Creator 24")).toBeNull();
  });

  it("says where they are when their row is not on this board", async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => row({ rank: i + 1, name: `Creator ${i + 1}` }));
    signedInAs({ rank: 143, name: "Far Down", points: 20 });
    await renderBoard(hundred, null);
    const note = screen.getByText(/You are at/).textContent;
    expect(note).toMatch(/#143\. This board shows the top 100\./);
    expect(note).not.toMatch(/reload/);
  });

  it("ignores an answer that is not the shape it expects", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, me: { rank: "2", name: 7, points: 300 } }),
    });
    await renderBoard();
    expect(screen.queryByText("You")).toBeNull();
    fetchMock.mockRejectedValue(new Error("offline"));
    await renderBoard();
    expect(screen.queryByText("You")).toBeNull();
  });
});

describe("on a phone", () => {
  it("keeps Points on screen: no forced minimum width, and stages under the name", async () => {
    await renderBoard();
    const table = screen.getByRole("table");
    // The 30rem minimum pushed Points behind a sideways scroll on phones.
    expect(table.className).not.toMatch(/(^|\s)min-w-/);
    expect(table.className).toMatch(/sm:min-w-\[30rem\]/);
    const stagesHeader = screen.getByRole("button", { name: /Stages/ }).closest("th")!;
    expect(stagesHeader.className).toMatch(/hidden sm:table-cell/);
    // Header and body agree, so the columns never shift.
    for (const tr of screen.getAllByRole("row").slice(1)) {
      const cell = tr.querySelector("td:nth-child(3)")!;
      expect(cell.className).toMatch(/(^|\s)hidden(\s|$)/);
      expect(cell.className).toMatch(/sm:table-cell/);
    }
    expect(rowOf("Ada Obi").textContent).toContain("2 of 4 stages");
    // Under the name on a phone only: a wide screen shows it once, in its column.
    const underName = within(rowOf("Ada Obi")).getByText("2 of 4 stages");
    expect(underName.className).toMatch(/sm:hidden/);
    expect(underName.parentElement!.className).not.toMatch(/sm:hidden/);
    const plain = within(rowOf("Dee Uba")).getByText("1 of 4 stages").parentElement!;
    expect(plain.className, "a row with nothing else under the name adds no gap on a wide screen").toMatch(/sm:hidden/);
  });

  it("goes back to rank when the screen narrows past the Stages column", async () => {
    let wide = true;
    const listeners: Array<() => void> = [];
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return wide;
      },
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: () => {},
    }));
    await renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /Stages/ }));
    expect(screen.getByRole("button", { name: /Stages/ }).closest("th")!.getAttribute("aria-sort")).toBe(
      "descending",
    );
    wide = false;
    await act(async () => listeners.forEach((fn) => fn()));
    expect(screen.getByRole("button", { name: /#/ }).closest("th")!.getAttribute("aria-sort")).toBe("ascending");
  });

  it("still lists platforms on a browser without Intl.ListFormat", async () => {
    // Removed to stand in for Safari before 14.1.
    const intl = Intl as { ListFormat?: unknown };
    const original = intl.ListFormat;
    delete intl.ListFormat;
    try {
      await renderBoard();
      expect(within(rowOf("Ada Obi")).getByText("Approved on X, Instagram and TikTok")).toBeTruthy();
    } finally {
      intl.ListFormat = original;
    }
  });
});

describe("the page", () => {
  const page = readFileSync(
    join(process.cwd(), "app/campaigns/monica-money-story/leaderboard/page.tsx"),
    "utf8",
  );

  it("stays one cached page for everybody: no cookie, no headers", () => {
    // Reading who is looking here would render it per visitor and put the
    // ranking query on every view; the table asks the standing route instead.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    expect(code).not.toMatch(/\bcookies\(|\bheaders\(|currentCreator|force-dynamic/);
    expect(code).toMatch(/export const revalidate = 60;/);
  });
});
