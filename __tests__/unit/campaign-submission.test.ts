/**
 * What a creator is allowed to submit.
 *
 * The link is the whole entry, because nothing is hosted here. So a wrong link
 * is not a validation nicety: it is an entry that cannot be reviewed, found out
 * days later, when the week has closed and there is nothing to be done.
 *
 * The mistake worth catching is the one that is invisible to the person making
 * it. Pasting a bad address is obvious. Picking the wrong platform from a
 * dropdown and pasting a perfectly good link is not, and it looks completely
 * correct on screen.
 */

import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  hostMatchesPlatform,
  submissionSchema,
} from "@/lib/campaign-submission";

const ok = (platform: string, url: string) =>
  submissionSchema.safeParse({ platform, url }).success;

const errorFor = (platform: string, url: string) => {
  const r = submissionSchema.safeParse({ platform, url });
  return r.success ? null : r.error.issues[0];
};

/*
 * vm./vt.tiktok.com share links were accepted here until the day-one audit:
 * they hide the author, so the ownership check never ran on them, and they
 * minted a URL-shaped post identity distinct from the canonical video,
 * worth a second credit. They are refused now, in the authored-form
 * describe below, and the message tells the creator which link to paste.
 */
describe("links a real share sheet produces", () => {
  it.each([
    ["x", "https://x.com/adacreates/status/1234567890"],
    ["x", "https://twitter.com/adacreates/status/1234567890"],
    ["x", "https://mobile.twitter.com/adacreates/status/1"],
    ["instagram", "https://www.instagram.com/p/Cabcdef/"],
    ["instagram", "https://instagram.com/reel/Cabcdef/"],
    ["tiktok", "https://www.tiktok.com/@ada/video/7211"],
  ])("accepts %s: %s", (platform, url) => {
    expect(ok(platform, url)).toBe(true);
  });
});

describe("the mistake nobody can see themselves make", () => {
  it("catches a TikTok link filed under Instagram", () => {
    const issue = errorFor("instagram", "https://www.tiktok.com/@ada/video/7211");
    expect(issue?.message).toMatch(/does not match the platform/i);
  });

  it("names the link, since that is the field they will fix", () => {
    const issue = errorFor("instagram", "https://www.tiktok.com/@ada/video/7211");
    expect(issue?.path[0]).toBe("url");
  });

  it("catches an X link filed under TikTok", () => {
    expect(ok("tiktok", "https://x.com/ada/status/1")).toBe(false);
  });

  it("refuses a link to somewhere else entirely", () => {
    expect(ok("x", "https://example.com/not-a-post")).toBe(false);
  });

  it("is not fooled by the platform name appearing in the path", () => {
    // The check is on the host, so a path can say anything it likes.
    expect(ok("x", "https://example.com/x.com/status/1")).toBe(false);
  });

  it("is not fooled by the platform name in a subdomain of somewhere else", () => {
    expect(ok("x", "https://x.com.evil.example/status/1")).toBe(false);
  });
});

describe("links that are not links", () => {
  it.each([
    ["", "empty"],
    ["not a url", "prose"],
    ["x.com/ada/status/1", "no scheme"],
    ["http://x.com/ada/status/1", "plain http"],
    ["javascript:alert(1)", "a script scheme"],
    ["ftp://x.com/a", "the wrong scheme"],
  ])("refuses %o (%s)", (url) => {
    expect(ok("x", url)).toBe(false);
  });

  it("refuses an absurdly long one", () => {
    expect(ok("x", `https://x.com/${"a".repeat(600)}`)).toBe(false);
  });
});

describe("canonicalising", () => {
  /**
   * Two creators sharing the same post produce different strings for it, and
   * the uniqueness index compares strings. Without stripping the tail, an
   * Instagram tracking parameter is enough to submit somebody else's post
   * alongside theirs and have both look distinct.
   */
  it("makes two share-sheet forms of the same post identical", () => {
    const a = canonicalUrl("https://www.instagram.com/p/Cabcdef/?igsh=MzRlODBiNWFlZA==");
    const b = canonicalUrl("https://instagram.com/p/Cabcdef/");
    expect(a).toBe(b);
  });

  it("strips a fragment", () => {
    expect(canonicalUrl("https://x.com/a/status/1#top")).toBe(
      "https://x.com/a/status/1",
    );
  });

  it("strips utm parameters", () => {
    expect(canonicalUrl("https://x.com/a/status/1?utm_source=share")).toBe(
      "https://x.com/a/status/1",
    );
  });

  it("keeps the path, because on these platforms the path is the post", () => {
    expect(canonicalUrl("https://www.tiktok.com/@ada/video/7211")).toContain(
      "/@ada/video/7211",
    );
  });

  it("does not merge two genuinely different posts", () => {
    expect(canonicalUrl("https://x.com/a/status/1")).not.toBe(
      canonicalUrl("https://x.com/a/status/2"),
    );
  });

  it("leaves something unparseable alone rather than mangling it", () => {
    expect(canonicalUrl("  not a url  ")).toBe("not a url");
  });
});

describe("host matching on its own", () => {
  it("accepts a subdomain of a known host", () => {
    expect(hostMatchesPlatform("https://m.tiktok.com/@a/video/1", "tiktok")).toBe(
      true,
    );
  });

  it("ignores case in the host", () => {
    expect(hostMatchesPlatform("https://X.COM/a/status/1", "x")).toBe(true);
  });

  it("returns false rather than throwing on rubbish", () => {
    expect(() => hostMatchesPlatform("::::", "x")).not.toThrow();
    expect(hostMatchesPlatform("::::", "x")).toBe(false);
  });
});

describe("the authored-form requirement", () => {
  const parse = (platform: string, url: string) =>
    submissionSchema.safeParse({ platform, url });

  it("refuses an authorless X link", () => {
    expect(parse("x", "https://x.com/i/status/1234567890").success).toBe(false);
  });

  it("refuses a TikTok share link that hides the author", () => {
    expect(parse("tiktok", "https://vt.tiktok.com/ZSqxCpWFD").success).toBe(
      false,
    );
  });

  it("accepts the canonical authored forms", () => {
    expect(
      parse("x", "https://x.com/somebody/status/1234567890").success,
    ).toBe(true);
    expect(
      parse("tiktok", "https://www.tiktok.com/@somebody/video/123456").success,
    ).toBe(true);
  });

  it("leaves Instagram alone, whose links never name the author", () => {
    expect(
      parse("instagram", "https://instagram.com/p/DZ2bSUMIWpr").success,
    ).toBe(true);
  });
});

describe("percent-encoded spellings of one post", () => {
  it("collapses an encoded id to the plain form", () => {
    expect(canonicalUrl("https://x.com/ada/status/12%339")).toBe(
      canonicalUrl("https://x.com/ada/status/1239"),
    );
  });

  it("collapses an encoded handle the same way", () => {
    expect(canonicalUrl("https://x.com/%61da/status/1239")).toBe(
      "https://x.com/ada/status/1239",
    );
  });

  it("unwinds double encoding to the same single spelling", () => {
    expect(canonicalUrl("https://x.com/ada/status/123%2539")).toBe(
      "https://x.com/ada/status/1239",
    );
  });

  it("leaves a malformed escape alone rather than throwing", () => {
    expect(() => canonicalUrl("https://x.com/ada/status/12%ZZ")).not.toThrow();
  });

  it("still strips query, fragment and the trailing slash", () => {
    expect(
      canonicalUrl("https://x.com/ada/status/1239/?utm_source=share#top"),
    ).toBe("https://x.com/ada/status/1239");
  });
});

/*
 * Spellings that decode into a path no parser saw.
 *
 * Decoding runs after the URL parser has resolved the path, so
 * 888%2F..%2F..%2Fstatus/555 used to store as /888/../../status/555. The
 * reviewer's browser and the ownership check read that as post 555, and
 * post_identity_of, which takes the first id in the stored text, read 888.
 * Uniqueness and the already-credited checks were keyed on a post nobody
 * opened: the creator's own approved post could be paid again under a fresh
 * identity, or a rival's id held so their own filing was refused. Every row
 * here was accepted, and each is a different way to make the stored text and
 * the opened page disagree.
 */
describe("spellings whose stored form opens a different post", () => {
  it.each([
    ["x", "https://x.com/me/status/888%2F..%2F..%2Fstatus/555", "an encoded slash that builds ../"],
    ["x", "https://x.com/me/status/888/%252e%252e/%252e%252e/status/555", "double-encoded dots"],
    ["x", "https://x.com/me/status/888%5C..%5C..%5Cstatus%5C555", "encoded backslashes"],
    ["x", "https://x.com/me/%23/status/888", "an encoded # that hides the id from the browser"],
    ["x", "https://x.com/me/%3Fstatus/888", "an encoded ? that hides the id from the browser"],
    ["x", "https://x.com/me/status/8%0988", "an encoded tab the parser drops"],
    ["x", "https://x.com/me%2Fstatus%2F555", "an encoded slash that adds segments"],
    ["x", "https://x.com/me/status/888%2F..%2F..%2Fstatus/555%ZZ", "a malformed escape that stops decoding"],
    ["instagram", "https://instagram.com/p/RIVAL%2F..%2F..%2Fp%2FOWN", "the same trick on Instagram"],
    ["tiktok", "https://tiktok.com/@me/video/888%2F..%2F..%2Fvideo/555", "the same trick on TikTok"],
  ])("refuses %s: %s (%s)", (platform, url) => {
    const issue = errorFor(platform, url);
    expect(issue?.message).toMatch(/copy the link again/i);
    expect(issue?.path[0]).toBe("url");
  });

  it("still accepts every spelling it collapsed before", () => {
    for (const url of [
      "https://x.com/ada/status/12%339",
      "https://x.com/%61da/status/1239",
      "https://x.com/ada/status/123%2539",
      "https://x.com/ada/status/1239/?utm_source=share#top",
      "https://x.com//ada/status/1239",
    ]) {
      expect(ok("x", url), url).toBe(true);
    }
  });

  it("accepts trailing noise that opens the same post", () => {
    // A trailing encoded space from a hand-built hyperlink, or a doubled
    // slash, changed again on a second pass and was refused as tampering.
    for (const [platform, url, stored] of [
      ["x", "https://x.com/ada/status/1239%20", "https://x.com/ada/status/1239"],
      ["x", "https://x.com/ada/status/1239%C2%A0", "https://x.com/ada/status/1239"],
      ["x", "https://x.com/ada/status/1239/%20/", "https://x.com/ada/status/1239"],
      ["tiktok", "https://www.tiktok.com/@ada.b/video/7211//", "https://tiktok.com/@ada.b/video/7211"],
      ["instagram", "https://www.instagram.com/reel/Cabcdef//", "https://instagram.com/reel/Cabcdef"],
    ]) {
      expect(ok(platform, url), url).toBe(true);
      expect(canonicalUrl(url), url).toBe(stored);
      expect(canonicalUrl(stored), url).toBe(stored);
    }
  });

  it("stores only a form that reads back as itself", () => {
    // What the reviewer opens is what the identity was computed from.
    for (const [platform, url] of [
      ["x", "https://twitter.com/Ada/status/1234567890?s=20"],
      ["x", "https://x.com/ada/status/12%339/"],
      ["instagram", "https://www.instagram.com/reel/Cabcdef/?igsh=MzRlODBiNWFlZA=="],
      ["tiktok", "https://www.tiktok.com/@ada.b/video/7211?is_from_webapp=1"],
    ]) {
      expect(ok(platform, url), url).toBe(true);
      const stored = canonicalUrl(url);
      expect(canonicalUrl(stored), url).toBe(stored);
      expect(new URL(stored).pathname, url).toBe(stored.replace(/^https:\/\/[^/]+/, ""));
    }
  });
});
