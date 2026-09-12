/**
 * Every ledger source a creator can see has a human label.
 *
 * The rules promise that bonuses and corrections are visible on a creator's own
 * page with their reason. A page that shows "manual_adjustment" has technically
 * kept that promise and has not really: it reads as something having gone
 * wrong, when it is usually a correction explained in the note beside it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POINT_SOURCE_LABELS, pointSourceLabel } from "@/lib/point-sources";

/** The enum, read from the migration rather than copied. */
function ledgerSources(): string[] {
  const sql = readFileSync(
    join(process.cwd(), "netlify/database/migrations/0000_init.sql"),
    "utf8",
  );
  const match = sql.match(/CREATE TYPE "public"\."ledger_source" AS ENUM\(([^)]+)\)/);
  if (!match) throw new Error("ledger_source enum not found");
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("point source labels", () => {
  it("covers every source the database can write", () => {
    const missing = ledgerSources().filter((s) => !POINT_SOURCE_LABELS[s]);
    expect(
      missing,
      `these can appear on a creator's page with no label:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("reads the real enum, so it cannot pass by finding nothing", () => {
    expect(ledgerSources().length).toBeGreaterThan(5);
    expect(ledgerSources()).toContain("manual_adjustment");
  });

  it("never shows a raw enum value for a source we know about", () => {
    for (const source of ledgerSources()) {
      expect(pointSourceLabel(source)).not.toMatch(/_/);
    }
  });

  it("falls back visibly rather than reassuringly", () => {
    // An unlabelled source is one nobody has thought about. Calling it "Bonus"
    // would hide that and could be wrong about the sign.
    expect(pointSourceLabel("something_new")).toBe("something new");
  });
});
