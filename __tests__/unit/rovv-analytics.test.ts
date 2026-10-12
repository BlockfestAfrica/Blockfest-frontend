/**
 * Rovv's event names (ROVV_EVENTS in lib/sabilytics.ts), held to what the
 * DP maker's and Monica's are: prefixed so no Monica goal counts them, each
 * fired through the constant, and none carrying what someone typed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_EVENTS, ROVV_EVENT_NAMES, ROVV_EVENTS } from "@/lib/sabilytics";

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

describe("Rovv's events", () => {
  it("are prefixed, distinct, and never one of Monica's", () => {
    for (const name of ROVV_EVENT_NAMES) expect(name, name).toMatch(/^campaign_rovv_[a-z_]+$/);
    expect(new Set(ROVV_EVENT_NAMES).size).toBe(ROVV_EVENT_NAMES.length);
    const monica = new Set<string>(Object.values(CAMPAIGN_EVENTS));
    expect(ROVV_EVENT_NAMES.filter((n) => monica.has(n))).toEqual([]);
  });

  it("are each fired somewhere, through the constant", () => {
    const orphans = Object.keys(ROVV_EVENTS).filter((key) => !everything.includes(`ROVV_EVENTS.${key}`));
    expect(orphans).toEqual([]);
    expect(everything).not.toMatch(/track\(\s*["']campaign_rovv_[a-z_]+["']/);
  });

  it("never send a form value", () => {
    const form = readFileSync(join(ROOT, "components/campaigns/rovv-entry-form.tsx"), "utf8");
    const calls = [...form.matchAll(/track\(\s*ROVV_EVENTS\.\w+([^)]*)\)/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) expect(args, args).not.toMatch(/email|fullName|tiktok|referral|values|form\b/i);
  });
});
