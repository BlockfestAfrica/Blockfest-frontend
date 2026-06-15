/**
 * Role normalization utilities for company roles
 */

import { isEmptyValue } from "./fields";

/**
 * Normalize company role to standard format
 * Returns null for invalid/empty entries
 */
export function normalizeRole(roleInput: string): string | null {
  if (!roleInput || roleInput.trim() === "") return null;

  const role = roleInput.trim();
  const roleLower = role.toLowerCase();

  // Filter out non-role entries
  if (isEmptyValue(role)) {
    return null;
  }

  // Normalize common roles
  if (roleLower.includes("founder")) return "Founder";
  if (roleLower.includes("ceo")) return "CEO";
  if (roleLower.includes("ambassador")) return "Ambassador";
  if (roleLower.includes("member")) return "Member";
  if (roleLower.includes("creator")) return "Creator";
  if (roleLower.includes("student")) return "Student";
  if (roleLower.includes("developer") || roleLower.includes("dev")) return "Developer";
  if (roleLower.includes("manager")) return "Manager";
  if (roleLower.includes("lead")) return "Lead";
  if (roleLower.includes("director")) return "Director";
  if (roleLower.includes("engineer")) return "Engineer";
  if (roleLower.includes("analyst")) return "Analyst";
  if (roleLower.includes("designer")) return "Designer";
  if (roleLower.includes("marketing")) return "Marketing";
  if (roleLower.includes("community")) return "Community Manager";
  if (roleLower.includes("product") && roleLower.includes("manager"))
    return "Product Manager";
  if (roleLower.includes("co-founder") || roleLower.includes("cofounder"))
    return "Co-Founder";

  return role; // Keep original if no pattern matches
}

/**
 * Role category definitions
 */
export const ROLE_CATEGORIES = {
  leadership: ["Founder", "CEO", "Co-Founder", "Director"],
  technical: ["Developer", "Engineer", "Designer", "Product Manager"],
  business: ["Ambassador", "Marketing", "Community Manager", "Manager"],
} as const;

/**
 * Get role category for a given role
 */
export function getRoleCategory(role: string): "leadership" | "technical" | "business" | "other" {
  if (ROLE_CATEGORIES.leadership.includes(role as typeof ROLE_CATEGORIES.leadership[number])) {
    return "leadership";
  }
  if (ROLE_CATEGORIES.technical.includes(role as typeof ROLE_CATEGORIES.technical[number])) {
    return "technical";
  }
  if (ROLE_CATEGORIES.business.includes(role as typeof ROLE_CATEGORIES.business[number])) {
    return "business";
  }
  return "other";
}
