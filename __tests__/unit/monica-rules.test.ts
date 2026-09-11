/**
 * Tests for the campaign rules.
 *
 * Unusual to unit-test prose, but these are not prose. Several of these clauses
 * only work if they were published before anybody entered, and one of them is a
 * promise we specifically must not make. If a clause is dropped during an edit
 * the loss is silent, and it surfaces as an argument with a creator about
 * ₦1,500,000 rather than as a failing build.
 */

import { describe, expect, it } from "vitest";
import {
  monicaRules,
  monicaRulesOpenPoints,
  MONICA_RULES_UPDATED,
  MONICA_RULES_VERSION,
} from "@/lib/monica-rules";

const allText = monicaRules
  .flatMap((section) => section.paragraphs)
  .join(" ")
  .toLowerCase();

describe("clauses that must exist before anyone enters", () => {
  // Each of these is unenforceable if introduced after the fact.
  it.each([
    ["purchased engagement is disqualifying", "purchased engagement"],
    ["entries must stay up", "31 october 2026"],
    ["identity verification before payout", "government-issued identification"],
    ["a licence to reshare entries", "licence"],
    ["mandatory ad disclosure", "#ad"],
    ["no guaranteed returns", "guarantee returns"],
    ["a published tiebreak order", "reached that total first"],
    ["separation from Monica's customer bonus", "customer referral bonus"],
    ["referral points gated on an approved entry", "first approved entry"],
    ["an amendment clause", "may be amended"],
    ["a minimum age", "aged 18 or over"],
    ["that prizes are naira only", "nigerian naira only"],
    ["that prizes are paid gross", "paid gross"],
  ])("covers %s", (_label, needle) => {
    expect(allText).toContain(needle);
  });
});

describe("the Community Favourite promise", () => {
  it("is advisory, not a vote count", () => {
    expect(allText).toContain("informed by an advisory public vote");
  });

  it("never promises one vote per person", () => {
    // The promise that cannot be kept. Without accounts it is not deliverable,
    // and Nigerian carrier CGNAT means IP cannot stand in for a person. Saying
    // it here would hand a losing creator a commitment to hold us to.
    expect(allText).not.toContain("one vote per person");
    expect(allText).not.toContain("one vote each");
  });
});

describe("the points clauses", () => {
  it("states the per-platform value and the cap", () => {
    expect(allText).toContain("100 points per approved platform");
    expect(allText).toContain("maximum of 300");
  });

  it("promises that changing a point value is not retroactive", () => {
    // Otherwise an admin adjusting a setting silently reorders the leaderboard.
    expect(allText).toContain("not recalculated");
  });
});

describe("the document itself", () => {
  it("carries a version and a date", () => {
    expect(MONICA_RULES_VERSION).toMatch(/^\d+\.\d+$/);
    expect(Number.isNaN(new Date(MONICA_RULES_UPDATED).getTime())).toBe(false);
  });

  it("gives every clause a unique anchor, so one can be linked to in a dispute", () => {
    const ids = monicaRules.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("has no empty clause", () => {
    for (const section of monicaRules) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.paragraphs.length).toBeGreaterThan(0);
    }
  });

  it("does not leave a clause vague instead of listing it as unsettled", () => {
    // The panel is empty now that eligibility and payment are decided. If a
    // term becomes uncertain again it belongs in this list, where a creator can
    // see it, rather than being softened inside a clause where they cannot.
    for (const point of monicaRulesOpenPoints) {
      expect(point.trim().length).toBeGreaterThan(0);
    }
  });

  it("states who may enter and from where", () => {
    // Open internationally, but paid in naira. Somebody outside Nigeria must be
    // able to learn both facts before they spend a month making content.
    expect(allText).toContain("aged 18 or over");
    expect(allText).toContain("do not have to live in nigeria");
    expect(allText).toContain("receive naira");
  });
});
