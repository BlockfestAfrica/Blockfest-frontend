/**
 * The service worker's only job is to not exist.
 *
 * The previous suite asserted the text of a worker that never executed: its
 * install handler cached files that were not in public/, cache.addAll rejects
 * whole, and a rejected install discards the worker. Every assertion about
 * exclusions and cache eviction was describing dead code, which issue #123
 * documented in full.
 *
 * The replacement is a self-destructing worker, and these assert exactly the
 * three things it must do and the many things it must never start doing
 * again. If a real PWA is wanted after the campaign, it replaces this file,
 * this suite, and gets verified on a real device first.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SW = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
const CODE = SW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the kill switch worker", () => {
  it("unregisters itself", () => {
    expect(CODE).toContain("registration.unregister()");
  });

  it("deletes every cache a predecessor might have left", () => {
    expect(CODE).toContain("caches.keys()");
    expect(CODE).toContain("caches.delete(");
  });

  it("takes over immediately, so the cleanup does not wait a navigation", () => {
    expect(CODE).toContain("skipWaiting()");
  });
});

describe("what must never come back without a real device test", () => {
  it("caches nothing", () => {
    // The hazard #123 documented: an install-time addAll over a hardcoded
    // list, one bad entry from either never running or suddenly running.
    expect(CODE).not.toContain("addAll");
    expect(CODE).not.toContain("cache.put");
    expect(CODE).not.toContain("STATIC_CACHE_URLS");
  });

  it("intercepts no requests", () => {
    // A fetch handler is a proxy in front of every page including /me and
    // /enter. Nothing here may stand in front of a token-bearing URL.
    expect(CODE).not.toMatch(/addEventListener\(\s*["']fetch/);
  });

  it("declares no cache name to bump", () => {
    // The bump was believed to be a remote kill switch and was connected to
    // nothing. No name, no false lever.
    expect(CODE).not.toContain("CACHE_NAME");
  });
});
