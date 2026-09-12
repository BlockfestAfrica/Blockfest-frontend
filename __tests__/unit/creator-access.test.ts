/**
 * The creator access token.
 *
 * It is the only thing standing between a stranger and somebody's campaign
 * page, and shortly their entry submissions, so the properties worth asserting
 * are the ones that would fail silently: that it is actually random, that what
 * we store cannot be replayed, and that a malformed value never reaches a query.
 */

import { describe, expect, it } from "vitest";
import {
  accessTokenMatches,
  hashAccessToken,
  looksLikeAccessToken,
  newAccessToken,
} from "@/lib/creator-access";

describe("minting", () => {
  it("does not repeat itself", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) seen.add(newAccessToken());
    expect(seen.size).toBe(2000);
  });

  it("is long enough that guessing is not a threat model", () => {
    // 32 bytes as base64url. Shortening this is the kind of change that looks
    // cosmetic and is not.
    const token = newAccessToken();
    expect(token).toHaveLength(43);
  });

  it("survives a URL, a cookie and a message unchanged", () => {
    for (let i = 0; i < 200; i += 1) {
      const token = newAccessToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encodeURIComponent(token)).toBe(token);
    }
  });
});

describe("what gets stored", () => {
  it("is a hash, not the token", () => {
    const token = newAccessToken();
    const stored = hashAccessToken(token);
    expect(stored).not.toBe(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cannot be turned back into the token", () => {
    // Not a proof, but it does assert the obvious regression: somebody
    // "simplifying" the hash into a reversible encoding.
    const token = newAccessToken();
    const stored = hashAccessToken(token);
    expect(Buffer.from(stored, "hex").toString("base64url")).not.toBe(token);
    expect(stored).not.toContain(token);
  });

  it("is stable, so the lookup finds the same row every time", () => {
    const token = newAccessToken();
    expect(hashAccessToken(token)).toBe(hashAccessToken(token));
  });

  it("differs completely for tokens that differ by one character", () => {
    const a = "a".repeat(43);
    const b = `${"a".repeat(42)}b`;
    expect(hashAccessToken(a)).not.toBe(hashAccessToken(b));
  });
});

describe("comparison", () => {
  it("accepts a match and rejects a mismatch", () => {
    const token = newAccessToken();
    expect(accessTokenMatches(hashAccessToken(token), hashAccessToken(token))).toBe(
      true,
    );
    expect(
      accessTokenMatches(hashAccessToken(token), hashAccessToken(newAccessToken())),
    ).toBe(false);
  });

  it("does not throw on different lengths", () => {
    // timingSafeEqual throws when the buffers differ in length, which would
    // turn a malformed cookie into a 500.
    expect(() => accessTokenMatches("short", "much longer value")).not.toThrow();
    expect(accessTokenMatches("short", "much longer value")).toBe(false);
  });
});

describe("shape checking, before anything reaches the database", () => {
  it("accepts what we mint", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(looksLikeAccessToken(newAccessToken())).toBe(true);
    }
  });

  it.each([
    ["", "empty"],
    ["short", "too short"],
    ["a".repeat(42), "one short"],
    ["a".repeat(44), "one long"],
    ["a".repeat(42) + "+", "not base64url"],
    ["a".repeat(42) + "/", "not base64url"],
    ["' OR 1=1 --", "an injection attempt"],
    ["../../etc/passwd", "a traversal attempt"],
  ])("rejects %o (%s)", (value) => {
    expect(looksLikeAccessToken(value)).toBe(false);
  });

  it.each([[null], [undefined], [123], [{}], [[]], [true]])(
    "rejects the non-string %o",
    (value) => {
      expect(looksLikeAccessToken(value)).toBe(false);
    },
  );
});
