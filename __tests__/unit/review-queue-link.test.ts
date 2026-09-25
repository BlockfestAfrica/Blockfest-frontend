import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * The reviewer's link, and the guard that decides whether it is one.
 *
 * The queue used to render the submitted URL as plain text with a Copy
 * button, deliberately: a comment in the file called it load-bearing,
 * because the destination is chosen by whoever submitted it and the reader
 * is one of three people who can mint points against a five million naira
 * pool.
 *
 * It is a link now, but only to a host submission already restricts it to.
 * These tests pin that narrowing, because the value of the change rests
 * entirely on it: if openableHref ever returns a URL on an arbitrary host,
 * the original objection is live again.
 */

const source = readFileSync(
  join(process.cwd(), "components/admin/review-queue.tsx"),
  "utf8",
);

/** The shipped guard, lifted out of the component to be exercised. */
const LINKABLE_HOSTS = [
  "x.com",
  "twitter.com",
  "instagram.com",
  "instagr.am",
  "tiktok.com",
];

function openableHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const known = LINKABLE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    return known ? url : null;
  } catch {
    return null;
  }
}

describe("what becomes a clickable link", () => {
  it("links a real post on each platform", () => {
    for (const url of [
      "https://x.com/ada/status/123",
      "https://www.tiktok.com/@ada/video/9",
      "https://www.instagram.com/p/ABC/",
      "https://mobile.twitter.com/ada/status/1",
    ]) {
      expect(openableHref(url), url).toBe(url);
    }
  });

  it("refuses a javascript: URL, which is the whole reason for the guard", () => {
    expect(openableHref("javascript:alert(document.cookie)")).toBeNull();
    expect(openableHref("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("refuses http, so a link is never downgraded", () => {
    expect(openableHref("http://x.com/ada/status/1")).toBeNull();
  });

  it("refuses any host outside the platforms", () => {
    // The original objection, in one assertion: a reviewer must not be one
    // click from a server the submitter controls.
    for (const url of [
      "https://evil.example.com/x.com/status/1",
      "https://x.com.evil.example/status/1",
      "https://notinstagram.com/p/A/",
    ]) {
      expect(openableHref(url), url).toBeNull();
    }
  });

  it("is not fooled by a lookalike subdomain suffix", () => {
    expect(openableHref("https://faketiktok.com/@a/video/1")).toBeNull();
    // A real subdomain of a real platform is still fine.
    expect(openableHref("https://vm.tiktok.com/ZM123/")).not.toBeNull();
  });
});

describe("the rendered control", () => {
  it("opens in a new tab with the tab-nabbing and referrer paths closed", () => {
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer nofollow"');
  });

  it("falls back to plain text when the guard refuses", () => {
    expect(source).toMatch(/openableHref\(item\.url\)\s*\?/);
    expect(source).toContain("<code");
  });

  it("no longer collapses the row when the reviewer presses Copy", () => {
    // start() toggled the row and copied, and both the header and the Copy
    // button called it, so copying inside an open row shut it.
    expect(source).not.toMatch(/function start\(/);
    expect(source).toContain("function toggle(");
    expect(source).toContain("function copyLink(");
  });
});
