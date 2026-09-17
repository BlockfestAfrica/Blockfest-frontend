/**
 * The dead end a mistyped handle used to be.
 *
 * A creator who fat-fingers their own X username at registration then submits
 * a real post from the real account and is refused, correctly: the post is not
 * from the account on file. The old message said exactly that and stopped,
 * which reads as the system being wrong about their own post and leaves them
 * nowhere to go.
 *
 * The refusal stays. What changed is that it names both handles, so a typo is
 * obvious in a second, and says how to get it corrected.
 *
 * Corrections are deliberately not self-service: a creator who can edit a
 * handle freely can point it at somebody else's account and claim their posts,
 * which is the attribution the handle exists to protect.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "app/api/campaigns/monica/submit/route.ts"),
  "utf8",
);

const branch = (() => {
  const at = SOURCE.indexOf('PG.WRONG_ACCOUNT');
  return SOURCE.slice(at, SOURCE.indexOf("if (isPgError", at + 1));
})();

describe("the wrong-account refusal", () => {
  it("names the handle we hold", () => {
    // Without it the creator cannot see their own typo.
    expect(branch).toContain("handlesForEnrolment");
    expect(branch).toMatch(/registered/);
  });

  it("names the handle in the link", () => {
    expect(branch).toContain("authorFromUrl");
  });

  it("says how to get a wrong registration corrected", () => {
    // The sentence that was missing entirely. It pointed at an email address
    // first; now it points at the request flow on the same page, where the
    // team reviews and approves by hand. Both the specific and the fallback
    // message carry it, because the specific one needs both handles to have
    // resolved and the fallback runs when they have not.
    const routes = branch.match(/Your accounts/g) ?? [];
    expect(routes.length, "on both the specific and the fallback message").toBe(2);
  });

  it("still refuses the submission", () => {
    // The guard is correct and stays. This is about the sentence, not the rule:
    // accepting a post from an unregistered account is how somebody claims
    // another creator's work.
    expect(branch).toContain("409");
  });

  it("falls back to a message that works when the lookup fails", () => {
    // A database blip on the error path must not turn a clear refusal into a
    // crash or an empty string.
    expect(branch).toContain("catch");
    expect(branch).toMatch(/registered && claimed/);
  });
});
