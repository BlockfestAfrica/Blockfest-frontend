/**
 * A session an admin can actually end.
 *
 * The console had no sign-out anywhere, so an Identity session could not be
 * ended from the application: a reviewer on a shared laptop closed the tab and
 * left a working session behind, and somebody who believed their session was
 * compromised had nothing to do but wait about an hour for the token to expire.
 */

import { describe, expect, it, vi } from "vitest";

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

const SAME = {
  origin: "https://blockfestafrica.com",
  host: "blockfestafrica.com",
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
