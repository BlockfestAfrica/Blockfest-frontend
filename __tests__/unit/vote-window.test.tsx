import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoteRoundPanel } from "@/components/admin/vote-round-panel";
import { WinnersPanel } from "@/components/admin/winners-panel";

/*
 * A vote that runs past midnight.
 *
 * Admin feedback: the form had one "voting day" with an open and a close time
 * on it, so a vote could only ever run within one day, and the plan is 48
 * hours. These drive the real form: a date and a time on each side, a 48-hour
 * default, the length said back, a close before the open refused before the
 * round trip, and both dates in what is sent and in the question before it.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const CANDIDATES = [
  { entryId: "e1", name: "Ada Obi", points: 300, approvedPlatforms: 2 },
  { entryId: "e2", name: "Ben Eze", points: 250, approvedPlatforms: 1 },
  { entryId: "e3", name: "Cy Ade", points: 200, approvedPlatforms: 1 },
];

function renderForm() {
  render(<VoteRoundPanel weekNo={1} round={null} candidates={CANDIDATES} tally={null} frozen />);
  // Each label carries the points too, so match the name within it.
  for (const c of CANDIDATES) fireEvent.click(screen.getByLabelText(new RegExp(c.name)));
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const set = (id: string, value: string) => fireEvent.change(field(id), { target: { value } });
const openButton = () => screen.getByRole("button", { name: "Open the vote" });

describe("the vote window", () => {
  it("has a date and a time for the open and for the close, 48 hours apart by default", () => {
    renderForm();
    for (const id of ["opens-day", "opens-time", "closes-day", "closes-time"]) {
      expect(field(id), id).toBeTruthy();
    }
    expect(field("opens-day").type).toBe("date");
    expect(field("closes-day").type).toBe("date");
    expect(screen.getByText(/^Runs 48 hours,/)).toBeTruthy();
  });

  it("says the length back as the dates change", () => {
    renderForm();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-28");
    set("closes-time", "18:00");
    expect(
      screen.getByText("Runs 34 hours, Sunday 27 September 08:00 to Monday 28 September 18:00."),
    ).toBeTruthy();
  });

  it("refuses a close at or before the open, before anything is sent", () => {
    renderForm();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-27");
    set("closes-time", "08:00");
    expect(screen.getByText("The vote has to close after it opens.")).toBeTruthy();
    expect(openButton()).toHaveProperty("disabled", true);

    set("closes-day", "2026-09-26");
    set("closes-time", "20:00");
    expect(openButton()).toHaveProperty("disabled", true);
  });

  it("asks with both dates and the length, and sends both dates", async () => {
    renderForm();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-29");
    set("closes-time", "08:00");
    fireEvent.click(openButton());
    const question = screen.getByRole("alertdialog").textContent ?? "";
    expect(question).toContain(
      "from Sunday 27 September 08:00 to Tuesday 29 September 08:00 Lagos time (48 hours)?",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, open the vote" }));
    });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      action: "open",
      opensAt: "2026-09-27T08:00:00+01:00",
      closesAt: "2026-09-29T08:00:00+01:00",
    });
  });
});

describe("a vote that outlives its week", () => {
  it("keeps the winners screen on a week whose vote is not finished", () => {
    const page = readFileSync(join(process.cwd(), "app/admin/(console)/winners/page.tsx"), "utf8");
    expect(page).toMatch(/unfinishedVoteWeek\(admin\.admin, current\)/);
    expect(page).toMatch(/searchParams/);
    expect(page).toMatch(/canRecord=\{weekNo === current\}/);
  });

  it("does not offer to record a past week's standings, which the server refuses", () => {
    const props = {
      weekNo: 1,
      creatorCandidates: [],
      favouriteCandidates: [],
      excludedCount: 0,
      picked: [],
      vote: null,
    };
    const { unmount } = render(<WinnersPanel {...props} frozen canRecord={false} />);
    expect(screen.queryByRole("button", { name: /Record/ })).toBeNull();
    expect(screen.getByText(/Week 1 is over, so its standings stay as they were recorded/)).toBeTruthy();
    unmount();

    render(<WinnersPanel {...props} frozen={false} />);
    expect(screen.getByRole("button", { name: /Record the standings/ })).toBeTruthy();
  });
});
