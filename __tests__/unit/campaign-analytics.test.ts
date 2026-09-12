/**
 * The campaign funnel's event names.
 *
 * Funnel data for the first two weeks cannot be reconstructed afterwards: a
 * page that was not instrumented on the day simply has no history. So these
 * assertions are about the two ways that happens quietly — an event nobody
 * fires, and a name that does not match the goal configured in the dashboard.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_EVENT_NAMES, CAMPAIGN_EVENTS } from "@/lib/sabilytics";

const ROOT = process.cwd();

function filesUnder(dirs: string[]): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name)) found.push(next);
    }
  };
  dirs.forEach(walk);
  return found;
}

const everything = filesUnder(["app", "components"])
  .map((f) => readFileSync(join(ROOT, f), "utf8"))
  .join("\n");

describe("the taxonomy", () => {
  it("prefixes every name, so the campaign does not blend into the ticket funnel", () => {
    // /campaigns shares this property with tickets. Without a prefix a spike in
    // "register_started" is unattributable to either.
    for (const name of CAMPAIGN_EVENT_NAMES) {
      expect(name, name).toMatch(/^campaign_monica_/);
    }
  });

  it("has no duplicate names, which would merge two steps into one goal", () => {
    expect(new Set(CAMPAIGN_EVENT_NAMES).size).toBe(
      CAMPAIGN_EVENT_NAMES.length,
    );
  });

  it("covers the funnel the brief asks for", () => {
    for (const key of [
      "viewed",
      "registerStarted",
      "registerCompleted",
      "referralLinkUsed",
      "submissionStarted",
      "leaderboardViewed",
      "packViewed",
      "rulesViewed",
    ] as const) {
      expect(CAMPAIGN_EVENTS[key], key).toBeTruthy();
    }
  });
});

describe("every event is actually fired", () => {
  /**
   * A goal configured in the dashboard with nothing firing it records nothing,
   * and the failure is silent: the number is zero and reads as a finding.
   */
  it("has a call site for each one", () => {
    const orphans = (
      Object.entries(CAMPAIGN_EVENTS) as [string, string][]
    ).filter(([key]) => !everything.includes(`CAMPAIGN_EVENTS.${key}`));

    expect(
      orphans.map(([key, name]) => `${key} (${name})`),
      "these are defined and nothing fires them, so their goal would sit at zero",
    ).toEqual([]);
  });

  it("fires them through the constant, never as a loose string", () => {
    // A literal is a typo waiting to happen, and a typo is a goal that silently
    // records nothing rather than an error anybody sees.
    const loose = everything.match(/track\(\s*["']campaign_[a-z_]+["']/g) ?? [];
    expect(
      loose,
      `these bypass the taxonomy:\n${loose.join("\n")}`,
    ).toEqual([]);
  });
});

describe("what the dashboard needs configuring with", () => {
  it("lists every name, so the goals can be created from it", () => {
    // Printed rather than asserted: this is the list somebody copies into
    // Sabilytics, and it is here so it cannot drift from the code.
    expect(CAMPAIGN_EVENT_NAMES.length).toBeGreaterThanOrEqual(8);
    expect(CAMPAIGN_EVENT_NAMES).toContain("campaign_monica_viewed");
    expect(CAMPAIGN_EVENT_NAMES).toContain("campaign_monica_register_completed");
  });
});
