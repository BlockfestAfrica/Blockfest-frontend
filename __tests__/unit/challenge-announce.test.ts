/**
 * The one email the campaign promised and never sent.
 *
 * Every other template fires because a creator acted, or because an admin
 * acted on one creator. None fired because the CAMPAIGN moved, so "a new
 * challenge drops with every stage" was delivered by no channel at all.
 * These pin the template's contract and the two properties that make a
 * bulk send safe: it carries no credential, and it cannot go twice.
 */

import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { challengeLiveEmail, personalPage } from "@/lib/email/templates";

const ORIGINAL = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://blockfestafrica.com";
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

const mail = (over: Partial<Parameters<typeof challengeLiveEmail>[0]> = {}) =>
  challengeLiveEmail({
    to: "creator@example.com",
    fullName: "Amara Obi",
    weekNo: 2,
    title: "The Problem",
    question: "Why is money still this complicated?",
    brief: "Tell a real story about money friction.\n\nSecond paragraph that the email trims away.",
    basePoints: 100,
    closesAtLagos: "Saturday, 3 October, 12:00 pm",
    pageUrl: personalPage(),
    ...over,
  });

describe("the stage announcement", () => {
  it("names the stage, the deadline and the points", () => {
    const m = mail();
    expect(m.subject).toBe("Stage 2 is live: The Problem");
    expect(m.text).toContain("Saturday, 3 October, 12:00 pm");
    expect(m.text).toContain("100 points");
  });

  it("carries no credential, because none can be rebuilt", () => {
    // Only a hash of each token is stored, so a bulk sender cannot
    // reconstruct a personal link even if it wanted to. The mail points
    // at the tokenless page; the locked screen handles anyone signed out.
    const m = mail();
    expect(m.text).toContain(personalPage());
    expect(m.text).not.toMatch(/\?t=/);
    expect(m.html).not.toMatch(/\?t=/);
  });

  it("opens with the admin's own words, not a registry copy", () => {
    const m = mail();
    expect(m.text).toContain("Tell a real story about money friction.");
    expect(m.text).not.toContain("Second paragraph");
  });

  it("falls back to the title when the console wrote no question line", () => {
    const m = mail({ question: null });
    expect(m.text).toContain("The Problem");
  });

  it("escapes a brief that carries markup", () => {
    const m = mail({ brief: "<script>alert(1)</script> make something" });
    expect(m.html).not.toContain("<script>alert(1)</script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
});
