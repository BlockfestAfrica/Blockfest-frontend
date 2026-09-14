/**
 * Reissuing a creator's link is recorded, and the token never is.
 *
 * The issue-closure verification found the fix for #139 shipped with no test
 * at all: nothing under __tests__ mentioned the route, so the audit insert
 * could be deleted in a refactor and 887 tests would stay green. This is that
 * guard. Source-level, because the route is a thin wrapper over two database
 * writes, and what must not regress is the presence and shape of the second
 * one, plus the absence of the token from every logging path.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "app/api/admin/creator-link/route.ts"),
  "utf8",
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the reissue route", () => {
  it("writes the audit row, with the action the log is queried by", () => {
    expect(CODE).toContain("auditLog");
    expect(CODE).toContain("creator.link_reissued");
  });

  it("records who acted and which enrolment was handed a session", () => {
    const insert = CODE.slice(CODE.indexOf("auditLog"));
    expect(insert).toContain("actorAdminId");
    expect(insert).toContain("entityId");
  });

  it("rotates the stored hash, which is what makes reissue also revocation", () => {
    expect(CODE).toContain("hashAccessToken");
    expect(CODE).toContain("accessTokenIssuedAt");
  });

  it("never logs the token", () => {
    // The token appears exactly where it must: minted, hashed, and put into
    // the email link. Any console call in the same file must not touch it.
    for (const match of CODE.matchAll(/console\.\w+\(([^;]*)\);/g)) {
      expect(match[1], match[0]).not.toContain("token");
    }
  });
});
