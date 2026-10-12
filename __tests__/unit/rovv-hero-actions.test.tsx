/**
 * The ROVV page's hero buttons follow the visitor's clock: "Enter now" while
 * entries are open, "See the winners" once they are listed, and the results
 * time between the close and the announcement. A button sending people to a
 * closed form was the walk's finding.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RovvHeroActions } from "@/components/campaigns/rovv-hero-actions";
import { campaignBySlug } from "@/lib/campaigns";

const rovv = campaignBySlug("rovv")!;
afterEach(() => vi.useRealTimers());

const at = (iso: string) => vi.useFakeTimers({ toFake: ["Date"], now: new Date(iso) });

describe("the ROVV hero's buttons", () => {
  it("say Enter now while entries are open", () => {
    at("2026-10-15T12:00:00+01:00");
    render(<RovvHeroActions campaign={rovv} initial="open" winners={0} />);
    expect(screen.getByRole("link", { name: "Enter now" }).getAttribute("href")).toBe("#enter");
  });

  it("give the results time between the close and the announcement, and no Enter button", () => {
    at("2026-10-19T09:00:00+01:00");
    render(<RovvHeroActions campaign={rovv} initial="open" winners={0} />);
    expect(screen.queryByRole("link", { name: "Enter now" })).toBeNull();
    expect(screen.getByText(/Winners by 4 PM on Monday 19 October/)).toBeTruthy();
  });

  it("point to the winners once they are listed", () => {
    at("2026-10-19T17:00:00+01:00");
    render(<RovvHeroActions campaign={rovv} initial="closed" winners={20} />);
    expect(screen.getByRole("link", { name: "See the winners" }).getAttribute("href")).toBe("#winners");
  });
});
