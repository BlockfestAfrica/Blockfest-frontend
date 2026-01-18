/**
 * School name normalization utilities
 */

import schoolData from "../data/schools.json";

const { schoolMappings } = schoolData;

/**
 * Normalize school names to group variations together
 */
export function normalizeSchoolName(schoolName: string): string {
  if (!schoolName || schoolName.trim() === "") return "";

  const normalized = schoolName.trim();
  const lower = normalized.toLowerCase();

  // Check for exact matches first
  const exactMatch = schoolMappings[lower as keyof typeof schoolMappings];
  if (exactMatch) {
    return exactMatch;
  }

  // Check for partial matches (contains)
  for (const [key, value] of Object.entries(schoolMappings)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }

  // If no mapping found, just clean up the original name
  return normalized
    .replace(/\buniversity\b/gi, "University")
    .replace(/\bcollege\b/gi, "College")
    .replace(/\binstitute\b/gi, "Institute")
    .replace(/\btech\b/gi, "Technology")
    .replace(/\bpoly\b/gi, "Polytechnic")
    .replace(/\buni\b/gi, "University")
    .replace(/\buniv\b/gi, "University")
    .trim();
}

/**
 * Check if a school entry is valid (not empty, n/a, or indicates non-student)
 */
export function isValidSchoolEntry(school: string | undefined): boolean {
  if (!school) return false;

  const normalized = school.toLowerCase().trim();
  const invalidIndicators = [
    "n/a",
    "none",
    "nil",
    "not a student",
    "graduate",
    "graduated",
    "",
  ];

  return !invalidIndicators.includes(normalized) && school.length > 2;
}
