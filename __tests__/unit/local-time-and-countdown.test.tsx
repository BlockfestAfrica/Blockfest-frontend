/**
 * Deadlines in the reader's own time, and a countdown on the stage card.
 *
 * A creator read a noon close as midnight and missed stage 2. Two more ways
 * to make a deadline impossible to misread: the time where the reader is,
 * next to the Lagos time, and the live countdown /me had on the campaign
 * page's stage card too.
 */

import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalTime, yourTime } from "@/components/campaigns/local-time";
import { TimeLeftLabel } from "@/components/campaigns/time-left-label";

const noon = "2026-10-10T11:00:00.000Z"; // Saturday 10 October, 12:00 Lagos

describe("the deadline in your own time", () => {
  it("adds nothing where the clock reads the same as Lagos", () => {
    expect(yourTime(noon, "Africa/Lagos")).toBeNull();
    // London is on summer time (UTC+1) until late October.
    expect(yourTime(noon, "Europe/London")).toBeNull();
  });

  it("says the time where you are, and the day when it is a different one", () => {
    expect(yourTime(noon, "Africa/Johannesburg")).toBe("13:00");
    expect(yourTime(noon, "Africa/Accra")).toBe("11:00");
    expect(yourTime(noon, "America/New_York")).toBe("07:00");
    expect(yourTime(noon, "Pacific/Auckland")).toBe("Sunday 00:00");
  });

  it("says nothing for a time it cannot read", () => {
    expect(yourTime("not a date", "Africa/Johannesburg")).toBeNull();
  });

  it("renders nothing on the server, so the first paint matches", () => {
    expect(renderToString(<LocalTime at={noon} />)).toBe("");
  });
});

describe("the stage card", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const week = (status: string, endsInHours: number) => ({
    weekNo: 3,
    status,
    title: "Money Moves",
    description: "The brief",
    basePoints: 100,
    startsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + endsInHours * 60 * 60 * 1000).toISOString(),
  });

  it("shows the open week's countdown on the card, without opening the brief", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ challenges: [week("active", 30)] }) });
    const { MonicaStages } = await import("@/components/campaigns/monica-stages");
    render(<MonicaStages />);
    await waitFor(() => expect(screen.getByText(/^1 day, \d+h left$/)).toBeTruthy());

    // The close itself is in the brief, in Lagos time and in yours. The
    // test runner's clock is UTC, an hour behind Lagos.
    fireEvent.click(screen.getByRole("button", { name: /Read the full brief for this week/ }));
    const closes = screen.getByText("Closes:").nextElementSibling!;
    await waitFor(() => expect(closes.textContent).toMatch(/, Lagos time \(.+ your time\)\.$/));
  });

  it("shows no countdown on a week an admin has closed, even before its date", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ challenges: [week("closed", 30)] }) });
    const { MonicaStages } = await import("@/components/campaigns/monica-stages");
    render(<MonicaStages />);
    await waitFor(() => expect(screen.getByText("Money Moves")).toBeTruthy());
    expect(screen.queryByText(/left$/)).toBeNull();
    expect(screen.getAllByText("Closed")).toHaveLength(1);
  });

  it("turns the card to Closed at the close, without a reload", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ challenges: [week("active", 1.2 / 3600)] }), // 1.2s
    });
    const { MonicaStages } = await import("@/components/campaigns/monica-stages");
    render(<MonicaStages />);
    await waitFor(() => expect(screen.getByText("Open now")).toBeTruthy());
    await waitFor(() => expect(screen.queryByText("Open now")).toBeNull(), { timeout: 4000 });
    expect(screen.getAllByText("Closed")).toHaveLength(1);
    expect(screen.queryByText(/left$/)).toBeNull();
  });
});

describe("the countdown's ticks", () => {
  const close = "2026-10-10T11:00:00.000Z";
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (iso: string) => act(() => vi.setSystemTime(new Date(iso)));
  const advanceTo = (iso: string) =>
    act(() => vi.advanceTimersByTime(new Date(iso).getTime() - Date.now()));

  it("says Closed at the close, not up to a minute later", () => {
    vi.useFakeTimers();
    at("2026-10-10T10:58:30.500Z");
    render(<TimeLeftLabel endsAt={close} initial="2m left" />);
    advanceTo("2026-10-10T10:59:59.000Z");
    expect(screen.getByText("Under a minute left")).toBeTruthy();
    advanceTo("2026-10-10T11:00:00.010Z");
    expect(screen.getByText("Closed")).toBeTruthy();
  });

  it("drops to the next minute when the close's minute turns, not the page's", () => {
    vi.useFakeTimers();
    at("2026-10-10T10:57:59.000Z");
    render(<TimeLeftLabel endsAt={close} initial="2m left" />);
    expect(screen.getByText("2m left")).toBeTruthy();
    // Counted from the mount, "1m left" would have stayed until 10:59:59.
    advanceTo("2026-10-10T10:59:30.000Z");
    expect(screen.getByText("Under a minute left")).toBeTruthy();
  });
});
