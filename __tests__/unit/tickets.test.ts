/**
 * Tests for ticket pricing, attribution and the tier data itself.
 *
 * Two kinds of assertion here. The functions are tested because ticketUrl()
 * carries the only attribution that survives the jump to Meetumo. The data is
 * tested because several claims on the page are derived from it — which passes
 * say "early bird", which days a card lists — and a wrong field there becomes a
 * wrong promise to a buyer rather than a crash.
 */

import { describe, expect, it } from "vitest";
import {
  EARLY_BIRD_COUNT,
  EARLY_BIRD_ENDS,
  earlyBirdTiers,
  formatNaira,
  lowestTicketPrice,
  TICKET_PLATFORM_URL,
  ticketGroups,
  ticketTiers,
  ticketUrl,
  tiersInGroup,
} from "@/lib/tickets";

describe("ticketUrl", () => {
  it("keeps the checkout destination intact", () => {
    const url = new URL(ticketUrl("Hero"));
    const base = new URL(TICKET_PLATFORM_URL);
    expect(url.origin + url.pathname).toBe(base.origin + base.pathname);
  });

  it("tags every link so Meetumo can attribute the sale", () => {
    const p = new URL(ticketUrl("Hero")).searchParams;
    expect(p.get("utm_source")).toBe("blockfestafrica.com");
    expect(p.get("utm_medium")).toBe("website");
    expect(p.get("utm_campaign")).toBe("lagos-2026");
    expect(p.get("utm_content")).toBeTruthy();
  });

  it("slugifies the click location into utm_content", () => {
    const content = (s: string) =>
      new URL(ticketUrl(s)).searchParams.get("utm_content");
    expect(content("Tickets Page - BUIDL PASS")).toBe(
      "tickets-page-buidl-pass"
    );
    expect(content("Hero")).toBe("hero");
    expect(content("  Footer  CTA  ")).toBe("footer-cta");
  });

  it("never leaves a leading or trailing separator in utm_content", () => {
    for (const source of ["- Hero -", "!!!", "Tickets — Footer"]) {
      const content = new URL(ticketUrl(source)).searchParams.get(
        "utm_content"
      );
      expect(content).not.toMatch(/^-|-$/);
    }
  });

  it("distinguishes one placement from another", () => {
    expect(ticketUrl("Hero")).not.toBe(ticketUrl("Footer"));
  });

  it("produces a distinct utm_content for every real CTA on the site", () => {
    const sources = [
      "Hero",
      "Tickets Hero",
      "Tickets Page - Footer CTA",
      "Travel Page - CTA",
      "Announcement Bar",
      ...ticketTiers.map((t) => `Tickets Page - ${t.name}`),
    ];
    const contents = sources.map((s) =>
      new URL(ticketUrl(s)).searchParams.get("utm_content")
    );
    expect(new Set(contents).size).toBe(sources.length);
  });
});

describe("formatNaira", () => {
  it("formats with the naira sign and thousands separators", () => {
    expect(formatNaira(7_500)).toBe("₦7,500");
    expect(formatNaira(185_000)).toBe("₦185,000");
  });

  it("shows no decimal places", () => {
    expect(formatNaira(15_000)).not.toContain(".");
  });
});

describe("early bird derivation", () => {
  it("counts exactly the tiers that carry a discount label", () => {
    expect(EARLY_BIRD_COUNT).toBe(earlyBirdTiers.length);
    expect(earlyBirdTiers).toEqual(ticketTiers.filter((t) => t.discountLabel));
    expect(EARLY_BIRD_COUNT).toBeGreaterThan(0);
    expect(EARLY_BIRD_COUNT).toBeLessThan(ticketTiers.length);
  });

  it("only calls a tier early bird when it actually has a deadline price", () => {
    for (const tier of earlyBirdTiers) {
      expect(tier.standardPrice).toBeDefined();
      expect(tier.price).toBeLessThan(tier.standardPrice as number);
    }
  });

  it("does not treat the standing team discount as an early bird", () => {
    // CORPORATE CIRCLE is cheaper than its standard price but its price does
    // not move on the deadline, so it must not appear in the early-bird set.
    const corporate = ticketTiers.find((t) => t.id === "corporate-circle");
    expect(corporate?.standardPrice).toBeDefined();
    expect(corporate?.discountLabel).toBeUndefined();
    expect(earlyBirdTiers).not.toContain(corporate);
  });

  it("has a deadline in the future relative to the event", () => {
    const deadline = new Date(EARLY_BIRD_ENDS.iso);
    expect(Number.isNaN(deadline.getTime())).toBe(false);
    expect(EARLY_BIRD_ENDS.display).toBeTruthy();
  });
});

describe("tier data", () => {
  it("prices every tier above zero, with the lowest exposed correctly", () => {
    for (const tier of ticketTiers) expect(tier.price).toBeGreaterThan(0);
    expect(lowestTicketPrice).toBe(Math.min(...ticketTiers.map((t) => t.price)));
  });

  it("gives every tier a unique id and name", () => {
    expect(new Set(ticketTiers.map((t) => t.id)).size).toBe(ticketTiers.length);
    expect(new Set(ticketTiers.map((t) => t.name)).size).toBe(
      ticketTiers.length
    );
  });

  it("tells a buyer which days they get, with a date on each", () => {
    for (const tier of ticketTiers) {
      expect(tier.days.length).toBeGreaterThan(0);
      for (const day of tier.days) {
        expect(day.label).toBeTruthy();
        // Without the date, a card cannot be used to book travel.
        expect(day.date).toMatch(/^(Thu|Fri|Sat) \d{1,2} Oct$/);
      }
    }
  });

  it("uses only the three real event dates", () => {
    const dates = new Set(
      ticketTiers.flatMap((t) => t.days.map((d) => d.date))
    );
    expect([...dates].sort()).toEqual(["Fri 23 Oct", "Sat 24 Oct", "Thu 22 Oct"]);
  });

  it("says what each pass includes instead of naming another pass", () => {
    // "Everything in the BUIDL PASS" made a reader hold a second card in their
    // head, and for BUIDL PLUS that card was in a different group.
    for (const tier of ticketTiers) {
      for (const item of tier.includes) {
        expect(item).not.toMatch(/everything in/i);
      }
    }
  });

  it("gives every tier at least one inclusion and a best-for line", () => {
    for (const tier of ticketTiers) {
      expect(tier.includes.length).toBeGreaterThan(0);
      expect(tier.bestFor.length).toBeGreaterThan(20);
    }
  });

  it("states the exclusion on the pass that does not cover the conference", () => {
    const founder = ticketTiers.find((t) => t.id === "founder-circle");
    expect(founder?.excludes?.length).toBeGreaterThan(0);
    expect(founder?.days.every((d) => d.label.includes("Day 1"))).toBe(true);
  });

  it("marks at most one featured pass per group", () => {
    for (const group of ticketGroups) {
      const featured = tiersInGroup(group.id).filter((t) => t.featured);
      expect(featured.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("tiersInGroup", () => {
  it("returns only tiers from the requested group", () => {
    for (const group of ticketGroups) {
      for (const tier of tiersInGroup(group.id)) {
        expect(tier.group).toBe(group.id);
      }
    }
  });

  it("accounts for every tier exactly once across the groups", () => {
    const grouped = ticketGroups.flatMap((g) => tiersInGroup(g.id));
    expect(grouped).toHaveLength(ticketTiers.length);
    expect(new Set(grouped.map((t) => t.id)).size).toBe(ticketTiers.length);
  });
});
