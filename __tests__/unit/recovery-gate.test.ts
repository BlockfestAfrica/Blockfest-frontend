/**
 * A callback link must not leave a session the server can see.
 *
 * handleAuthCallback signs the browser in before it returns, for recovery and
 * for confirmation both. The refusal to go further was three lines of React
 * state, and nothing on the server knew the session was mid-recovery, so an
 * attacker who reached an admin's mail never had to argue with the component:
 * they typed /admin in the address bar and the console rendered, because
 * requireAdmin resolved a real owner from a real token.
 *
 * The shared inbox seeded as owner makes that reachable by anyone ever
 * forwarded a thread from partnerships, and GoTrue's recover endpoint is
 * mounted on this domain and live whether or not anything links to it.
 *
 * Asserted on the source, because the hole is the absence of a call on a path,
 * and the browser half of Identity cannot be exercised in this suite.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "components/admin/admin-login.tsx"),
  "utf8",
);

/** The body of the callback effect, with comments stripped. */
const callbackBody = (() => {
  const start = SOURCE.indexOf("const result = await handleAuthCallback()");
  const end = SOURCE.indexOf("async function submit");
  return SOURCE.slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
})();

/** Each branch of the callback, keyed by the type it handles. */
function branch(type: string): string {
  const at = callbackBody.indexOf(`result.type === "${type}"`);
  if (at === -1) return "";
  const next = callbackBody.indexOf("if (result.type", at + 1);
  return callbackBody.slice(at, next === -1 ? undefined : next);
}

describe("every callback type that establishes a session", () => {
  /**
   * Recovery and confirmation both sign the browser in. An invite does not,
   * which is why it is not in this list: it carries a token and no session.
   */
  for (const type of ["recovery", "confirmation"]) {
    it(`drops the server visible cookies on ${type}`, () => {
      expect(
        branch(type),
        `a ${type} link leaves nf_jwt set for the whole origin, so typing /admin reaches the console`,
      ).toContain("dropServerVisibleSession()");
    });
  }

  it("drops them for an unrecognised type too", () => {
    // Two of the three known types establish a session, so a new one is more
    // likely to than not, and being wrong in this direction costs nothing.
    const tail = callbackBody.slice(callbackBody.indexOf("not one we recognise") - 400);
    expect(tail).toContain("dropServerVisibleSession()");
  });

  it("clears both cookies, since one mints the other", () => {
    const fn = SOURCE.slice(SOURCE.indexOf("function dropServerVisibleSession"));
    expect(fn.slice(0, 500)).toContain("nf_jwt");
    expect(fn.slice(0, 500)).toContain("nf_refresh");
  });
});

describe("finishing a recovery", () => {
  const submit = SOURCE.slice(SOURCE.indexOf("async function submit"));

  it("ends the session after the password is changed", () => {
    const recovery = submit.slice(
      submit.indexOf("} else if (recovering) {"),
      submit.indexOf("} else {", submit.indexOf("} else if (recovering) {")),
    );
    expect(recovery).toContain("logout()");
  });

  it("does not send them straight to the console", () => {
    const recovery = submit.slice(
      submit.indexOf("} else if (recovering) {"),
      submit.indexOf("} else {", submit.indexOf("} else if (recovering) {")),
    );
    expect(
      recovery.includes('window.location.href = "/admin"'),
      "holding the link alone must never be enough to reach the queue",
    ).toBe(false);
  });
});
