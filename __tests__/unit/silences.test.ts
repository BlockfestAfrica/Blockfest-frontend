/**
 * The three decisions that took something away and told nobody.
 *
 * The flow audit's admin matrix: eleven actions notify the affected
 * creator, three are correctly silent, and these were silent when they
 * should not have been. The worst is disqualification, where somebody
 * could lose a week's work to a decision they were never told about.
 */

import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  disqualifiedEmail,
  resumedEmail,
  personalPage,
} from "@/lib/email/templates";

const ORIGINAL = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://blockfestafrica.com";
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("the disqualification notice", () => {
  const mail = (over = {}) =>
    disqualifiedEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      reason: "Bought engagement on two entries, evidence in the review thread",
      pointsReversed: 250,
      personalPage: personalPage(),
      ...over,
    });

  it("carries the recorded reason, which is the thing being appealed", () => {
    expect(mail().text).toContain("Bought engagement on two entries");
  });

  it("states the points reversed, and says nothing when none were", () => {
    expect(mail().text).toContain("250 points");
    expect(mail({ pointsReversed: 0 }).text).not.toMatch(/points those entries/);
  });

  it("names the appeal path and tells them to stop submitting", () => {
    const m = mail();
    expect(m.text).toMatch(/reply to this email/i);
    expect(m.text).toMatch(/do not keep submitting/i);
  });

  it("escapes a reason written by an admin", () => {
    const m = mail({ reason: "<img src=x onerror=alert(1)>" });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img");
  });
});

describe("the resume notice", () => {
  it("says submissions are open and carries the deadline when there is one", () => {
    const m = resumedEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      closesAtLagos: "Saturday, 3 October, 12:00 pm",
      personalPage: personalPage(),
    });
    expect(m.subject).toBe("Submissions are open again");
    expect(m.text).toContain("Saturday, 3 October, 12:00 pm");
  });

  it("omits the deadline line rather than printing an empty one", () => {
    const m = resumedEmail({
      to: "creator@example.com",
      fullName: "Amara Obi",
      closesAtLagos: null,
      personalPage: personalPage(),
    });
    expect(m.text).not.toMatch(/closes\s*,/i);
    expect(m.text).toContain("open again");
  });
});
