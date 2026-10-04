/**
 * Deadlines in the reader's own time, and a countdown on the stage card.
 *
 * A creator read a noon close as midnight and missed stage 2. Two more ways
 * to make a deadline impossible to misread: the time where the reader is,
 * next to the Lagos time, and the live countdown /me had on the campaign
 * page's stage card too.
 */

import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalTime, yourTime } from "@/components/campaigns/local-time";

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

    // The close itself, with the Lagos time, is in the brief.
    fireEvent.click(screen.getByRole("button", { name: /Read the full brief for this week/ }));
    expect(screen.getByText("Closes:")).toBeTruthy();
    expect(screen.getByText(/Lagos time/)).toBeTruthy();
  });

  it("shows no countdown on a week that has closed", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ challenges: [week("closed", -2)] }) });
    const { MonicaStages } = await import("@/components/campaigns/monica-stages");
    render(<MonicaStages />);
    await waitFor(() => expect(screen.getByText("Money Moves")).toBeTruthy());
    expect(screen.queryByText(/left$/)).toBeNull();
  });
});
