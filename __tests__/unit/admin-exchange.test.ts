/**
 * The sign-in exchange: the one place an Identity password is spent (#138).
 *
 * Everything this endpoint must not do is more interesting than what it does.
 * It must not relay a password for somebody else's page, must not tell a wrong
 * password apart from a non-admin, must not put the session token anywhere page
 * script can read, and must not log a credential.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const EMAIL = "partnership@blockfestafrica.com";
const PASSWORD = "correct horse battery staple";

let fetchImpl: (url: string) => unknown;
let dbImpl: () => unknown;
const dbSpy = vi.fn();
let allowed = true;

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    execute: async (...args: unknown[]) => {
      dbSpy(...args);
      return dbImpl();
    },
  }),
}));

vi.mock("@/lib/throttle", () => ({
  allow: async () => allowed,
}));

/** A JWT whose payload carries a sub, which is all the exchange reads. */
function jwtWith(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub, email: EMAIL })).toString("base64url");
  return `header.${payload}.signature`;
}

async function post(body: unknown, origin = "https://blockfestafrica.com") {
  vi.resetModules();
  const { POST } = await import("@/app/api/admin/session/route");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    host: "blockfestafrica.com",
  };
  if (origin) headers.origin = origin;
  return POST(
    new NextRequest(
      new Request("https://blockfestafrica.com/api/admin/session", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    ),
  );
}

const setCookies = (r: Response) => r.headers.getSetCookie();
const sessionCookie = (r: Response) =>
  setCookies(r).find((c) => c.startsWith("__Host-admin_session="));

beforeEach(() => {
  allowed = true;
  dbSpy.mockClear();
  dbImpl = () => ({ rows: [{ admin_id: "11111111-1111-1111-1111-111111111111" }] });
  fetchImpl = () =>
    new Response(JSON.stringify({ access_token: jwtWith("acct-owner"), email: EMAIL }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => fetchImpl(url)));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("what it refuses before dialling Identity", () => {
  it("a cross-site POST", async () => {
    const response = await post({ email: EMAIL, password: PASSWORD }, "https://evil.example");
    expect(response.status).toBe(403);
    expect(fetch, "the password must not be relayed for another origin").not.toHaveBeenCalled();
  });

  it("a POST with no Origin at all", async () => {
    const response = await post({ email: EMAIL, password: PASSWORD }, "");
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a throttled client, distinguishably, so a real admin learns to wait", async () => {
    allowed = false;
    const response = await post({ email: EMAIL, password: PASSWORD });
    expect(response.status).toBe(429);
    expect(fetch, "stuffing costs our throttle, not an upstream round trip").not.toHaveBeenCalled();
  });
});

describe("what it refuses with one uniform answer", () => {
  const uniform = async (response: Response) => {
    expect(response.status).toBe(403);
    expect(sessionCookie(response)).toBeUndefined();
    const body = await response.json();
    expect(body.message).toBe("That did not work. Check the address and password.");
  };

  it("a wrong password", async () => {
    fetchImpl = () => new Response("{}", { status: 400 });
    await uniform(await post({ email: EMAIL, password: "wrong" }));
  });

  it("an unreachable Identity", async () => {
    fetchImpl = () => {
      throw new Error("ECONNRESET");
    };
    await uniform(await post({ email: EMAIL, password: PASSWORD }));
  });

  it("a valid Identity user who is not an admin", async () => {
    // The worst possible regression here: anyone who ever got an Identity
    // account on this site becoming an admin.
    dbImpl = () => ({ rows: [] });
    await uniform(await post({ email: "stranger@example.com", password: PASSWORD }));
  });

  it("a database that cannot answer", async () => {
    dbImpl = () => {
      throw new Error("connection refused");
    };
    await uniform(await post({ email: EMAIL, password: PASSWORD }));
  });

  it("a malformed body", async () => {
    await uniform(await post({ email: "x" }));
  });
});

describe("a successful sign-in", () => {
  it("sets a cookie no page script can read", async () => {
    const cookie = sessionCookie(await post({ email: EMAIL, password: PASSWORD }));
    expect(cookie).toBeDefined();
    // One assertion per attribute: losing any single one quietly reopens #138.
    expect(cookie, "httpOnly").toMatch(/HttpOnly/i);
    expect(cookie, "secure").toMatch(/Secure/i);
    expect(cookie, "same-site strict").toMatch(/SameSite=Strict/i);
    expect(cookie, "host-wide path").toMatch(/Path=\//);
    expect(cookie, "twelve hours").toMatch(/Max-Age=43200/);
  });

  it("expires the legacy Identity cookies on the same response", async () => {
    const cookies = setCookies(await post({ email: EMAIL, password: PASSWORD }));
    for (const name of ["nf_jwt", "nf_refresh"]) {
      const cleared = cookies.find((c) => c.startsWith(`${name}=`));
      expect(cleared, name).toBeDefined();
      expect(cleared).toMatch(/Max-Age=0/);
    }
  });

  it("stores a hash, never the token, and never returns the token", async () => {
    const response = await post({ email: EMAIL, password: PASSWORD });
    const cookie = sessionCookie(response)!;
    const token = cookie.slice(cookie.indexOf("=") + 1, cookie.indexOf(";"));

    const sent = JSON.stringify(dbSpy.mock.calls);
    expect(sent, "the raw token must never reach the database").not.toContain(token);
    expect(sent, "a 64-hex hash does").toMatch(/[0-9a-f]{64}/);

    const body = await response.json();
    expect(JSON.stringify(body), "nor the response body").not.toContain(token);
  });

  it("never writes the address or the password to a log", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    dbImpl = () => {
      throw new Error(`Failed query: INSERT ... params: ${EMAIL},${PASSWORD}`);
    };

    await post({ email: EMAIL, password: PASSWORD });

    const written = [...errorSpy.mock.calls, ...warnSpy.mock.calls].flat().join(" ");
    expect(written, "credentials outlive the request in a log").not.toContain(PASSWORD);
    expect(written).not.toContain(EMAIL);
  });
});
