/**
 * Tests for the one pure piece of the admin round reads.
 *
 * The cluster queries live in SQL and are exercised against the engine, but
 * the allowlist exclusion happens in TypeScript, after the rows come back.
 * If it silently excluded nothing, every gmail vote would land on the
 * reviewer's screen as a cluster; if it excluded too much, a real farm on a
 * lookalike domain would vanish from the sweep. Both failures are quiet,
 * which is what earns the helper a test.
 */

import { describe, expect, it } from "vitest";
import { withoutAllowlistedDomains } from "@/lib/admin/vote-round";

const CLUSTERS = [
  { domain: "gmail.com", votes: 214 },
  { domain: "acme-corp.ng", votes: 41 },
  { domain: "yahoo.com", votes: 66 },
  { domain: "mailbucket.example", votes: 12 },
];

describe("withoutAllowlistedDomains", () => {
  it("drops the exempt consumer providers and keeps the rest, in order", () => {
    const kept = withoutAllowlistedDomains(CLUSTERS, [
      "gmail.com",
      "yahoo.com",
    ]);
    expect(kept).toEqual([
      { domain: "acme-corp.ng", votes: 41 },
      { domain: "mailbucket.example", votes: 12 },
    ]);
  });

  it("matches domains case-insensitively on both sides", () => {
    // The canonical email is already lowercased by the engine's callers, but
    // the allowlist is hand-typed, and a capital letter in either place must
    // not turn gmail into a suspicious cluster.
    const kept = withoutAllowlistedDomains(
      [{ domain: "Gmail.COM", votes: 3 }],
      ["gmail.com"],
    );
    expect(kept).toEqual([]);
  });

  it("accepts a Set, which is what lib/campaign-vote actually exports", () => {
    const kept = withoutAllowlistedDomains(
      CLUSTERS,
      new Set(["gmail.com", "yahoo.com"]),
    );
    expect(kept.map((c) => c.domain)).toEqual([
      "acme-corp.ng",
      "mailbucket.example",
    ]);
  });

  it("leaves everything when nothing is allowlisted", () => {
    expect(withoutAllowlistedDomains(CLUSTERS, [])).toEqual(CLUSTERS);
  });
});
