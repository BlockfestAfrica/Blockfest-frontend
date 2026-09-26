/**
 * A page from before the cookie moved is told to reload, not to find its link.
 *
 * The session cookie moved to __Host-monica_creator, and only the server render
 * of /me sends a browser holding the old one through the one-time confirm. A
 * /me tab rendered before the deploy calls the creator routes directly, and
 * each answered "We do not know who you are. Open your personal link", which
 * sends a signed-in creator to recovery, and recovery replaces a link that
 * still works. A reload is all it takes, so that is what the refusal says.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/creator-session", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/creator-session")>()),
  currentCreator: vi.fn(async () => null),
}));

const ROUTES = {
  submit: () => import("@/app/api/campaigns/monica/submit/route"),
  withdraw: () => import("@/app/api/campaigns/monica/withdraw/route"),
  "handles/add": () => import("@/app/api/campaigns/monica/handles/add/route"),
  "request-handle-fix": () => import("@/app/api/campaigns/monica/request-handle-fix/route"),
};

function post(path: string, cookie: string | null) {
  const headers = new Headers({
    origin: "https://blockfest.africa",
    host: "blockfest.africa",
    "content-type": "application/json",
  });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`https://blockfest.africa/api/campaigns/monica/${path}`, {
    method: "POST",
    headers,
    body: "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(Object.entries(ROUTES))("POST %s with no current session", (path, load) => {
  it("asks a browser holding only the old cookie to reload", async () => {
    const { POST } = await load();
    const response = await POST(post(path, "monica_creator=an-old-session-token"));
    expect(response.status).toBe(401);
    expect((await response.json()).message).toMatch(/Reload this page/);
  });

  it("still sends a browser with no cookie at all to its link", async () => {
    const { POST } = await load();
    const response = await POST(post(path, null));
    expect(response.status).toBe(401);
    expect((await response.json()).message).toMatch(/We do not know who you are/);
  });
});
