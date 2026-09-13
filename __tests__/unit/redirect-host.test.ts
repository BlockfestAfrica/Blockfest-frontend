/**
 * Redirects that must not leave the visitor's domain.
 *
 * Both of these routes set a cookie and then redirect. A cookie set without a
 * Domain attribute is host-only, so if the redirect changes host the cookie does
 * not follow it and the visitor arrives with nothing.
 *
 * This was live. On Netlify, request.url carries the deploy's own host rather
 * than the domain the visitor typed, so `new URL(path, request.url)` produced
 *
 *   https://main--frolicking-sfogliatella-5fc862.netlify.app/...
 *
 * for somebody who had clicked a link on blockfestafrica.com. The creator
 * clicked the link in their own welcome email and was told we did not know who
 * they were. The referral route failed more quietly still: the ref cookie was
 * dropped, registration recorded no referrer, and the creator who brought them
 * in was simply never paid.
 *
 * It is invisible locally, where request.url is already localhost, which is why
 * this is asserted on the source rather than on behaviour: the failure only
 * exists on a platform the test suite does not run on.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES = [
  "app/campaigns/monica-money-story/enter/route.ts",
  "app/campaigns/monica-money-story/join/route.ts",
];

const source = (file: string) =>
  readFileSync(join(process.cwd(), file), "utf8");

/**
 * The file with comments removed.
 *
 * The first version of this test searched the raw source and failed on the
 * comment explaining the bug, which mentions the very expression it forbids.
 * A guard that cannot tell code from prose about code is a guard that punishes
 * writing the reason down.
 */
const code = (file: string) =>
  source(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("routes that set a cookie and redirect", () => {
  it("never builds the destination from request.url", () => {
    const offenders = ROUTES.filter((file) =>
      /new URL\(\s*[^)]*?\b(request|req)\.url/.test(code(file)),
    );

    expect(
      offenders,
      `request.url is the deploy host on Netlify, not the visitor's domain, so this redirects them off it and their cookie does not follow:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  /*
   * Asserts the property, not one spelling of it.
   *
   * The first version required the literal `headers: { Location: monicaRoutes.x }`
   * at every redirect. That passed only while each route had exactly one exit.
   * When /enter grew four (valid, unknown, unavailable, already signed in) and
   * routed them through one helper, the guard failed on correct code, for the
   * shape of the code rather than for where it sends anybody. What actually
   * matters is that no destination can leave the visitor's origin.
   */
  it("can never send the visitor to another origin", () => {
    for (const file of ROUTES) {
      const src = code(file);

      expect(
        /monicaRoutes\./.test(src),
        `${file} should build its destinations from monicaRoutes`,
      ).toBe(true);

      expect(
        src.includes("https://") || src.includes("http://"),
        `${file} must not hardcode an origin`,
      ).toBe(false);

      // Every Location, however it is spelled: a helper argument, a variable,
      // or an inline literal. None may be absolute or protocol relative.
      const destinations = [
        ...src.matchAll(/Location:\s*([^,}\n]+)/g),
      ].map((m) => m[1].trim());

      expect(destinations.length, `${file} should redirect somewhere`).toBeGreaterThan(0);

      for (const destination of destinations) {
        expect(
          /^["'`](\/\/|[a-z]+:)/i.test(destination),
          `${file} sends Location ${destination}, which leaves the visitor's origin, so the cookie set beside it does not follow`,
        ).toBe(false);
      }
    }
  });

  it("still sets the cookie it exists to set", () => {
    // The whole point of both routes: move a value out of a query string and
    // into a cookie. A redirect that forgets the cookie is a silent no-op.
    for (const file of ROUTES) {
      expect(source(file)).toMatch(/response\.cookies\.set\(/);
    }
  });
});
