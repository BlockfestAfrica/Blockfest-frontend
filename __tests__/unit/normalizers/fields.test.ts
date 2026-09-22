/**
 * Tests for field normalization utilities
 */

import { describe, it, expect } from "vitest";
import {
  parseExperienceLevel,
  parseProfessions,
  parseSource,
  parseGender,
  parseConsent,
  isEmptyValue,
} from "@/lib/normalizers/fields";

describe("parseExperienceLevel", () => {
  it("identifies Newcomer level", () => {
    expect(parseExperienceLevel("Newcomer - Just learning")).toBe("Newcomer");
    expect(parseExperienceLevel("I'm a newcomer to Web3")).toBe("Newcomer");
    expect(parseExperienceLevel("Just learning about crypto")).toBe("Newcomer");
  });

  it("identifies Intermediate level", () => {
    expect(parseExperienceLevel("Intermediate - Familiar with basics")).toBe(
      "Intermediate"
    );
    expect(parseExperienceLevel("I'm familiar with blockchain")).toBe("Intermediate");
  });

  it("identifies Advanced level", () => {
    expect(parseExperienceLevel("Advanced - Actively building")).toBe("Advanced");
    expect(parseExperienceLevel("I'm actively building in Web3")).toBe("Advanced");
  });

  it("identifies Web2 Transitioning", () => {
    expect(parseExperienceLevel("Web2 developer transitioning to Web3")).toBe(
      "Web2 Transitioning"
    );
  });

  it("returns Unknown for unrecognized values", () => {
    expect(parseExperienceLevel("")).toBe("Unknown");
    expect(parseExperienceLevel("random text")).toBe("Unknown");
  });
});

describe("parseProfessions", () => {
  it("identifies single profession", () => {
    expect(parseProfessions("Developer")).toBe("Developer");
    expect(parseProfessions("Student")).toBe("Student");
    expect(parseProfessions("Founder")).toBe("Founder");
  });

  it("identifies multiple professions", () => {
    expect(parseProfessions("Developer, Student")).toBe("Developer, Student");
    expect(parseProfessions("Founder & Entrepreneur")).toBe("Founder");
  });

  it("handles BD/Sales variations", () => {
    expect(parseProfessions("BD/Sales")).toBe("Business Development");
    expect(parseProfessions("Business Development")).toBe("Business Development");
  });

  it("handles Policy/Legal variations", () => {
    expect(parseProfessions("Policy Maker")).toBe("Policy/Legal");
    expect(parseProfessions("Lawyer")).toBe("Policy/Legal");
  });

  it("returns Other for empty or unrecognized", () => {
    expect(parseProfessions("")).toBe("Other");
    expect(parseProfessions("Random profession")).toBe("Other");
  });
});

describe("parseSource", () => {
  it("normalizes X/Twitter variations", () => {
    expect(parseSource("X (formerly Twitter)")).toBe("X (Twitter)");
    expect(parseSource("X (Twitter)")).toBe("X (Twitter)");
    expect(parseSource("Twitter")).toBe("X (Twitter)");
    expect(parseSource("X")).toBe("X (Twitter)");
  });

  it("normalizes friend/referral variations", () => {
    expect(parseSource("Friend")).toBe("Friend/Referral");
    expect(parseSource("Referral")).toBe("Friend/Referral");
    expect(parseSource("A friend told me")).toBe("Friend/Referral");
  });

  it("normalizes other social platforms", () => {
    expect(parseSource("Instagram")).toBe("Instagram");
    expect(parseSource("LinkedIn")).toBe("LinkedIn");
    expect(parseSource("Telegram")).toBe("Telegram");
  });

  it("returns Unknown for empty input", () => {
    expect(parseSource("")).toBe("Unknown");
    expect(parseSource("  ")).toBe("Unknown");
  });
});

describe("parseGender", () => {
  it("normalizes male variations", () => {
    expect(parseGender("male")).toBe("Male");
    expect(parseGender("Male")).toBe("Male");
    expect(parseGender("m")).toBe("Male");
    expect(parseGender("M")).toBe("Male");
  });

  it("normalizes female variations", () => {
    expect(parseGender("female")).toBe("Female");
    expect(parseGender("Female")).toBe("Female");
    expect(parseGender("f")).toBe("Female");
    expect(parseGender("F")).toBe("Female");
  });

  it("handles other values", () => {
    expect(parseGender("non-binary")).toBe("Other/Prefer not to say");
    expect(parseGender("prefer not to say")).toBe("Other/Prefer not to say");
  });

  it("returns empty for empty input", () => {
    expect(parseGender("")).toBe("");
    expect(parseGender("n/a")).toBe("");
  });
});

describe("parseConsent", () => {
  it("returns true for positive responses", () => {
    expect(parseConsent("yes")).toBe(true);
    expect(parseConsent("Yes")).toBe(true);
    expect(parseConsent("done")).toBe(true);
    expect(parseConsent("true")).toBe(true);
  });

  it("returns false for negative responses", () => {
    expect(parseConsent("no")).toBe(false);
    expect(parseConsent("No")).toBe(false);
    expect(parseConsent("false")).toBe(false);
  });

  it("returns null for empty or ambiguous responses", () => {
    expect(parseConsent("")).toBe(null);
    expect(parseConsent(null as unknown as string)).toBe(null);
    expect(parseConsent("maybe")).toBe(null);
  });
});

describe("isEmptyValue", () => {
  it("returns true for empty values", () => {
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue("none")).toBe(true);
    expect(isEmptyValue("nil")).toBe(true);
    expect(isEmptyValue("n/a")).toBe(true);
    expect(isEmptyValue("null")).toBe(true);
    expect(isEmptyValue("-")).toBe(true);
  });

  it("returns false for actual values", () => {
    expect(isEmptyValue("Lagos")).toBe(false);
    expect(isEmptyValue("John")).toBe(false);
    expect(isEmptyValue("Developer")).toBe(false);
  });
});
