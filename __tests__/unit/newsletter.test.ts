/**
 * Tests for the Substack feed reader.
 *
 * This is the only code on the site that parses input we do not control, and it
 * runs on a live page. If Substack changes the feed shape the page degrades
 * silently, so these assert against a real captured feed rather than a
 * hand-written one.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNewsletterPosts } from "@/lib/newsletter";

const FIXTURE = readFileSync(
  join(process.cwd(), "__tests__/fixtures/substack-feed.xml"),
  "utf8"
);

function mockFeed(body: string, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, text: async () => body })
  );
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.restoreAllMocks());

describe("getNewsletterPosts", () => {
  it("parses every real issue out of the feed", async () => {
    mockFeed(FIXTURE);
    const posts = await getNewsletterPosts();
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.title).toBeTruthy();
      expect(post.url).toMatch(/^https:\/\/blockfest\.substack\.com\/p\//);
      expect(post.excerpt).toBeTruthy();
      expect(post.readingMinutes).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns issues newest first", async () => {
    mockFeed(FIXTURE);
    const dates = (await getNewsletterPosts()).map((p) =>
      new Date(p.date).getTime()
    );
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it("sorts even when the feed arrives out of order", async () => {
    const items = FIXTURE.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const shuffled = FIXTURE.replace(
      /<item>[\s\S]*<\/item>/,
      [...items].reverse().join("")
    );
    mockFeed(shuffled);
    const dates = (await getNewsletterPosts()).map((p) =>
      new Date(p.date).getTime()
    );
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("drops the short Substack placeholder posts", async () => {
    mockFeed(FIXTURE);
    const titles = (await getNewsletterPosts()).map((p) => p.title);
    expect(titles).not.toContain("Coming soon");
  });

  it("strips the standing salutation from excerpts", async () => {
    mockFeed(FIXTURE);
    for (const post of await getNewsletterPosts()) {
      expect(post.excerpt.startsWith("Hey Blockers")).toBe(false);
      expect(post.longExcerpt.startsWith("Hey Blockers")).toBe(false);
    }
  });

  it("keeps excerpts within their budgets, long one longer", async () => {
    mockFeed(FIXTURE);
    for (const post of await getNewsletterPosts()) {
      expect(post.excerpt.length).toBeLessThanOrEqual(181);
      expect(post.longExcerpt.length).toBeLessThanOrEqual(321);
      expect(post.longExcerpt.length).toBeGreaterThanOrEqual(
        post.excerpt.length
      );
    }
  });

  it("decodes HTML entities rather than showing them raw", async () => {
    mockFeed(FIXTURE);
    for (const post of await getNewsletterPosts()) {
      expect(post.title).not.toMatch(/&(amp|#8217|quot|nbsp|#39);/);
      expect(post.excerpt).not.toMatch(/&(amp|#8217|quot|nbsp|#39);/);
      expect(post.excerpt).not.toMatch(/<[a-z]/i);
    }
  });

  it("requests a card-sized cover instead of the full-width original", async () => {
    mockFeed(FIXTURE);
    const covers = (await getNewsletterPosts())
      .map((p) => p.coverImage)
      .filter(Boolean) as string[];
    expect(covers.length).toBeGreaterThan(0);
    for (const url of covers) {
      expect(url).toContain("w_640");
      expect(url).not.toContain("w_1456");
    }
  });

  it("leaves an unrecognised cover URL untouched rather than mangling it", async () => {
    const odd = FIXTURE.replace(
      /<enclosure url="[^"]+"/,
      '<enclosure url="https://example.com/plain.png"'
    );
    mockFeed(odd);
    const posts = await getNewsletterPosts();
    expect(posts[0].coverImage).toBe("https://example.com/plain.png");
  });

  it("exposes a machine date and a human date that agree", async () => {
    mockFeed(FIXTURE);
    for (const post of await getNewsletterPosts()) {
      expect(() => new Date(post.date).toISOString()).not.toThrow();
      const year = new Date(post.date).getUTCFullYear();
      expect(post.displayDate).toContain(String(year));
    }
  });

  it("skips items missing a title, link or date", async () => {
    const broken = FIXTURE.replace(/<link>[^<]*<\/link>/, "");
    mockFeed(broken);
    const posts = await getNewsletterPosts();
    for (const post of posts) expect(post.url).toBeTruthy();
  });

  it("survives an unparseable date", async () => {
    const bad = FIXTURE.replace(
      /<pubDate>[^<]*<\/pubDate>/,
      "<pubDate>not a date</pubDate>"
    );
    mockFeed(bad);
    await expect(getNewsletterPosts()).resolves.toBeInstanceOf(Array);
  });

  it("returns an empty list when Substack answers with an error", async () => {
    mockFeed("", false);
    expect(await getNewsletterPosts()).toEqual([]);
  });

  it("returns an empty list rather than throwing when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await getNewsletterPosts()).toEqual([]);
  });

  it("returns an empty list for a feed with no items", async () => {
    mockFeed("<rss><channel><title>Empty</title></channel></rss>");
    expect(await getNewsletterPosts()).toEqual([]);
  });

  it("caches the feed rather than refetching on every request", async () => {
    mockFeed(FIXTURE);
    await getNewsletterPosts();
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toMatchObject({ next: { revalidate: expect.any(Number) } });
    expect(call[1].next.revalidate).toBeGreaterThan(0);
  });
});
