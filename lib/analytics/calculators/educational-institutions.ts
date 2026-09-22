/**
 * Educational institutions analytics calculator
 */

import type { GuestRegistration, EducationalInstitutionItem } from "../types";
import { normalizeSchoolName, isValidSchoolEntry } from "../../normalizers/school";

/**
 * Calculate educational institutions breakdown
 */
export function calculateEducationalInstitutions(
  registrations: GuestRegistration[]
): EducationalInstitutionItem[] {
  const institutionCounts = new Map<string, number>();

  const validInstitutions = registrations
    .map((reg) => reg.school?.trim())
    .filter((school): school is string => isValidSchoolEntry(school));

  const totalResponses = validInstitutions.length;

  validInstitutions.forEach((institution) => {
    const normalizedName = normalizeSchoolName(institution);

    if (normalizedName && normalizedName.trim() !== "") {
      institutionCounts.set(
        normalizedName,
        (institutionCounts.get(normalizedName) || 0) + 1
      );
    }
  });

  // Convert to array and calculate percentages
  return Array.from(institutionCounts.entries())
    .map(([institution, count]) => ({
      institution,
      count,
      percentage:
        totalResponses > 0
          ? Math.round((count / totalResponses) * 100 * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);
}
