/**
 * Tests for the campaign registry.
 *
 * Two things here are worth guarding rather than trusting. The reward pool is
 * the campaign's single most quoted number. It is on the landing page, in the
 * rules and in the sponsor deck, so it is derived from the prize breakdown
 * rather than typed, and this checks the derivation still lands on the figure
 * everyone has been told.
 *
 * The point ladder is the other. The brief states it two ways that disagree
 * arithmetically, and the reading we shipped decides leaderboard positions and
 * therefore who receives ₦1,500,000. It is written as totals precisely so the
 * ambiguity cannot creep back in as stacking deltas, and that is asserted here.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MONICA_CAMPAIGN_DAYS,
  MONICA_FIRST_LEADERBOARD,
  campaignBySlug,
  campaignRun,
  campaigns,
  currentWeekNo,
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
  it("pays 100 for the first platform and 50 for each one after", () => {
    // The second posting is not the same work as the first: the creator writes
    // one piece and repurposes it, which is what the campaign asks for and why
    // it stopped paying three times over. The earlier ladder was linear at 100
    // each, which the team changed deliberately.
    expect(monicaPointLadder.map((t) => t.points)).toEqual([100, 150, 200]);
  });

  it("keeps the database and the page telling the same story", () => {
    // The ladder here is a total; point_rules holds the increment above
    // base_points, which is how recompute_entry_award reads it. Two
    // representations of one rule drift the moment only one is edited.
    const base = monicaPointLadder[0].points;
    const increments = monicaPointLadder.slice(1).map((t) => t.points - base);
    expect(increments, "what 0030_platform_ladder.sql writes").toEqual([50, 100]);
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
  it("runs five stages, numbered in order", () => {
    expect(monicaStages.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
  });

  /**
   * The gap between stages is deliberate and exactly one day.
   *
   * Stages run Monday to Saturday; the Sunday between them is when the week's
   * entries are reviewed and the weekly winners announced, so a stage never
   * ends on the day its own result is published. The earlier shape ran the
   * stages end to end, which is why the site said Saturday in one place and
   * Sunday in another.
   *
   * Asserted as exactly one day, not merely "no overlap", so a stage cannot
   * quietly swallow the Sunday or leave a second day nobody can submit in.
   */
  it("covers the calendar with no gap and no overlap", () => {
    // The displayed spans became full weeks on 14 Sep 2026, marketing's
    // framing: the week belongs to its stage, winners day included. The
    // submission windows are still Monday to Saturday in the database;
    // these spans only describe the stage.
    monicaStages.forEach((stage, i) => {
      const [from, to] = stage.days;
      expect(to).toBeGreaterThanOrEqual(from);
      if (i > 0) expect(from).toBe(monicaStages[i - 1].days[1] + 1);
    });
    expect(monicaStages[0].days[0]).toBe(1);
  });

  it("is a full week per stage, with the shorter final run", () => {
    for (const stage of monicaStages.slice(0, -1)) {
      expect(stage.days[1] - stage.days[0], stage.name).toBe(6);
    }
    const last = monicaStages.at(-1)!;
    expect(last.days[1] - last.days[0], last.name).toBe(5);
  });

  it("ends on the last day of the campaign", () => {
    expect(monicaStages.at(-1)!.days[1]).toBe(MONICA_CAMPAIGN_DAYS);
  });

  it("only names skills that exist", () => {
    const known = new Set(monicaSkills.map((s) => s.name));
    for (const stage of monicaStages) {
      for (const skill of stage.skills) expect(known).toContain(skill);
    }
  });

  it("tests all four skills in the final stage", () => {
    expect(monicaStages.at(-1)!.skills).toHaveLength(monicaSkills.length);
  });
});

describe("the campaign length", () => {
  const campaign = campaignBySlug("monica-money-story")!;
  const dayOne = new Date(campaign.startsAt!);
  const lastDay = new Date(campaign.endsAt!);

  /** The calendar date a given campaign day falls on. */
  const dateOfDay = (day: number) =>
    new Date(dayOne.getTime() + (day - 1) * 24 * 60 * 60 * 1000);

  it("runs for the number of days the stages account for", () => {
    // The brief said 30 days while giving dates that do not make 30. If the
    // stages and the constant ever disagree again, a creator reading "day 33"
    // on the page and counting the calendar will find the gap before we do.
    const finalStage = monicaStages[monicaStages.length - 1];
    expect(finalStage.days[1]).toBe(MONICA_CAMPAIGN_DAYS);
  });

  it("fits inside the published dates", () => {
    // Day 33 is 16 October and the campaign closes on the 17th, which is a
    // Saturday: the day standings are published every week. The last day must
    // never fall past the end date.
    expect(dateOfDay(MONICA_CAMPAIGN_DAYS).getTime()).toBeLessThanOrEqual(
      lastDay.getTime(),
    );
  });

  it("starts on day one and not before", () => {
    expect(dateOfDay(1).toDateString()).toBe(dayOne.toDateString());
  });
});

describe("campaignRun", () => {
  it("writes the span with the year stated once", () => {
    // Repeating the year reads as two dates rather than one span.
    const run = campaignRun(campaignBySlug("monica-money-story")!);
    expect(run).toBe("14 September \u2013 17 October 2026");
  });

  it("uses an en dash, never an em dash", () => {
    const run = campaignRun(campaignBySlug("monica-money-story")!)!;
    expect(run).toContain("\u2013");
    expect(run).not.toContain("\u2014");
  });

  it("returns nothing for a campaign with no dates", () => {
    expect(campaignRun(campaignBySlug("rovv")!)).toBeNull();
  });
});

/**
 * What the site says about the leaderboard must match what it does.
 *
 * Three places described it and none agreed: two said standings are published
 * weekly, one said weekly winners land on Sundays, and the page itself is ISR
 * with revalidate 60, so the board moves within a minute of any approval.
 *
 * That reads as a broken promise in both directions. A creator who checks on
 * the Tuesday finds a full board the site said would not exist until Saturday,
 * and a creator told the board updates weekly has no reason to come back after
 * an approval on a weekday, which is the whole feedback loop the campaign runs
 * on.
 */
describe("what we publish about the leaderboard", () => {
  const copy = [
    readFileSync(join(process.cwd(), "lib/campaigns.ts"), "utf8"),
    readFileSync(
      join(process.cwd(), "app/campaigns/monica-money-story/leaderboard/page.tsx"),
      "utf8",
    ),
    readFileSync(
      join(process.cwd(), "app/campaigns/monica-money-story/register/page.tsx"),
      "utf8",
    ),
  ].join("\n");

  it("never claims the board itself updates weekly", () => {
    /*
     * Forbidding a phrasing is not forbidding a claim.
     *
     * The first version of this banned "standings are published" and the page
     * said "Standings are announced ... and every Saturday after that", which
     * is the same promise in different words. The fix that was supposed to
     * remove it silently no-opped on an indentation mismatch, the test passed,
     * and the contradiction shipped anyway.
     *
     * So this matches on what the sentence CLAIMS: standings, weekly. Winners
     * being weekly is correct and must still be sayable, hence the negative
     * lookahead.
     */
    expect(copy).not.toMatch(/leaderboard updates every (Saturday|week)/i);
    expect(copy).not.toMatch(/standings are published/i);
    expect(
      copy,
      "standings must never be described as a weekly event; winners are",
    ).not.toMatch(/standings are announced/i);
  });

  it("puts weekly winners on one day, and it is Sunday", () => {
    /*
     * Stages now run Monday to Saturday with the Sunday between them kept
     * clear, so the week's entries are reviewed and its winners announced on
     * the day no stage is running. A stage never ends on the day its own
     * result is published.
     *
     * The copy said both at once before that, in adjacent sentences of the
     * same paragraph, which is what this guard exists to stop happening again.
     */
    expect(copy).not.toMatch(/announced every Saturday/i);
    expect(copy).toMatch(/announced on Sundays/);
  });

  it("opens the first standings on a Sunday too", () => {
    // Naming a Saturday here while promising Sunday announcements is the same
    // contradiction wearing a date.
    expect(MONICA_FIRST_LEADERBOARD).toMatch(/^Sunday /);
  });

  it("keeps the leaderboard page genuinely live", () => {
    // If somebody later makes this weekly, the copy above becomes wrong again.
    // This fails first and points at that.
    const page = readFileSync(
      join(process.cwd(), "app/campaigns/monica-money-story/leaderboard/page.tsx"),
      "utf8",
    );
    const match = page.match(/export const revalidate = (\d+)/);
    expect(match, "the board declares a revalidate window").toBeTruthy();
    expect(Number(match![1]), "still refreshed in minutes, not days").toBeLessThanOrEqual(300);
  });
});

/**
 * Which week the winners screen should be pointed at.
 *
 * Derived from the campaign start rather than stored, so it cannot drift from
 * the challenge windows, which are the same four Mondays.
 */
describe("the current campaign week", () => {
  const on = (iso: string) => currentWeekNo(new Date(iso));

  it("is week 1 on launch day", () => {
    expect(on("2026-09-14T09:00:00+01:00")).toBe(1);
  });

  it("turns over on the Monday, with the challenge window", () => {
    expect(on("2026-09-20T23:00:00+01:00"), "still week 1 on Sunday").toBe(1);
    expect(on("2026-09-21T00:30:00+01:00"), "week 2 once Monday lands").toBe(2);
  });

  it("reaches week 4 in the last stage", () => {
    expect(on("2026-10-05T10:00:00+01:00")).toBe(4);
  });

  it("clamps before the campaign opens rather than answering zero", () => {
    // The team rehearses on the Saturday before. Pointing the screen at week 0
    // would offer a week no constraint accepts.
    expect(on("2026-09-12T20:00:00+01:00")).toBe(1);
  });

  it("clamps after it closes rather than offering a sixth stage", () => {
    expect(on("2026-10-20T10:00:00+01:00")).toBe(5);
  });
});
