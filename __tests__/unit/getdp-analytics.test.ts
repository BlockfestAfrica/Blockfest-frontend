/**
 * The DP maker's event names (GETDP_EVENTS in lib/sabilytics.ts), held to
 * what the campaign's are held to in campaign-analytics.test.ts: a name that
 * does not match its goal in the Sabilytics dashboard, or an event nobody
 * fires, records nothing and says so to nobody.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GETDP_EVENT_NAMES, GETDP_EVENTS } from "@/lib/sabilytics";

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

describe("the DP maker's events", () => {
  it("are prefixed, distinct, and the three the dashboard is set up with", () => {
    for (const name of GETDP_EVENT_NAMES) expect(name, name).toMatch(/^getdp_[a-z_]+$/);
    expect(new Set(GETDP_EVENT_NAMES).size).toBe(GETDP_EVENT_NAMES.length);
    expect(GETDP_EVENTS).toEqual({
      made: "getdp_dp_made",
      generated: "getdp_dp_generated",
      shareClicked: "getdp_share_clicked",
    });
  });

  it("are each fired somewhere, through the constant", () => {
    const orphans = Object.keys(GETDP_EVENTS).filter((key) => !everything.includes(`GETDP_EVENTS.${key}`));
    expect(orphans).toEqual([]);
    expect(everything).not.toMatch(/track\(\s*["']getdp_[a-z_]+["']/);
  });
});
