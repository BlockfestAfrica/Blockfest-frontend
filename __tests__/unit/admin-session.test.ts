/**
 * requireAdmin and sameOrigin, executed rather than read.
 *
 * The guard assertions in admin-guard.test.ts match strings in the source. That
 * catches a file being deleted and almost nothing else: rewriting the catch in
 * requireAdmin to return {ok: true} leaves the literal "catch" present and
 * "return DENIED" still appearing three lines above, so every one of them keeps
 * passing while the guard is gone. netlify.toml makes this suite the thing
 * standing between an auth regression and production, so it has to be able to
 * fail.
 *
 * These call the real functions with the dependencies stubbed, and each case is
 * one way the world can be unhelpful: nobody signed in, Identity unreachable, a
 * user with no email, the database throwing, no matching row, a role we do not
 * recognise. Every one of them has to deny.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** What the stubbed getUser will return, per test. */
let identityResult: { impl: () => unknown } = { impl: () => null };

/** What the stubbed database will do, per test. */
let dbResult: { impl: () => unknown } = { impl: () => ({ rows: [] }) };

vi.mock("@netlify/identity", () => ({
  getUser: () => identityResult.impl(),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    execute: async () => dbResult.impl(),
  }),
}));

const ADMIN_ROW = { admin_id: "11111111-1111-1111-1111-111111111111", admin_role: "owner" };

async function callRequireAdmin() {
  const { requireAdmin } = await import("@/lib/admin/session");
  return requireAdmin();
}

beforeEach(() => {
  vi.resetModules();
  identityResult = { impl: () => ({ id: "acct-1", email: "a@example.com", roles: [] }) };
  dbResult = { impl: () => ({ rows: [ADMIN_ROW] }) };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireAdmin allows", () => {
  it("a known active admin", async () => {
    const result = await callRequireAdmin();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.admin.adminId).toBe(ADMIN_ROW.admin_id);
      expect(result.admin.role).toBe("owner");
      expect(result.admin.email).toBe("a@example.com");
    }
  });

  it("a reviewer as well as an owner", async () => {
    dbResult = { impl: () => ({ rows: [{ ...ADMIN_ROW, admin_role: "reviewer" }] }) };
    const result = await callRequireAdmin();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.admin.role).toBe("reviewer");
  });
});

describe("requireAdmin denies", () => {
  it("when nobody is signed in", async () => {
    identityResult = { impl: () => null };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when Identity throws", async () => {
    // An unknown runtime must never be read as permission.
    identityResult = {
      impl: () => {
        throw new Error("no request context");
      },
    };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when Identity resolves a user with no email", async () => {
    identityResult = { impl: () => ({ id: "acct-1", roles: [] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when Identity resolves a user with no id", async () => {
    identityResult = { impl: () => ({ email: "a@example.com", roles: [] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when the database throws", async () => {
    // A database that cannot answer is not permission to proceed.
    dbResult = {
      impl: () => {
        throw new Error("connection refused");
      },
    };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when no row matches, which is what revoked looks like", async () => {
    dbResult = { impl: () => ({ rows: [] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when the row carries a role we do not recognise", async () => {
    // A role added to the enum later must not be silently treated as an admin.
    dbResult = { impl: () => ({ rows: [{ ...ADMIN_ROW, admin_role: "auditor" }] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when the row has no admin id", async () => {
    dbResult = { impl: () => ({ rows: [{ admin_role: "owner" }] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when rows is missing entirely", async () => {
    dbResult = { impl: () => ({}) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });
});

describe("requireAdmin never reads the token's roles", () => {
  it("denies a user whose token claims admin but has no row", async () => {
    // The whole reason authorisation is not taken from the JWT: roles there are
    // stale for about an hour after a revocation.
    identityResult = {
      impl: () => ({ id: "acct-1", email: "a@example.com", roles: ["admin", "owner"] }),
    };
    dbResult = { impl: () => ({ rows: [] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("allows a user whose token claims nothing but has a row", async () => {
    identityResult = {
      impl: () => ({ id: "acct-1", email: "a@example.com", roles: [] }),
    };
    expect((await callRequireAdmin()).ok).toBe(true);
  });
});

describe("sameOrigin", () => {
  async function check(headers: Record<string, string>, url = "https://blockfestafrica.com/api/admin/review") {
    const { sameOrigin } = await import("@/lib/admin/request");
    const { NextRequest } = await import("next/server");
    return sameOrigin(new NextRequest(url, { headers }));
  }

  it("accepts a POST from the site itself", async () => {
    expect(
      await check({ origin: "https://blockfestafrica.com", host: "blockfestafrica.com" }),
    ).toBe(true);
  });

  it("accepts a deploy preview, which has its own host", async () => {
    expect(
      await check(
        {
          origin: "https://deploy-preview-99--x.netlify.app",
          host: "deploy-preview-99--x.netlify.app",
        },
        "https://deploy-preview-99--x.netlify.app/api/admin/review",
      ),
    ).toBe(true);
  });

  it("refuses a missing Origin, rather than assuming the best", async () => {
    expect(await check({ host: "blockfestafrica.com" })).toBe(false);
  });

  it("refuses another site entirely", async () => {
    expect(
      await check({ origin: "https://evil.example", host: "blockfestafrica.com" }),
    ).toBe(false);
  });

  it("refuses a host that merely ends with ours", async () => {
    expect(
      await check({
        origin: "https://blockfestafrica.com.evil.example",
        host: "blockfestafrica.com",
      }),
    ).toBe(false);
  });

  it("refuses a null Origin, which is what a sandboxed frame sends", async () => {
    expect(await check({ origin: "null", host: "blockfestafrica.com" })).toBe(false);
  });

  it("refuses an unparseable Origin", async () => {
    expect(await check({ origin: "::::", host: "blockfestafrica.com" })).toBe(false);
  });
});
