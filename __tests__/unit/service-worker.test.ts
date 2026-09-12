/**
 * The service worker, checked for what it must never cache.
 *
 * The defect this guards against was invisible from the application side. A
 * page can set force-dynamic and revalidate 0, be served with no-store, and
 * still end up written to Cache Storage by the worker, because Next's caching
 * and the browser's Cache Storage are unrelated. Nothing in the page, the route
 * or the database can reach in and remove it, so a cached signed-in page
 * survives signing out, a revoked token and a deleted row.
 *
 * The navigation branch is the specific trap: it runs before every other rule
 * and returns, so an exclusion written further down the chain never executes
 * for a page load. That is exactly what happened to the /api/ rule.
 *
 * These assertions read the shipped file rather than importing it, because it
 * is a service worker: it runs against ServiceWorkerGlobalScope, is not a
 * module, and is never imported by anything in the app.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { monicaRoutes } from "@/lib/campaigns";

const SW = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

/** Line index of a marker, so ordering can be asserted rather than assumed. */
function lineOf(needle: string): number {
  const i = SW.split("\n").findIndex((l) => l.includes(needle));
  expect(i, `expected to find ${needle} in public/sw.js`).toBeGreaterThan(-1);
  return i;
}

describe("private pages", () => {
  it("are excluded before the navigation branch decides anything", () => {
    // Ordering is the whole finding. An exclusion after this point does not
    // run for a page load, which is how the /api/ rule came to be dead for
    // navigations.
    const guard = lineOf("isPrivatePath(url.pathname)");
    const navigation = lineOf('request.mode === "navigate"');
    expect(guard).toBeLessThan(navigation);
  });

  it("covers the creator page, which renders somebody's name and points", () => {
    expect(SW).toContain(monicaRoutes.me);
  });

  it("covers the route that carries an access token", () => {
    expect(SW).toContain(monicaRoutes.enter);
  });

  it("covers the admin surface before it exists", () => {
    // Listed now so the first admin page is not the thing that discovers this.
    expect(SW).toContain('"/admin"');
    expect(SW).toContain('"/api/admin"');
  });

  it("matches whole segments, so a longer path is not caught by accident", () => {
    // /campaigns/.../me must match, /campaigns/.../mentions must not.
    expect(SW).toMatch(/pathname === prefix \|\| pathname\.startsWith\(prefix \+ "\/"\)/);
  });
});

describe("the cache name", () => {
  it("was bumped, so anything the previous worker stored is deleted", () => {
    // The activate handler deletes every blockfest- cache that is not the
    // current one. Changing behaviour without bumping this leaves the bad
    // entries in place on every device that already has them.
    expect(SW).toContain('const CACHE_NAME = "blockfest-v3"');
    expect(SW).not.toContain('"blockfest-v2"');
  });

  it("still evicts old caches on activate", () => {
    expect(SW).toMatch(/name\.startsWith\("blockfest-"\)\s*&&\s*name !== CACHE_NAME/);
  });
});

describe("API responses", () => {
  it("are still not cached", () => {
    const api = SW.indexOf('url.pathname.startsWith("/api/")');
    expect(api).toBeGreaterThan(-1);
    // The branch exists and returns rather than caching.
    expect(SW.slice(api, api + 200)).toMatch(/return;/);
  });
});
