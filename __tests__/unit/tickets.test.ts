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
  formatNaira,
  lowestTicketPrice,
  TICKET_PLATFORM_URL,
  ticketGroups,
  ticketTiers,
  ticketUrl,
  tiersInGroup,
} from "@/lib/tickets";
import { VENUE_VIDEO } from "@/components/tickets/venue-video";

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
      "tickets-page-buidl-pass",
    );
    expect(content("Hero")).toBe("hero");
    expect(content("  Footer  CTA  ")).toBe("footer-cta");
  });

  it("never leaves a leading or trailing separator in utm_content", () => {
    for (const source of ["- Hero -", "!!!", "Tickets — Footer"]) {
      const content = new URL(ticketUrl(source)).searchParams.get(
        "utm_content",
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
      new URL(ticketUrl(s)).searchParams.get("utm_content"),
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

/**
 * Prices are the one thing on this site a visitor acts on with their money, and
 * the only copy that can be wrong in a way they discover at the card form.
 *
 * They were wrong: the early bird rate closed on 30 August 2026 and the tier
 * data kept its discounted prices, so for twelve days the site advertised
 * ₦7,500 for a pass the checkout charged ₦10,000 — a quarter under, across six
 * passes. Nothing caught it, because nothing here knew what the checkout
 * charges.
 *
 * These are those figures, read off the live Meetumo listing on 11 September
 * 2026. They are a fixture rather than a fetch — a unit test should not depend
 * on the network — so they go stale the moment prices move, which is the point:
 * this fails when the two disagree, and whichever side changed, someone has to
 * look.
 */
const CHECKOUT_PRICES: Record<string, number> = {
  "BUIDL PASS": 10_000,
  "BUIDL PLUS": 15_000,
  "BRIDGE PASS": 20_000,
  "BECOME PASS": 35_000,
  "BECOME PLUS": 40_000,
  "FOUNDER CIRCLE": 45_000,
  "CORPORATE CIRCLE": 150_000,
  "PRIME PASS": 150_000,
  "EXEC PASS": 160_000,
  "ALL ACCESS PASS": 185_000,
};

describe("pricing against the live checkout", () => {
  it("charges on the site what the checkout charges", () => {
    for (const tier of ticketTiers) {
      expect(
        CHECKOUT_PRICES[tier.name],
        `${tier.name} is not in the recorded checkout prices`,
      ).toBeDefined();
      expect(tier.price, `${tier.name} disagrees with checkout`).toBe(
        CHECKOUT_PRICES[tier.name],
      );
    }
  });

  it("covers every pass, so a new tier cannot slip past unpriced", () => {
    expect(Object.keys(CHECKOUT_PRICES).sort()).toEqual(
      ticketTiers.map((t) => t.name).sort(),
    );
  });
});

describe("the remaining discount", () => {
  it("strikes through a price only where one is genuinely discounted", () => {
    for (const tier of ticketTiers.filter((t) => t.standardPrice)) {
      expect(tier.price).toBeLessThan(tier.standardPrice as number);
    }
  });

  it("leaves CORPORATE CIRCLE as the only discounted pass", () => {
    // Its team rate is standing rather than dated, which is why it survived the
    // early bird closing. If a second pass gains a struck-through price, it is
    // either a new standing offer or a dated one that will need retiring — and
    // the copy around it says "team discount", so someone should check which.
    const discounted = ticketTiers.filter((t) => t.standardPrice);
    expect(discounted.map((t) => t.id)).toEqual(["corporate-circle"]);
  });

  it("no longer advertises an early bird anywhere in the tier data", () => {
    const json = JSON.stringify(ticketTiers).toLowerCase();
    expect(json).not.toContain("early bird");
    expect(json).not.toContain("25% off");
  });
});

describe("tier data", () => {
  it("prices every tier above zero, with the lowest exposed correctly", () => {
    for (const tier of ticketTiers) expect(tier.price).toBeGreaterThan(0);
    expect(lowestTicketPrice).toBe(
      Math.min(...ticketTiers.map((t) => t.price)),
    );
  });

  it("gives every tier a unique id and name", () => {
    expect(new Set(ticketTiers.map((t) => t.id)).size).toBe(ticketTiers.length);
    expect(new Set(ticketTiers.map((t) => t.name)).size).toBe(
      ticketTiers.length,
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
      ticketTiers.flatMap((t) => t.days.map((d) => d.date)),
    );
    expect([...dates].sort()).toEqual([
      "Fri 23 Oct",
      "Sat 24 Oct",
      "Thu 22 Oct",
    ]);
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

describe("the venue video", () => {
  it("gives uploadDate a full datetime with a timezone", () => {
    // Search Console rejected a bare "2026-08-14" here twice over: once for not
    // being a datetime, once for carrying no timezone. Schema.org accepts a
    // plain Date for many properties, which is what makes this easy to get
    // wrong, but Google reads VideoObject.uploadDate strictly.
    expect(VENUE_VIDEO.uploadedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/,
    );
  });

  it("names a real instant", () => {
    // The pattern above would accept 2026-13-45T99:99:99+01:00.
    const parsed = new Date(VENUE_VIDEO.uploadedAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it("was not uploaded in the future", () => {
    // An uploadDate ahead of now is a sign the value was typed rather than
    // taken from the file, and Google treats it as suspect.
    expect(new Date(VENUE_VIDEO.uploadedAt).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });
});
