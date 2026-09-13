/**
 * A session an admin can actually end.
 *
 * The console had no sign-out anywhere, so an Identity session could not be
 * ended from the application: a reviewer on a shared laptop closed the tab and
 * left a working session behind, and somebody who believed their session was
 * compromised had nothing to do but wait about an hour for the token to expire.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbSpy = vi.fn();
let dbThrows = false;

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    execute: async (...args: unknown[]) => {
      dbSpy(...args);
      if (dbThrows) throw new Error("connection refused");
      return { rows: [] };
    },
  }),
}));

beforeEach(() => {
  dbSpy.mockClear();
  dbThrows = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function signOut(headers: Record<string, string>): Promise<Response> {
  vi.resetModules();
  const { POST } = await import("@/app/api/admin/signout/route");
  const { NextRequest } = await import("next/server");
  return POST(
    new NextRequest(
      new Request("https://blockfestafrica.com/api/admin/signout", {
        method: "POST",
        headers,
      }),
    ),
  );
}

const TOKEN = "dAyeo84EfDrV3h3E7NVYQx5MlMNqrA_5nrMofYmz3o8";

const SAME = {
  origin: "https://blockfestafrica.com",
  host: "blockfestafrica.com",
  cookie: `__Host-admin_session=${TOKEN}`,
};

/** Cookies the response clears, by name. */
function cleared(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .filter((raw) => {
      const [pair, ...rest] = raw.split(";");
      const value = pair.slice(pair.indexOf("=") + 1).trim();
      return value === "" || rest.some((a) => /max-age\s*=\s*0/i.test(a));
    })
    .map((raw) => raw.slice(0, raw.indexOf("=")).trim());
}

describe("signing out", () => {
  it("clears the token the edge and the application read", async () => {
    expect(cleared(await signOut(SAME))).toContain("nf_jwt");
  });

  /**
   * The one that decides whether this works at all. Clearing nf_jwt alone ends
   * the session until the next refresh and no longer, because nf_refresh is
   * what mints a replacement.
   */
  it("clears the refresh token too, or the session comes back", async () => {
    expect(cleared(await signOut(SAME))).toContain("nf_refresh");
  });

  it("refuses a cross site POST", async () => {
    // A GET or an unchecked POST would let any page on the internet sign an
    // admin out. That is a nuisance rather than a compromise, but a nuisance
    // during a live review window is how a queue stops being worked.
    const response = await signOut({
      origin: "https://evil.example",
      host: "blockfestafrica.com",
    });
    expect(response.status).toBe(403);
    expect(cleared(response)).toEqual([]);
  });

  it("refuses a request with no Origin at all", async () => {
    const response = await signOut({ host: "blockfestafrica.com" });
    expect(response.status).toBe(403);
  });
});

describe("ending the session on the server, not only in the browser", () => {
  /**
   * The half-measure this replaces: clearing cookies while the session stayed
   * live in the database, so a copy of the cookie value taken beforehand kept
   * working. The row is the authority, so the row is what has to go.
   */
  it("deletes the session row, keyed by the cookie's hash", async () => {
    const { createHash } = await import("node:crypto");
    await signOut(SAME);

    const sent = JSON.stringify(dbSpy.mock.calls);
    expect(sent, "a DELETE must be issued").toContain("admin_sessions");
    expect(
      sent,
      "keyed by the hash, and the raw token never reaches the database",
    ).toContain(createHash("sha256").update(TOKEN).digest("hex"));
    expect(sent).not.toContain(TOKEN);
  });

  it("clears the session cookie too", async () => {
    expect(cleared(await signOut(SAME))).toContain("__Host-admin_session");
  });

  it("still clears every cookie when the delete fails, and says so", async () => {
    // Claiming success while the row lives is the one answer that would leave
    // somebody believing they had signed out when they had not.
    dbThrows = true;
    const response = await signOut(SAME);

    expect(response.status).toBe(500);
    expect(cleared(response)).toContain("__Host-admin_session");
    const body = await response.json();
    expect(body.message).toMatch(/Close the browser/);
  });

  it("does not query at all for a malformed cookie", async () => {
    await signOut({ ...SAME, cookie: "__Host-admin_session=nope" });
    expect(dbSpy).not.toHaveBeenCalled();
  });
});
