/**
 * Tests for the campaign registry.
 *
 * Two things here are worth guarding rather than trusting. The reward pool is
 * the campaign's single most quoted number — it is on the landing page, in the
 * rules and in the sponsor deck — so it is derived from the prize breakdown
 * rather than typed, and this checks the derivation still lands on the figure
 * everyone has been told.
 *
 * The point ladder is the other. The brief states it two ways that disagree
 * arithmetically, and the reading we shipped decides leaderboard positions and
 * therefore who receives ₦1,500,000. It is written as totals precisely so the
 * ambiguity cannot creep back in as stacking deltas, and that is asserted here.
 */

import { describe, expect, it } from "vitest";
import {
  campaignBySlug,
  campaigns,
  liveCampaigns,
  monicaFinalPrizes,
  monicaFinalTotal,
  monicaPointLadder,
  monicaRewardPool,
  monicaSkills,
  monicaStages,
  monicaWeeklyPrizes,
  monicaWeeklyTotal,
} from "@/lib/campaigns";

/** The figure the campaign advertises everywhere. */
const ADVERTISED_POOL = 5_000_000;

describe("the reward pool", () => {
  it("adds up to the ₦5,000,000 the campaign advertises", () => {
    expect(monicaRewardPool).toBe(ADVERTISED_POOL);
  });

  it("splits as ₦1.6m weekly and ₦3.4m on the final leaderboard", () => {
    expect(monicaWeeklyTotal).toBe(1_600_000);
    expect(monicaFinalTotal).toBe(3_400_000);
  });

  it("matches the pool recorded on the campaign itself", () => {
    // Two places state the pool; they must not drift apart.
    expect(campaignBySlug("monica-money-story")?.rewardPool).toBe(
      monicaRewardPool,
    );
  });

  it("pays every award a positive amount at least once", () => {
    for (const prize of [...monicaWeeklyPrizes, ...monicaFinalPrizes]) {
      expect(prize.amount).toBeGreaterThan(0);
      expect(prize.count).toBeGreaterThan(0);
    }
  });

  it("never pays a later place more than an earlier one", () => {
    const amounts = monicaFinalPrizes.map((p) => p.amount);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });
});

describe("the point ladder", () => {
  it("is worth 100 per approved platform", () => {
    // The decision that settled the brief's contradiction. Section 5.1 said a
    // three-platform entry earns "up to 300"; the table in section 8 read as
    // 100 + 100 + 200 = 400. The campaign team confirmed 100 each.
    expect(monicaPointLadder.map((t) => t.points)).toEqual([100, 200, 300]);
  });

  it("stops at three platforms, because there are only three", () => {
    expect(monicaPointLadder).toHaveLength(3);
    expect(monicaPointLadder.map((t) => t.platforms)).toEqual([1, 2, 3]);
  });

  it("rises with each platform and never falls", () => {
    for (let i = 1; i < monicaPointLadder.length; i++) {
      expect(monicaPointLadder[i].points).toBeGreaterThan(
        monicaPointLadder[i - 1].points,
      );
    }
  });
});

describe("the campaign registry", () => {
  it("gives every campaign a unique slug", () => {
    expect(new Set(campaigns.map((c) => c.slug)).size).toBe(campaigns.length);
  });

  it("has exactly one live campaign, and it is Monica", () => {
    expect(liveCampaigns).toHaveLength(1);
    expect(liveCampaigns[0].slug).toBe("monica-money-story");
  });

  it("carries Rovv as coming soon, with no pool or dates to imply otherwise", () => {
    const rovv = campaignBySlug("rovv");
    expect(rovv?.status).toBe("coming-soon");
    expect(rovv?.rewardPool).toBeUndefined();
    expect(rovv?.startsAt).toBeUndefined();
  });

  it("returns undefined for a slug that does not exist", () => {
    expect(campaignBySlug("nope")).toBeUndefined();
  });
});

describe("the stages and skills", () => {
  it("runs four stages, numbered in order", () => {
    expect(monicaStages.map((s) => s.number)).toEqual([1, 2, 3, 4]);
  });

  it("covers the days continuously, with no gap or overlap", () => {
    // A gap would be a week where creators are told nothing is running.
    monicaStages.forEach((stage, i) => {
      const [from, to] = stage.days;
      expect(to).toBeGreaterThanOrEqual(from);
      if (i > 0) expect(from).toBe(monicaStages[i - 1].days[1] + 1);
    });
    expect(monicaStages[0].days[0]).toBe(1);
  });

  it("only names skills that exist", () => {
    const known = new Set(monicaSkills.map((s) => s.name));
    for (const stage of monicaStages) {
      for (const skill of stage.skills) expect(known).toContain(skill);
    }
  });

  it("tests all four skills in the final stage", () => {
    expect(monicaStages[3].skills).toHaveLength(monicaSkills.length);
  });
});
