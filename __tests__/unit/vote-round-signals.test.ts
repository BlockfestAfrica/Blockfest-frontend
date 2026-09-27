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
  groupByVoteDomain,
  readMembers,
  withDomainState,
  withoutAllowlistedDomains,
  type ClusterMember,
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

describe("domain clusters group by registrable domain", () => {
  /*
   * A farm spread over a.oemails.com, b.oemails.com and oemails.com used to
   * show as three small clusters, while the cap (0069) and "Remove all"
   * judge them as one domain. The row's number has to be the number the
   * removal takes, and the reviewer has to see which hosts made it.
   */
  const member = (email: string, at: string): ClusterMember => ({
    voteId: `id-${email}`,
    email,
    createdAt: new Date(at),
    held: false,
  });
  const cluster = (domain: string, ...members: ClusterMember[]) => ({
    domain,
    votes: members.length,
    members,
  });

  it("folds subdomains into one cluster, with every vote and every host", () => {
    const grouped = groupByVoteDomain([
      cluster(
        "a.oemails.com",
        member("p@a.oemails.com", "2026-09-27T19:05:00Z"),
        member("q@a.oemails.com", "2026-09-27T19:01:00Z"),
      ),
      cluster("acme.ng", member("ada@acme.ng", "2026-09-27T10:00:00Z")),
      cluster(
        "oemails.com",
        member("r@oemails.com", "2026-09-27T19:03:00Z"),
        member("s@oemails.com", "2026-09-27T19:04:00Z"),
        member("t@oemails.com", "2026-09-27T19:00:00Z"),
      ),
      cluster("b.oemails.com", member("u@b.oemails.com", "2026-09-27T19:02:00Z")),
    ]);

    expect(grouped.map((c) => [c.domain, c.votes])).toEqual([
      ["oemails.com", 6],
      ["acme.ng", 1],
    ]);
    const [farm] = grouped;
    expect(farm.hosts).toEqual([
      { host: "oemails.com", votes: 3 },
      { host: "a.oemails.com", votes: 2 },
      { host: "b.oemails.com", votes: 1 },
    ]);
    // Every vote id is still reachable, in the order they arrived.
    expect(farm.members.map((m) => m.email)).toEqual([
      "t@oemails.com",
      "q@a.oemails.com",
      "u@b.oemails.com",
      "r@oemails.com",
      "s@oemails.com",
      "p@a.oemails.com",
    ]);
  });

  it("keys a campus on the campus and leaves an ordinary domain as it was", () => {
    const grouped = groupByVoteDomain([
      cluster("live.unilag.edu.ng", member("a@live.unilag.edu.ng", "2026-09-27T10:00:00Z")),
      cluster("unilag.edu.ng", member("b@unilag.edu.ng", "2026-09-27T11:00:00Z")),
      cluster("cu.edu.ng", member("c@cu.edu.ng", "2026-09-27T12:00:00Z")),
    ]);
    expect(grouped.map((c) => c.domain)).toEqual(["unilag.edu.ng", "cu.edu.ng"]);
    expect(grouped[1].hosts).toEqual([{ host: "cu.edu.ng", votes: 1 }]);
  });

  it("sorts by size, then by name, like the query it replaces", () => {
    const grouped = groupByVoteDomain([
      cluster("zeta.ng", member("a@zeta.ng", "2026-09-27T10:00:00Z")),
      cluster("alpha.ng", member("b@alpha.ng", "2026-09-27T10:00:00Z")),
      cluster(
        "mid.ng",
        member("c@mid.ng", "2026-09-27T10:00:00Z"),
        member("d@mid.ng", "2026-09-27T10:00:00Z"),
      ),
    ]);
    expect(grouped.map((c) => c.domain)).toEqual(["mid.ng", "alpha.ng", "zeta.ng"]);
  });

  it("still lets the allowlist drop a consumer provider after grouping", () => {
    const grouped = groupByVoteDomain([
      cluster("gmail.com", member("a@gmail.com", "2026-09-27T10:00:00Z")),
      cluster("farm.test", member("b@farm.test", "2026-09-27T10:00:00Z")),
    ]);
    expect(withoutAllowlistedDomains(grouped, ["gmail.com"]).map((c) => c.domain)).toEqual([
      "farm.test",
    ]);
  });
});

describe("what a cluster can have done to it", () => {
  /*
   * The console offers Block and Remove all from a cluster, and both land on
   * the whole registrable domain. A wrong answer here is quiet in either
   * direction: a gmail-shaped provider offered for blocking (the route and
   * the engine would still refuse), or a farm with no Block to press.
   */
  const clusters = [
    { domain: "oemails.com" },
    { domain: "a.farm.test" },
    { domain: "ymail.com" },
    { domain: "unilag.edu.ng" },
    { domain: "com.ng" },
    { domain: "xoemails.com" },
  ];

  it("marks a cluster covered by an active block, its subdomains included, and says whose", () => {
    const state = withDomainState(clusters, [
      { domain: "oemails.com", source: "admin" },
      { domain: "farm.test", source: "auto" },
    ]);
    expect(state.map((c) => [c.domain, c.block])).toEqual([
      ["oemails.com", "admin"],
      ["a.farm.test", "auto"],
      ["ymail.com", null],
      ["unilag.edu.ng", null],
      ["com.ng", null],
      // Only the same letters, not a subdomain.
      ["xoemails.com", null],
    ]);
  });

  it("lets an owner's block win the pill when both cover a cluster", () => {
    const [state] = withDomainState([{ domain: "oemails.com" }], [
      { domain: "oemails.com", source: "auto" },
      { domain: "oemails.com", source: "admin" },
    ]);
    expect(state.block).toBe("admin");
  });

  it("offers a block on a real domain, never on a never-block provider or a bare suffix", () => {
    const state = withDomainState(clusters, []);
    expect(Object.fromEntries(state.map((c) => [c.domain, c.blockable]))).toEqual({
      "oemails.com": true,
      "a.farm.test": true,
      "ymail.com": false,
      "unilag.edu.ng": true,
      "com.ng": false,
      "xoemails.com": true,
    });
  });

  it("flags a school or government domain for the dialogs' warning", () => {
    const state = withDomainState(clusters, []);
    expect(state.filter((c) => c.protectedDomain).map((c) => c.domain)).toEqual(["unilag.edu.ng"]);
  });

  it("adds up the machine-made count across a domain's hosts", () => {
    const at = new Date("2026-09-27T19:00:00Z");
    const m = (email: string): ClusterMember => ({ voteId: email, email, createdAt: at, held: false });
    const [farm] = groupByVoteDomain([
      { domain: "oemails.com", votes: 2, members: [m("a@oemails.com"), m("b@oemails.com")], machineMade: 2 },
      { domain: "a.oemails.com", votes: 1, members: [m("c@a.oemails.com")], machineMade: 1 },
      { domain: "b.oemails.com", votes: 1, members: [m("d@b.oemails.com")] },
    ]);
    expect(farm.machineMade).toBe(3);
    expect(farm.votes).toBe(4);
  });
});
