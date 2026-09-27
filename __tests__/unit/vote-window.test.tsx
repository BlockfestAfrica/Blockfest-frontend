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
/** Saturday 26 September, 11:00 Lagos: the Sunday vote is still ahead. */
const SATURDAY = new Date("2026-09-26T10:00:00Z");
beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SATURDAY);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const CANDIDATES = [
  { entryId: "e1", name: "Ada Obi", points: 300, approvedPlatforms: 2 },
  { entryId: "e2", name: "Ben Eze", points: 250, approvedPlatforms: 1 },
  { entryId: "e3", name: "Cy Ade", points: 200, approvedPlatforms: 1 },
];

function renderForm(frozen = true) {
  render(<VoteRoundPanel weekNo={1} round={null} candidates={CANDIDATES} tally={null} frozen={frozen} />);
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

describe("safeguards", () => {
  it("will not open a vote that runs into the next stage until the week is recorded", () => {
    renderForm(false);
    set("opens-day", "2026-09-27");
    set("closes-day", "2026-09-29");
    expect(screen.getByText(/Record the week 1 standings first\. This vote closes after stage 2 starts/)).toBeTruthy();
    expect(openButton()).toHaveProperty("disabled", true);
    // Inside the week, the freeze is not needed to open.
    set("closes-day", "2026-09-27");
    set("closes-time", "20:00");
    expect(openButton()).toHaveProperty("disabled", false);
  });

  it("counts the length from now when the open time has already passed", () => {
    vi.setSystemTime(new Date("2026-09-27T18:00:00Z")); // Sunday 19:00 Lagos
    renderForm();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-29");
    set("closes-time", "08:00");
    expect(
      screen.getByText(
        "The open time has passed, so it opens as soon as you confirm and runs about 37 hours, to Tuesday 29 September 08:00.",
      ),
    ).toBeTruthy();
    fireEvent.click(openButton());
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "from now to Tuesday 29 September 08:00 Lagos time (about 37 hours)?",
    );
  });

  it("refuses a close that has already passed, and says one minute properly", () => {
    renderForm();
    set("opens-day", "2026-09-25");
    set("closes-day", "2026-09-25");
    expect(screen.getByText("The close time has already passed.")).toBeTruthy();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-27");
    set("closes-time", "08:01");
    expect(screen.getByText(/^Runs 1 minute,/)).toBeTruthy();
  });

  it("offers no vote to open for a week that is over", () => {
    render(<VoteRoundPanel weekNo={1} round={null} candidates={CANDIDATES} tally={null} frozen isPast />);
    expect(screen.queryByRole("button", { name: "Open the vote" })).toBeNull();
    expect(screen.getByText(/Week 1.s vote was never opened, and the week is over/)).toBeTruthy();
  });

  it("stops offering to tell the creators once voting has closed", () => {
    const round = (closesAt: string) => ({
      roundId: "r1",
      status: "open" as const,
      opensAt: "2026-09-26T07:00:00Z",
      closesAt,
      reviewedAt: null,
    });
    const { unmount } = render(
      <VoteRoundPanel weekNo={1} round={round("2026-09-26T09:00:00Z")} candidates={CANDIDATES} tally={null} frozen />,
    );
    expect(screen.queryByRole("button", { name: "Tell the creators" })).toBeNull();
    unmount();
    render(<VoteRoundPanel weekNo={1} round={round("2026-09-29T07:00:00Z")} candidates={CANDIDATES} tally={null} frozen />);
    expect(screen.getByRole("button", { name: "Tell the creators" })).toBeTruthy();
    // The route refuses it too, for a page left open past the close.
    const route = readFileSync(join(process.cwd(), "app/api/admin/announce-vote/route.ts"), "utf8");
    expect(route).toMatch(/closes_at\)\.getTime\(\) <= Date\.now\(\)/);
  });
});

describe("the voter's receipt", () => {
  it("names the round's close instead of a day", async () => {
    const { voteReceiptEmail } = await import("@/lib/email/templates");
    const mail = voteReceiptEmail({
      to: "v@example.test",
      nomineeName: "Ada Obi",
      weekNo: 1,
      closesAtLagos: "Tuesday, 29 September, 8:00 am",
    });
    expect(mail.text).toContain("Voting closes Tuesday, 29 September, 8:00 am, Lagos time");
    expect(mail.text).not.toMatch(/Sunday evening/);
    expect(mail.html).not.toMatch(/Sunday evening/);
  });
});

describe("telling nominees apart", () => {
  it("shows the handle behind each approved post under the name, linking to the post", () => {
    render(
      <VoteRoundPanel
        weekNo={1}
        round={null}
        frozen
        tally={null}
        candidates={[
          {
            entryId: "e1",
            name: "Ada Obi",
            points: 300,
            approvedPlatforms: 2,
            posts: [
              { platform: "x", handle: "adaobi", url: "https://x.com/adaobi/status/123" },
              { platform: "instagram", handle: null, url: "https://www.instagram.com/p/ABC/" },
            ],
          },
          { entryId: "e2", name: "Ada Obi", points: 250, approvedPlatforms: 1, posts: [
            { platform: "tiktok", handle: "ada.creates", url: "https://www.tiktok.com/@ada.creates/video/9" },
          ] },
        ]}
      />,
    );
    const x = screen.getByRole("link", { name: /X @adaobi/ });
    expect(x.getAttribute("href")).toBe("https://x.com/adaobi/status/123");
    expect(x.getAttribute("target")).toBe("_blank");
    // No registered handle on that platform: the post is still named and linked.
    expect(screen.getByRole("link", { name: /Instagram post/ })).toBeTruthy();
    // Two nominees with one name are now told apart by their accounts.
    expect(screen.getByRole("link", { name: /TikTok @ada\.creates/ })).toBeTruthy();
    // The name still ticks the box.
    fireEvent.click(screen.getAllByText("Ada Obi")[0]);
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked).toBe(true);
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
