/**
 * Tests for the vote flow's shared pieces.
 *
 * The engine in migration 0046 enforces the rules; what these helpers carry
 * is the agreement between the cast route and the verify route. Both sides
 * must hash the same code to the same string, judge the same domains exempt
 * from the cap, and accept the same addresses, because a mismatch between
 * them does not error: it silently makes every code invalid, which reads as
 * every voter mistyping.
 */

import { describe, expect, it } from "vitest";
import {
  ALLOWLISTED_DOMAINS,
  DOMAIN_CAP,
  hashCode,
  hashIp,
  isAllowlisted,
  sixDigitCode,
  voteEmailSchema,
} from "@/lib/campaign-vote";

describe("voteEmailSchema", () => {
  it("normalises the address the way registration does", () => {
    // Same trim and lowercase as the registration field, so the address the
    // voter typed and the one the code is hashed against cannot diverge on
    // whitespace or case.
    expect(voteEmailSchema.parse("  Someone@Example.COM  ")).toBe(
      "someone@example.com",
    );
  });

  it("keeps a plus tag; canonicalisation is the engine's concern", () => {
    // The schema validates shape only. Folding a.b+tag@gmail.com onto its
    // canonical mailbox is canonicalEmail's job in the routes, and doing it
    // here too would mail the code to an address nobody owns.
    expect(voteEmailSchema.parse("a.b+vote@gmail.com")).toBe(
      "a.b+vote@gmail.com",
    );
  });

  it("rejects what is not an address", () => {
    expect(voteEmailSchema.safeParse("not-an-email").success).toBe(false);
    expect(voteEmailSchema.safeParse("").success).toBe(false);
    expect(voteEmailSchema.safeParse("someone@").success).toBe(false);
  });

  it("rejects an address past the RFC ceiling", () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect(long.length).toBeGreaterThan(254);
    expect(voteEmailSchema.safeParse(long).success).toBe(false);
  });
});

describe("sixDigitCode", () => {
  it("is always exactly six digits, leading zeros included", () => {
    // padStart is what this holds: one draw in ten below 100000 would
    // otherwise arrive as five digits and fail the input's own pattern.
    for (let i = 0; i < 500; i++) {
      expect(sixDigitCode()).toMatch(/^\d{6}$/);
    }
  });

  it("varies between draws", () => {
    // Five hundred draws from a million values collapsing to a handful
    // would mean the generator is broken, not unlucky.
    const draws = new Set(Array.from({ length: 500 }, () => sixDigitCode()));
    expect(draws.size).toBeGreaterThan(400);
  });
});

describe("hashCode", () => {
  it("is stable for the same email and code", () => {
    // The cast route writes the hash and the verify route recomputes it;
    // any instability here reads to a voter as a wrong code.
    expect(hashCode("someone@example.com", "123456")).toBe(
      hashCode("someone@example.com", "123456"),
    );
  });

  it("is a sha256 hex digest, never the code itself", () => {
    expect(hashCode("someone@example.com", "123456")).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("changes with the code", () => {
    expect(hashCode("someone@example.com", "123456")).not.toBe(
      hashCode("someone@example.com", "123457"),
    );
  });

  it("is bound to the email, not just the code", () => {
    // The property that stops a code mailed to one inbox verifying a vote
    // cast under another address that happened to draw the same digits.
    expect(hashCode("someone@example.com", "123456")).not.toBe(
      hashCode("other@example.com", "123456"),
    );
  });
});

describe("hashIp", () => {
  it("is a stable sha256 hex digest of the address", () => {
    expect(hashIp("102.89.32.10")).toBe(hashIp("102.89.32.10"));
    expect(hashIp("102.89.32.10")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("102.89.32.10")).not.toBe(hashIp("102.89.32.11"));
  });

  it("hashes an absent address as the empty string", () => {
    // An absent header means the platform changed, not evasion. The keys
    // and the cast payload stay well formed either way, and every no-ip
    // request lands in the same bucket rather than crashing the route.
    expect(hashIp(null)).toBe(hashIp(undefined));
    expect(hashIp(null)).toBe(hashIp(""));
    expect(hashIp(null)).not.toBe(hashIp("102.89.32.10"));
  });
});

describe("the domain allowlist", () => {
  it("holds exactly the consumer providers the scope names", () => {
    expect([...ALLOWLISTED_DOMAINS].sort()).toEqual(
      [
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "icloud.com",
        "proton.me",
        "protonmail.com",
      ].sort(),
    );
  });

  it("caps a non-allowlisted domain at ten counted votes", () => {
    expect(DOMAIN_CAP).toBe(10);
  });

  it("exempts every allowlisted provider", () => {
    for (const domain of ALLOWLISTED_DOMAINS) {
      expect(isAllowlisted(`voter@${domain}`)).toBe(true);
    }
  });

  it("does not exempt a corporate or catch-all domain", () => {
    // The whole reason the cap exists: a catch-all domain makes "one inbox,
    // one vote" purchasable in bulk, so it must not slip past as consumer.
    expect(isAllowlisted("voter@some-company.com")).toBe(false);
    expect(isAllowlisted("voter@votes.example.org")).toBe(false);
  });

  it("does not exempt a subdomain of an allowlisted provider", () => {
    // mail.gmail.com is not gmail.com. A suffix match would let anyone mint
    // an exempt domain by registering something-gmail-shaped.
    expect(isAllowlisted("voter@mail.gmail.com")).toBe(false);
  });

  it("folds case defensively even though input is canonical", () => {
    expect(isAllowlisted("voter@GMAIL.COM")).toBe(true);
  });

  it("refuses a string with no domain at all", () => {
    expect(isAllowlisted("not-an-email")).toBe(false);
  });
});
