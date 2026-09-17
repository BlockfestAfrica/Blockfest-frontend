/**
 * Catching an Identity link that lands on the site root.
 *
 * This exists because of a bug a real invite found. Netlify builds its links as
 * `{{ .SiteURL }}/#invite_token=...`, which is the homepage, and the handler
 * that completes them was on /admin/login. The invited admin clicked, arrived at
 * the homepage, and nothing happened. Nothing errored either, which is why it
 * would have been found on the morning somebody needed to review entries.
 *
 * The pattern is the whole mechanism, so the pattern is what is tested: it has
 * to match every token type Netlify issues, in either fragment position, and
 * match nothing that an ordinary visitor has in their URL. It runs on every page
 * load in the root layout, so a false positive is a redirect to a login page for
 * somebody who was reading the schedule.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "components/admin/identity-callback.tsx"),
  "utf8",
);

/** The pattern the component uses, read from it rather than copied. */
function authTokenPattern(): RegExp {
  const match = SOURCE.match(/const AUTH_TOKEN = (\/.+\/);/);
  expect(match, "AUTH_TOKEN pattern not found in the component").toBeTruthy();
  const body = match![1];
  const lastSlash = body.lastIndexOf("/");
  return new RegExp(body.slice(1, lastSlash), body.slice(lastSlash + 1));
}

const AUTH_TOKEN = authTokenPattern();

describe("links Netlify actually sends", () => {
  it("matches the invite link from a real invitation email", () => {
    // Verbatim shape of the link that failed: the site root, token in the
    // fragment, base64url characters including a hyphen and an underscore.
    expect(AUTH_TOKEN.test("#invite_token=iuK-npUwkvQF-g0EEoqwaQ")).toBe(true);
  });

  it.each([
    ["#invite_token=abc123", "invite"],
    ["#recovery_token=abc123", "password recovery"],
    ["#confirmation_token=abc123", "email confirmation"],
    ["#email_change_token=abc123", "email change"],
  ])("matches %s (%s)", (hash) => {
    expect(AUTH_TOKEN.test(hash)).toBe(true);
  });

  it("matches a token that is not the first parameter", () => {
    // handleAuthCallback processes whatever is in the hash, and Netlify can put
    // more than one value there.
    expect(AUTH_TOKEN.test("#error=x&invite_token=abc123")).toBe(true);
  });
});

describe("what an ordinary visitor has in their URL", () => {
  it.each([
    [""],
    ["#"],
    ["#main"],
    ["#stages"],
    ["#disclosure"],
    ["#entering"],
    ["#faq"],
    ["#section-2"],
  ])("ignores %o", (hash) => {
    // A false positive here sends somebody reading the rules to a login page.
    expect(AUTH_TOKEN.test(hash)).toBe(false);
  });

  it("ignores a word that merely contains a token name", () => {
    expect(AUTH_TOKEN.test("#my_invite_tokens_explained")).toBe(false);
  });

  it("ignores a token-looking value in the query rather than the fragment", () => {
    // The query reaches the server and the fragment does not. Netlify uses the
    // fragment, and only the fragment should trigger this.
    expect(AUTH_TOKEN.test("?invite_token=abc")).toBe(false);
  });
});

describe("how the component behaves", () => {
  it("sends the token to the page that can complete it", () => {
    expect(SOURCE).toContain('const DESTINATION = "/admin/login"');
  });

  it("carries the fragment across rather than dropping it", () => {
    expect(SOURCE).toMatch(/\$\{DESTINATION\}\$\{hash\}/);
  });

  it("does not consume the token on the way", () => {
    // handleAuthCallback can only be called once per token. Calling it here,
    // on a page with no password form, would burn the invite.
    //
    // Checked against code rather than the whole file, because the component
    // names the function in a comment explaining why it does not call it.
    const code = SOURCE.split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !l.startsWith("//") &&
          !l.startsWith("*") &&
          !l.startsWith("/*"),
      )
      .join("\n");

    expect(code).not.toContain("handleAuthCallback");
  });

  it("replaces rather than pushes, so the token leaves the back button", () => {
    expect(SOURCE).toContain("location.replace");
  });

  it("does not redirect when it is already on the destination", () => {
    expect(SOURCE).toMatch(/pathname === DESTINATION/);
  });

  it("tests the string before importing anything", () => {
    // It runs on every page load in the root layout. An ordinary visitor should
    // pay one regular expression and no module load.
    const guardAt = SOURCE.indexOf("AUTH_TOKEN.test(hash)");
    const importAt = SOURCE.indexOf("await import");
    expect(guardAt).toBeGreaterThan(-1);
    // There is no dynamic import at all in the current shape, which is stronger
    // than ordering. If one is ever added it must come after the guard.
    if (importAt > -1) expect(importAt).toBeGreaterThan(guardAt);
  });
});

describe("it is actually mounted", () => {
  it("appears in the root layout, where every link lands", () => {
    // The component is correct and useless unless something renders it.
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("IdentityCallback");
    expect(layout).toMatch(/<IdentityCallback\s*\/>/);
  });
});
