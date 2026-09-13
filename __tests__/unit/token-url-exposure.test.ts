/**
 * No third party script on a page whose URL can carry a creator's token.
 *
 * The entry link is /enter?t=<32 random bytes>. Netlify re-appends the original
 * query string to a redirect, so the token also arrives in the address bar of
 * whatever that redirect lands on. A pageview tag reports the URL it is on, so
 * every creator's ninety day credential was being handed to an analytics vendor
 * on their first visit. The tag only ever excluded /admin, because it was
 * written for a different attack.
 *
 * Two layers are asserted here, because the first is a React component somebody
 * can delete while tidying and the second is what holds when they do.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

/** Every path where a token can appear in the URL. */
const TOKEN_BEARING = [
  "/campaigns/monica-money-story/enter",
  "/campaigns/monica-money-story/enter/confirm",
  "/campaigns/monica-money-story/me",
];

describe("the analytics tag", () => {
  it("refuses to render on any path that can carry a token", () => {
    const src = read("components/shared/analytics.tsx");
    const list = src.slice(src.indexOf("const OFF_LIMITS"));
    const prefixes = [...list.matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]);

    const unprotected = TOKEN_BEARING.filter(
      (path) => !prefixes.some((p) => path === p || path.startsWith(`${p}/`)),
    );

    expect(
      unprotected,
      `the tag loads on these, and a pageview reports the URL it is on:\n${unprotected.join("\n")}`,
    ).toEqual([]);
  });
});

describe("the content security policy", () => {
  /**
   * The layer that does not depend on anybody remembering. A browser enforces
   * the intersection of every CSP header it receives, so a policy without the
   * vendor host in script-src means the script is never fetched, whatever the
   * component does.
   */
  it("does not allow a third party script source on those paths", () => {
    const config = read("next.config.ts");

    for (const path of TOKEN_BEARING) {
      // The route pattern covering this path, if any.
      const patterns = [...config.matchAll(/source:\s*"([^"]+)"/g)].map(
        (m) => m[1],
      );
      const covering = patterns.filter((pattern) => {
        const base = pattern.replace(/\/:path\*$/, "");
        return path === base || path.startsWith(`${base}/`);
      });

      expect(
        covering.length,
        `${path} has no scoped CSP entry in next.config.ts`,
      ).toBeGreaterThan(0);

      // The scoped policy for it must keep script-src to self.
      const scoped = covering
        .map((pattern) => {
          const at = config.indexOf(`source: "${pattern}"`);
          const block = config.slice(at, at + 2000);
          return /script-src ([^;]+);/.exec(block)?.[1] ?? "";
        })
        .filter(Boolean);

      expect(
        scoped.some((policy) => !/https?:\/\//.test(policy)),
        `${path} allows an external script host: ${scoped.join(" | ")}`,
      ).toBe(true);
    }
  });
});

describe("script execution, site-wide", () => {
  /**
   * The #138 residual, closed: no CSP anywhere on this site may allow an
   * external host in script-src. The analytics tag is a pinned snapshot
   * served from this origin, and the vendor appears in connect-src only,
   * which is receiving beacons rather than running code. Reintroducing a
   * hosted tag "temporarily" is exactly the drift this catches.
   */
  it("is never granted to an external host by any policy", () => {
    const config = read("next.config.ts");
    const policies = [...config.matchAll(/script-src ([^;]+);/g)].map((m) => m[1]);

    expect(policies.length, "the site declares script-src").toBeGreaterThan(0);
    for (const policy of policies) {
      expect(
        /https?:\/\//.test(policy),
        `an external script host is back in a CSP: ${policy}`,
      ).toBe(false);
    }
  });

  it("keeps the pinned snapshot pointing its beacons at the vendor", () => {
    // The script derives its endpoint from its own src when data-api is
    // absent, which self-hosted means this origin's nonexistent /api/e and
    // every pageview silently dropped.
    const tag = read("components/shared/analytics.tsx");
    expect(tag).toContain("data-api");
    const lib = read("lib/sabilytics.ts");
    expect(lib).toMatch(/SABILYTICS_SRC = "\/vendor\//);
    expect(lib).toMatch(/SABILYTICS_API = "https:\/\/www\.sabilytics\.com/);
  });
});
