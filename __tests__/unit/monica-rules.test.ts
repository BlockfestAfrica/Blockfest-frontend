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
  .flatMap((section) => [
    ...section.paragraphs,
    ...(section.table ? section.table.rows.flat() : []),
  ])
  .join(" ")
  .toLowerCase();

describe("clauses that must exist before anyone enters", () => {
  // Each of these is unenforceable if introduced after the fact.
  it.each([
    ["purchased engagement is disqualifying", "purchased engagement"],
    ["entries must stay up", "31 october 2026"],
    ["identity verification before payout", "government-issued identification"],
    ["a licence to reshare entries", "licence"],
    ["no guaranteed returns", "guarantee returns"],
    ["a published tiebreak order", "reached that total first"],
    ["separation from Monica's customer bonus", "customer referral bonus"],
    ["referral points gated on an approved entry", "first approved entry"],
    ["an amendment clause", "may be amended"],
    ["a minimum age", "aged 18 or over"],
    ["the payout currency", "nigerian naira or the equivalent"],
    ["that prizes are paid gross", "paid gross"],
  ])("covers %s", (_label, needle) => {
    expect(allText).toContain(needle);
  });
});

describe("the Community Favourite promise", () => {
  it("is decided by the vote, with a manipulation carve-out", () => {
    // Changed from advisory on 14 Sep 2026 by the campaign team. The
    // carve-out is the part that must survive every edit: without it a
    // manipulated vote is a promise we have to honour.
    expect(allText).toContain("decided by public vote");
    expect(allText).toContain("manipulated");
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
    expect(allText).toContain("100 points for the first approved platform");
    expect(allText).toContain("50 for each platform after it");
    expect(allText).toContain("maximum of 200");
  });

  it("promises that changing a point value is not retroactive", () => {
    // Otherwise an admin adjusting a setting silently reorders the leaderboard.
    // Asserted on the promise rather than on one phrasing of it: the clause was
    // reworded when the take-back cases were added below, and a test pinned to
    // the old words failed while the guarantee was intact.
    expect(allText).toMatch(
      /does not recalculate points already awarded|points already awarded are not recalculated/i,
    );
  });

  /**
   * The referral payout was set in the database and published nowhere.
   *
   * These rules are the governing document and their version is recorded
   * against every registration, so a payout that is not here is not a term
   * anybody agreed to.
   */
  it("publishes what a referral is actually worth", () => {
    expect(allText).toContain("50 points");
  });

  /**
   * The clause used to say an adjustment never changes a total already earned.
   * Clause 8 forfeits points on a deleted entry, and every manual point source
   * carries a negative floor so a mistake can be corrected. The document
   * promised something two other parts of the same system are built to do.
   */
  it("admits the two cases where points can be taken back", () => {
    expect(allText).toMatch(/taken back/i);
    expect(allText, "and says a correction is recorded with its reason").toMatch(
      /correction is recorded/i,
    );
  });

  /**
   * engagement_milestone is seeded in point_rules and offered in the admin UI,
   * and appeared in no published list. An admin could award points for a reason
   * nobody entering had been told about.
   */
  it("names every bonus an admin can actually award", () => {
    for (const bonus of [
      "exceptional",
      "audience milestone",
      "featured",
      "collaborations",
      "wildcard",
    ]) {
      expect(allText.toLowerCase()).toContain(bonus);
    }
  });

  it("publishes the ceiling on a bonus, since the database enforces one", () => {
    // The prose sentence was cut on 14 Sep 2026; the points table carries
    // the caps now. The database enforces them either way, and an enforced
    // number that is published nowhere is how disputes start.
    expect(allText).toContain("capped at 300");
    expect(allText).toContain("capped at 600");
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
  });
});
