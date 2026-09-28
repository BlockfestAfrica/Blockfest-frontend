import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The one place the public leaderboard learns who is looking.
 *
 * Its answer is one person's, read from their cookie, beside public routes
 * that are cached at the edge. So every branch must forbid caching, and the
 * answer must be the rank and name it needs and nothing else the session holds.
 */

const session = vi.hoisted(() => ({
  creator: null as null | Record<string, unknown>,
  throws: false,
  rank: null as number | null,
}));

vi.mock("@/lib/creator-session", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/creator-session")>()),
  currentCreator: vi.fn(async () => {
    if (session.throws) throw new Error("database down");
    return session.creator;
  }),
}));
vi.mock("@/lib/leaderboard", () => ({
  creatorRank: vi.fn(async () => session.rank),
}));

const { GET } = await import("@/app/api/campaigns/monica/standing/route");

function get(headers: Record<string, string> = {}) {
  return new NextRequest("https://blockfest.africa/api/campaigns/monica/standing", {
    headers: { host: "blockfest.africa", ...headers },
  });
}

async function expectPrivate(response: Response) {
  const cache = response.headers.get("cache-control") ?? "";
  expect(cache).toContain("no-store");
  expect(cache).toContain("private");
}

beforeEach(() => {
  session.creator = null;
  session.throws = false;
  session.rank = null;
});

describe("GET /api/campaigns/monica/standing", () => {
  it("answers nobody when signed out, uncached", async () => {
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, me: null });
    await expectPrivate(response);
  });

  it("answers nobody for a browser holding only the old cookie", async () => {
    const response = await GET(get({ cookie: "monica_creator=an-old-session-token" }));
    expect(await response.json()).toEqual({ ok: true, me: null });
    await expectPrivate(response);
  });

  it("returns exactly rank, name and points for a signed-in creator, and nothing else the session holds", async () => {
    session.creator = {
      enrolmentId: "0f0e0d0c-0b0a-4000-8000-000000000001",
      name: "  Ada Obi ",
      referralCode: "ADA123",
      pointsTotal: 350,
      approvedEntries: 2,
      joinedAt: new Date(),
    };
    session.rank = 4;
    const response = await GET(get());
    const body = await response.json();
    expect(body).toEqual({ ok: true, me: { rank: 4, name: "Ada Obi", points: 350 } });
    expect(JSON.stringify(body)).not.toMatch(/0f0e0d0c|ADA123|joinedAt|approvedEntries/);
    await expectPrivate(response);
  });

  it("answers nobody for a signed-in creator with no rank yet", async () => {
    session.creator = { enrolmentId: "x", name: "New Person" };
    const response = await GET(get());
    expect(await response.json()).toEqual({ ok: true, me: null });
  });

  it("fails soft, and still uncached, when the database is down", async () => {
    session.throws = true;
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, me: null });
    await expectPrivate(response);
  });

  it("refuses another site asking on the visitor's behalf", async () => {
    const response = await GET(get({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    await expectPrivate(response);
  });
});
