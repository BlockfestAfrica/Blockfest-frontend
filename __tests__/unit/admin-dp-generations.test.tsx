/**
 * The overview's "DPs generated" card (components/admin/dp-generations.tsx):
 * the figures as the team reads them, labelled the way the page labels its
 * roles and buttons.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CHANNEL_LABEL, DpGenerationsCard } from "@/components/admin/dp-generations";
import { DP_CHANNELS } from "@/app/getdp/lib/count";

afterEach(cleanup);

const dps = {
  total: 12450,
  today: 37,
  byRole: [
    { name: "attendee", count: 11000 },
    { name: "speaker", count: 1450 },
  ],
  byChannel: [
    { name: "whatsapp", count: 6000 },
    { name: "status", count: 4000 },
    { name: "download", count: 2450 },
  ],
};

describe("the DPs generated card", () => {
  it("shows all time and today, then by role and by channel in the page's own words", () => {
    render(<DpGenerationsCard dps={dps} />);
    const card = screen.getByRole("region", { name: "DPs generated" });
    expect(within(card).getByText("12,450")).toBeTruthy();
    expect(within(card).getByText("37")).toBeTruthy();
    expect(within(card).getByText("since midnight in Lagos")).toBeTruthy();
    const roles = within(card).getByRole("table", { name: "Role" });
    expect(within(roles).getAllByRole("row").map((r) => r.textContent)).toEqual([
      "RoleDPs",
      "Attending11,000",
      "Speaking1,450",
    ]);
    const channels = within(card).getByRole("table", { name: "Shared or saved by" });
    expect(within(channels).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([
      "WhatsApp6,000",
      "WhatsApp Status4,000",
      "Download PNG2,450",
    ]);
    expect(within(card).getByText(/No name or photo is recorded/)).toBeTruthy();
    expect(within(card).queryByRole("link", { name: /Sabilytics/ })).toBeNull();
  });

  it("says none yet rather than two empty tables, and links Sabilytics when there is a link", () => {
    render(<DpGenerationsCard dps={{ total: 0, today: 0, byRole: [], byChannel: [] }} sabilyticsUrl="https://sabilytics.example/share" />);
    expect(screen.getByText("None yet.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("link", { name: /Open Sabilytics/ }).getAttribute("href")).toBe(
      "https://sabilytics.example/share",
    );
  });

  it("has a label for every channel the page counts", () => {
    for (const c of DP_CHANNELS) expect(CHANNEL_LABEL[c], c).toBeTruthy();
  });
});
