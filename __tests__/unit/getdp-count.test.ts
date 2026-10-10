/**
 * The one request Get DP sends (app/getdp/lib/count.ts): a role and a
 * channel, to the site's own count route, and never anything that could
 * hold a name or a photo. privacy.test.ts holds the folder to this being the
 * only request; this holds the request to its payload.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { COUNT_URL, DP_CHANNELS, countDp } from "@/app/getdp/lib/count";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("counting a DP", () => {
  it("sends the role and the channel to the site's own route, and nothing else", () => {
    const fetchStub = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchStub);
    countDp("volunteer", "status");
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/getdp/generated");
    expect(COUNT_URL).toBe(url);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ role: "volunteer", channel: "status" });
    expect(Object.keys(init).sort()).toEqual(["body", "headers", "keepalive", "method"]);
  });

  it("never troubles the page when the count cannot be sent", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    expect(() => countDp("attendee", "download")).not.toThrow();
    vi.stubGlobal("fetch", () => {
      throw new TypeError("no fetch here");
    });
    expect(() => countDp("attendee", "download")).not.toThrow();
    await Promise.resolve();
  });

  it("names every way a DP leaves the page", () => {
    expect([...DP_CHANNELS].sort()).toEqual(
      ["download", "share", "more", "photos", "save", "status", "x", "instagram", "tiktok", "linkedin", "whatsapp"].sort(),
    );
  });
});
