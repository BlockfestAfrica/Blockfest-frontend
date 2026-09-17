/**
 * Disqualification is reachable, and only by an owner.
 *
 * void_enrolment has enforced the disqualified state since 0027 while
 * being callable by nobody: no route, no console control, a psql prompt
 * only. A rule the campaign cannot invoke is a rule the campaign does not
 * have. These pin the guards on the endpoint that finally invokes it.
 */

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("https://blockfestafrica.com/api/admin/void", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://blockfestafrica.com",
      "x-forwarded-host": "blockfestafrica.com",
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe("the disqualify endpoint", () => {
  it("refuses a cross-site caller before anything else", async () => {
    const { POST } = await import("@/app/api/admin/void/route");
    const response = await POST(
      post({ enrolmentId: crypto.randomUUID(), reason: "x" }, {
        origin: "https://evil.example",
      }),
    );
    expect(response.status).toBe(403);
  });

  /* The admin gate itself is not unit-testable here: requireAdmin reads
     cookies(), which throws outside a Next request scope. It is covered
     by __tests__/unit/admin-guard.test.ts, and the route uses the same
     requireAdmin plus isOwner pair as every other owner-only mutation. */
});
