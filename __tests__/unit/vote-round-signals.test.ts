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
import {
  readMembers,
  withoutAllowlistedDomains,
} from "@/lib/admin/vote-round";

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

describe("a cluster carries the votes behind it", () => {
  // The defect this guards: the signal panels reported "eighteen votes from
  // one connection" and named no vote, while the only ids the console ever
  // rendered were the held ones. The domain cap holds nothing from gmail,
  // yahoo or outlook, so a reviewer judging a consumer-inbox cluster
  // fraudulent had nothing to press, and P0806 then refuses to announce
  // anyone but the leader those votes chose.

  it("parses members whether the driver hands back rows or a JSON string", () => {
    const rows = [
      { voteId: "11111111-1111-4111-8111-111111111111", email: "a@x.com", createdAt: "2026-09-27T09:00:00.000Z", held: false },
    ];
    expect(readMembers(rows)).toHaveLength(1);
    expect(readMembers(JSON.stringify(rows))).toHaveLength(1);
    expect(readMembers(JSON.stringify(rows))[0].voteId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("survives a malformed payload instead of throwing", () => {
    // A throw here would reproduce the exact failure being fixed: a
    // reviewer looking at a cluster they cannot act on.
    expect(readMembers("not json")).toEqual([]);
    expect(readMembers(null)).toEqual([]);
    expect(readMembers([{ email: "no id" }])).toEqual([]);
  });

  it("keeps every vote id, so the whole cluster is reachable", () => {
    const rows = Array.from({ length: 18 }, (_, i) => ({
      voteId: `11111111-1111-4111-8111-00000000${String(i).padStart(4, "0")}`,
      email: `farm${i}@gmail.com`,
      createdAt: "2026-09-27T09:00:00.000Z",
      held: false,
    }));
    const members = readMembers(rows);
    expect(members).toHaveLength(18);
    expect(new Set(members.map((m) => m.voteId)).size).toBe(18);
    // None of these were held, which is precisely why the old panel could
    // not reach them.
    expect(members.every((m) => !m.held)).toBe(true);
  });
});
