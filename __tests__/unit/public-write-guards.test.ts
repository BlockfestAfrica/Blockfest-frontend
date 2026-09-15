/**
 * Registration refuses a cross-site form.
 *
 * The handler reads the body with text() then JSON.parse, so a CORS-safelisted
 * text/plain form could submit from any page with no preflight: every visitor
 * of an attacker's page filed a registration carrying THEIR address and user
 * agent, poisoning the one fraud signal the console has and spending a
 * stranger's per-IP budget. Both halves are asserted, because an origin check
 * alone still leaves the text/plain path open on a route that never reads the
 * content type.
 */

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const post = (headers: Record<string, string>) =>
  new NextRequest("https://blockfestafrica.com/api/campaigns/monica/register", {
    method: "POST",
    headers,
    body: JSON.stringify({ anything: true }),
  });

describe("registration and cross-site submissions", () => {
  it("refuses a foreign origin", async () => {
    const { POST } = await import("@/app/api/campaigns/monica/register/route");
    const response = await POST(
      post({
        "content-type": "application/json",
        origin: "https://evil.example",
        "x-forwarded-host": "blockfestafrica.com",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("refuses a text/plain form even from the right origin", async () => {
    const { POST } = await import("@/app/api/campaigns/monica/register/route");
    const response = await POST(
      post({
        "content-type": "text/plain;charset=UTF-8",
        origin: "https://blockfestafrica.com",
        "x-forwarded-host": "blockfestafrica.com",
      }),
    );
    expect(response.status).toBe(415);
  });

  it("refuses a request with no origin at all", async () => {
    // A form post from a page that stripped the header is still not the
    // campaign's own form; sameOrigin fails closed on a missing Origin.
    const { POST } = await import("@/app/api/campaigns/monica/register/route");
    const response = await POST(
      post({
        "content-type": "application/json",
        "x-forwarded-host": "blockfestafrica.com",
      }),
    );
    expect(response.status).toBe(403);
  });
});
