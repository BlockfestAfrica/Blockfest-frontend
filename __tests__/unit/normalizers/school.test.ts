/**
 * Tests for school normalization utilities
 */

import { describe, it, expect } from "vitest";
import { normalizeSchoolName, isValidSchoolEntry } from "@/lib/normalizers/school";

describe("normalizeSchoolName", () => {
  it("handles empty input", () => {
    expect(normalizeSchoolName("")).toBe("");
    expect(normalizeSchoolName("  ")).toBe("");
  });

  it("normalizes University of Lagos variations", () => {
    expect(normalizeSchoolName("UNILAG")).toBe("University of Lagos");
    expect(normalizeSchoolName("unilag")).toBe("University of Lagos");
    expect(normalizeSchoolName("University of Lagos")).toBe("University of Lagos");
    expect(normalizeSchoolName("uni lag")).toBe("University of Lagos");
  });

  it("normalizes Lagos State University variations", () => {
    expect(normalizeSchoolName("LASU")).toBe("Lagos State University");
    expect(normalizeSchoolName("lasu")).toBe("Lagos State University");
    expect(normalizeSchoolName("Lagos State University")).toBe(
      "Lagos State University"
    );
  });

  it("normalizes Yaba College of Technology variations", () => {
    expect(normalizeSchoolName("Yabatech")).toBe("Yaba College of Technology");
    expect(normalizeSchoolName("YCT")).toBe("Yaba College of Technology");
    expect(normalizeSchoolName("Yaba Tech")).toBe("Yaba College of Technology");
  });

  it("normalizes University of Ibadan variations", () => {
    expect(normalizeSchoolName("UI")).toBe("University of Ibadan");
    expect(normalizeSchoolName("University of Ibadan")).toBe("University of Ibadan");
  });

  it("normalizes OAU variations", () => {
    expect(normalizeSchoolName("OAU")).toBe("Obafemi Awolowo University");
    expect(normalizeSchoolName("Obafemi Awolowo University")).toBe(
      "Obafemi Awolowo University"
    );
    expect(normalizeSchoolName("Ife University")).toBe("Obafemi Awolowo University");
  });

  it("normalizes federal universities", () => {
    expect(normalizeSchoolName("FUTA")).toBe("Federal University of Technology Akure");
    expect(normalizeSchoolName("FUNAAB")).toBe(
      "Federal University of Agriculture Abeokuta"
    );
    expect(normalizeSchoolName("FUTO")).toBe(
      "Federal University of Technology Owerri"
    );
  });

  it("cleans up unrecognized school names", () => {
    const result = normalizeSchoolName("some unknown school");
    expect(result).toBe("some unknown school");
  });

  it("capitalizes common terms", () => {
    const result = normalizeSchoolName("lagos tech university");
    expect(result).toBe("lagos Technology University");
  });
});

describe("isValidSchoolEntry", () => {
  it("returns false for empty values", () => {
    expect(isValidSchoolEntry("")).toBe(false);
    expect(isValidSchoolEntry(undefined)).toBe(false);
    expect(isValidSchoolEntry(null as unknown as string)).toBe(false);
  });

  it("returns false for nil indicators", () => {
    expect(isValidSchoolEntry("n/a")).toBe(false);
    expect(isValidSchoolEntry("none")).toBe(false);
    expect(isValidSchoolEntry("nil")).toBe(false);
    expect(isValidSchoolEntry("not a student")).toBe(false);
    expect(isValidSchoolEntry("graduate")).toBe(false);
  });

  it("returns false for very short entries", () => {
    expect(isValidSchoolEntry("ab")).toBe(false);
    expect(isValidSchoolEntry("UI")).toBe(false);
  });

  it("returns true for valid school names", () => {
    expect(isValidSchoolEntry("University of Lagos")).toBe(true);
    expect(isValidSchoolEntry("UNILAG")).toBe(true);
    expect(isValidSchoolEntry("Yabatech")).toBe(true);
  });
});
