/**
 * Company roles analytics calculator
 */

import type { GuestRegistration, CompanyRolesResult } from "../types";
import { normalizeRole, ROLE_CATEGORIES } from "../../normalizers/role";

/**
 * Calculate company role breakdown (actual job titles)
 */
export function calculateCompanyRoles(
  registrations: GuestRegistration[]
): CompanyRolesResult {
  const roleCounts = new Map<string, number>();
  const validRoles: string[] = [];

  registrations.forEach((reg) => {
    if (reg.role) {
      const normalizedRole = normalizeRole(reg.role);
      if (normalizedRole) {
        validRoles.push(normalizedRole);
        roleCounts.set(normalizedRole, (roleCounts.get(normalizedRole) || 0) + 1);
      }
    }
  });

  // Convert to array and calculate percentages
  const rolesArray = Array.from(roleCounts.entries())
    .map(([role, count]) => ({
      role,
      count,
      percentage:
        validRoles.length > 0
          ? Math.round((count / validRoles.length) * 100 * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate role categories
  const leadersCount = ROLE_CATEGORIES.leadership.reduce(
    (sum, role) => sum + (roleCounts.get(role) || 0),
    0
  );
  const techCount = ROLE_CATEGORIES.technical.reduce(
    (sum, role) => sum + (roleCounts.get(role) || 0),
    0
  );
  const businessCount = ROLE_CATEGORIES.business.reduce(
    (sum, role) => sum + (roleCounts.get(role) || 0),
    0
  );

  return {
    roles: rolesArray.slice(0, 15), // Top 15 roles
    categories: {
      leadership: {
        count: leadersCount,
        percentage:
          validRoles.length > 0
            ? Math.round((leadersCount / validRoles.length) * 100 * 10) / 10
            : 0,
      },
      technical: {
        count: techCount,
        percentage:
          validRoles.length > 0
            ? Math.round((techCount / validRoles.length) * 100 * 10) / 10
            : 0,
      },
      business: {
        count: businessCount,
        percentage:
          validRoles.length > 0
            ? Math.round((businessCount / validRoles.length) * 100 * 10) / 10
            : 0,
      },
    },
    totalValidRoles: validRoles.length,
    totalResponses: registrations.length,
  };
}
