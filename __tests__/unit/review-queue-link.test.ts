import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openableHref } from "@/lib/admin/openable-href";

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

/*
 * The shipped guard itself. It used to be copied into this file because it
 * lived inside a client component; it is its own module now, shared by the
 * queue and the Decided page, so the test exercises the real one and cannot
 * drift from it.
 */
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

describe("the Decided page's link", () => {
  const decided = readFileSync(
    join(process.cwd(), "components/admin/decided-list.tsx"),
    "utf8",
  );

  it("goes through the same guard as the queue, not a copy of it", () => {
    expect(decided).toContain('from "@/lib/admin/openable-href"');
    expect(decided).toMatch(/openableHref\(item\.url\)/);
    // No second allowlist that could drift from the shared one.
    expect(decided).not.toContain("LINKABLE_HOSTS");
    expect(source).not.toContain("LINKABLE_HOSTS = [");
  });

  it("opens in a new tab with the tab-nabbing and referrer paths closed", () => {
    expect(decided).toContain('target="_blank"');
    expect(decided).toContain('rel="noopener noreferrer nofollow"');
  });

  it("falls back to text, and shows the whole URL either way", () => {
    expect(decided).toContain("<code");
    const branch = decided.slice(
      decided.indexOf("{href ? ("),
      decided.indexOf("</code>"),
    );
    expect(branch, "found the render branch").not.toBe("");
    const classes = [...branch.matchAll(/className="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((cls) => cls !== "sr-only");
    expect(classes.length).toBeGreaterThanOrEqual(2);
    for (const cls of classes) {
      expect(cls, cls).toContain("break-all");
      expect(cls, cls).not.toContain("truncate");
    }
  });
});
