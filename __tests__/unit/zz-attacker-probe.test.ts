import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/lib/db/client");
  return {
    ...actual,
    getDb: () => ({
      query: { campaigns: { findFirst: async () => ({ slug: "x", status: "active", startsAt: null }) } },
      select: () => ({ from: () => ({ where: async () => [{ n: 0 }] }) }),
      insert: () => ({ values: async () => undefined }),
      execute: async () => { throw new Error("boom"); },
    }),
  };
});

describe("route import probe", () => {
  it("imports and invokes the register route", async () => {
    const mod = await import("@/app/api/campaigns/monica/register/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://x.test/api/campaigns/monica/register", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "zqxUA", "x-nf-client-connection-ip": "203.0.113.77" },
      body: JSON.stringify({
        fullName: "Zqxcanary Surname",
        email: "zqxcanary01@example.com",
        phone: "+2348012345678",
        monicaTag: "money",
        x: "zqxcanaryx",
        instagram: "",
        tiktok: "",
        rulesVersion: "1",
        marketingOptIn: true,
      }),
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await mod.POST(req);
    process.stdout.write(`STATUS=${res.status} SPYCALLS=${JSON.stringify(spy.mock.calls)}\n`);
    expect(res.status).toBeGreaterThan(0);
  });
});
