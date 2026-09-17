/**
 * requireAdmin, executed rather than read.
 *
 * The guard assertions in admin-guard.test.ts match strings in the source,
 * which catches a file being deleted and almost nothing else: rewriting the
 * catch to return {ok: true} leaves the literal "catch" present. netlify.toml
 * makes this suite the thing between an auth regression and production, so it
 * has to be able to fail.
 *
 * The credential is now a server session cookie (#138), not the Identity JWT,
 * so these stub next/headers cookies() and the database. Each case is one way
 * the world can be unhelpful: no cookie, a malformed cookie, the database
 * throwing, no row (expired or revoked), a role we do not recognise. Every one
 * has to deny.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_COOKIE = "dAyeo84EfDrV3h3E7NVYQx5MlMNqrA_5nrMofYmz3o8";

let cookieValue: string | undefined = VALID_COOKIE;
let dbResult: { impl: () => unknown } = { impl: () => ({ rows: [] }) };
const executeSpy = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "__Host-admin_session" && cookieValue !== undefined
        ? { value: cookieValue }
        : undefined,
  }),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    execute: async (...args: unknown[]) => {
      executeSpy(...args);
      return dbResult.impl();
    },
  }),
}));

const ROW = {
  admin_id: "11111111-1111-1111-1111-111111111111",
  admin_role: "owner",
  admin_email: "a@example.com",
  expires_at: "2026-09-14T12:00:00.000Z",
};

async function callRequireAdmin() {
  const { requireAdmin } = await import("@/lib/admin/session");
  return requireAdmin();
}

beforeEach(() => {
  vi.resetModules();
  executeSpy.mockClear();
  cookieValue = VALID_COOKIE;
  dbResult = { impl: () => ({ rows: [ROW] }) };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireAdmin allows", () => {
  it("a live session, exposing role, email and expiry", async () => {
    const result = await callRequireAdmin();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.admin.adminId).toBe(ROW.admin_id);
      expect(result.admin.role).toBe("owner");
      expect(result.admin.email).toBe("a@example.com");
      expect(result.admin.sessionExpiresAt.toISOString()).toBe(ROW.expires_at);
    }
  });

  it("a reviewer as well as an owner", async () => {
    dbResult = { impl: () => ({ rows: [{ ...ROW, admin_role: "reviewer" }] }) };
    const result = await callRequireAdmin();
    if (result.ok) expect(result.admin.role).toBe("reviewer");
    else throw new Error("should have allowed");
  });
});

describe("requireAdmin denies", () => {
  it("when there is no session cookie", async () => {
    cookieValue = undefined;
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when the cookie is malformed, without touching the database", async () => {
    cookieValue = "too-short";
    expect((await callRequireAdmin()).ok).toBe(false);
    expect(executeSpy, "shape is checked before any query").not.toHaveBeenCalled();
  });

  it("when the database throws", async () => {
    dbResult = {
      impl: () => {
        throw new Error("connection refused");
      },
    };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when no row matches, which is expired or revoked", async () => {
    // touch_admin_session returns nothing when the session has expired or the
    // admin is no longer active. Both must deny.
    dbResult = { impl: () => ({ rows: [] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when the row carries a role we do not recognise", async () => {
    dbResult = { impl: () => ({ rows: [{ ...ROW, admin_role: "auditor" }] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when the row has no admin id", async () => {
    dbResult = { impl: () => ({ rows: [{ admin_role: "owner", admin_email: "a@e.com", expires_at: ROW.expires_at }] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when the row has no email", async () => {
    dbResult = { impl: () => ({ rows: [{ admin_id: ROW.admin_id, admin_role: "owner", expires_at: ROW.expires_at }] }) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });

  it("when rows is missing entirely", async () => {
    dbResult = { impl: () => ({}) };
    expect((await callRequireAdmin()).ok).toBe(false);
  });
});

describe("requireAdmin resolves from the session, never a JWT", () => {
  it("looks the token up rather than trusting anything the client sent", async () => {
    await callRequireAdmin();
    // The one call is touch_admin_session with the hash, not resolve_admin on a
    // client-supplied email.
    const query = JSON.stringify(executeSpy.mock.calls[0]?.[0] ?? {});
    expect(query).toContain("touch_admin_session");
  });
});
