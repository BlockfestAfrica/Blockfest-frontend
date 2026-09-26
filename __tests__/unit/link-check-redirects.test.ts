// @vitest-environment node
/**
 * The link check requests only the entry's own platform, on every hop.
 *
 * The stored link passed the platform allowlist when it was submitted, and
 * that was the only place the allowlist ever ran. The probe then fetched it
 * with redirect: "follow", so a 30x from any allowlisted host (an open
 * redirect, a link shim, a dangling subdomain) walked this server's GET to
 * wherever the Location pointed, plain http and bare IP addresses included.
 * The allowlist guarded the first hop and nothing after it.
 *
 * The fetch here is a fake that honours both redirect modes the way Node's
 * does: "follow" chases the Location itself and hands back only the final
 * answer, "manual" hands back the 30x. So the old probe is exercised as it
 * really behaved, and the test reads which addresses were requested rather
 * than how the route asked for them.
 *
 * The node environment, not the suite's jsdom default, because this is a
 * route handler and the Response and AbortSignal it meets on Netlify are
 * Node's own.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = { id: string; platform: "x" | "instagram" | "tiktok"; url: string };

let rows: Row[] = [];

/* The select chain the route builds, ending in whatever rows the test set. */
const query = {
  select: () => query,
  from: () => query,
  innerJoin: () => query,
  where: () => query,
  orderBy: () => query,
  limit: async () => rows,
};

vi.mock("@/lib/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/client")>()),
  getDb: () => query,
}));
vi.mock("@/lib/admin/request", () => ({ sameOrigin: () => true }));
vi.mock("@/lib/admin/session", () => ({ requireAdmin: async () => ({ ok: true }) }));
vi.mock("@/lib/throttle", () => ({ allow: async () => true }));

/** What each address answers. Anything not listed is a 404. */
let web: Record<string, { status: number; location?: string }> = {};
let requested: string[] = [];

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  let url = input instanceof Request ? input.url : String(input);
  for (let hops = 0; hops < 20; hops++) {
    requested.push(url);
    const answer = web[url] ?? { status: 404 };
    const headers: Record<string, string> = answer.location ? { location: answer.location } : {};
    const response = new Response(null, { status: answer.status, headers });
    if (init?.redirect === "manual" || !REDIRECTS.has(answer.status) || !answer.location) {
      return response;
    }
    url = new URL(answer.location, url).href;
  }
  throw new TypeError("redirect count exceeded");
}

async function runCheck() {
  const { POST } = await import("@/app/api/admin/link-check/route");
  const response = await POST(
    new NextRequest("https://blockfestafrica.com/api/admin/link-check", { method: "POST" }),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    checked: number;
    unverifiable: number;
    gone: Array<{ url: string; status: number | null }>;
  };
}

beforeEach(() => {
  rows = [];
  web = {};
  requested = [];
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

describe("a redirect off the entry's platform", () => {
  const POST_URL = "https://instagram.com/p/abc";

  it.each([
    ["another host", "https://offlist.invalid/hop"],
    ["a lookalike host", "https://instagram.com.offlist.invalid/p/abc"],
    ["a protocol-relative host", "//offlist.invalid/hop"],
    ["plain http on the platform's own host", "http://instagram.com/p/abc"],
    ["a loopback address", "http://127.0.0.1:9/hop"],
  ])("to %s is never requested, and proves nothing", async (_, location) => {
    rows = [{ id: "s1", platform: "instagram", url: POST_URL }];
    web[POST_URL] = { status: 302, location };

    const report = await runCheck();

    expect(requested, "only the stored link may be requested").toEqual([POST_URL]);
    expect(report.gone, "a 404 from off the platform is not the platform saying gone").toEqual([]);
    expect(report.unverifiable).toBe(1);
  });

  it("is refused even several hops into an on-platform chain", async () => {
    rows = [{ id: "s1", platform: "x", url: "https://twitter.com/ada/status/1" }];
    web["https://twitter.com/ada/status/1"] = { status: 301, location: "https://x.com/ada/status/1" };
    web["https://x.com/ada/status/1"] = { status: 302, location: "https://offlist.invalid/hop" };

    const report = await runCheck();

    expect(requested).toEqual(["https://twitter.com/ada/status/1", "https://x.com/ada/status/1"]);
    expect(report.gone).toEqual([]);
    expect(report.unverifiable).toBe(1);
  });
});

describe("the stored link itself", () => {
  it("is not requested when it is not on the entry's platform", async () => {
    rows = [{ id: "s1", platform: "instagram", url: "https://offlist.invalid/p/abc" }];

    const report = await runCheck();

    expect(requested).toEqual([]);
    expect(report.unverifiable).toBe(1);
  });
});

describe("the platforms' own redirects", () => {
  it("are still followed, so a post that moved and then vanished reads as gone", async () => {
    rows = [{ id: "s1", platform: "x", url: "https://twitter.com/ada/status/1" }];
    web["https://twitter.com/ada/status/1"] = { status: 301, location: "https://x.com/ada/status/1" };

    const report = await runCheck();

    expect(requested).toEqual(["https://twitter.com/ada/status/1", "https://x.com/ada/status/1"]);
    expect(report.gone).toEqual([
      expect.objectContaining({ url: "https://twitter.com/ada/status/1", status: 404 }),
    ]);
  });

  it("resolve relative Locations against the hop that sent them", async () => {
    rows = [{ id: "s1", platform: "instagram", url: "https://instagram.com/p/abc" }];
    web["https://instagram.com/p/abc"] = { status: 301, location: "https://www.instagram.com/p/abc" };
    web["https://www.instagram.com/p/abc"] = { status: 301, location: "/p/abc/" };
    web["https://www.instagram.com/p/abc/"] = { status: 200 };

    const report = await runCheck();

    expect(requested.at(-1)).toBe("https://www.instagram.com/p/abc/");
    expect(report.gone).toEqual([]);
    expect(report.unverifiable).toBe(0);
  });

  it("stop at a small hop limit instead of chasing a loop", async () => {
    rows = [{ id: "s1", platform: "x", url: "https://x.com/ada/status/1" }];
    web["https://x.com/ada/status/1"] = { status: 302, location: "https://x.com/ada/status/2" };
    web["https://x.com/ada/status/2"] = { status: 302, location: "https://x.com/ada/status/1" };

    const report = await runCheck();

    expect(requested.length).toBeLessThanOrEqual(6);
    expect(report.unverifiable).toBe(1);
  });
});
