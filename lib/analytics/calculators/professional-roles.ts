/**
 * Professional roles analytics calculator
 */

import type { GuestRegistration, ProfessionalRoleItem } from "../types";

/**
 * Calculate professional roles breakdown from profession descriptions
 */
export function calculateProfessionalRoles(
  registrations: GuestRegistration[]
): ProfessionalRoleItem[] {
  const roleCounts = new Map<string, number>();
  const totalResponses = registrations.length;

  registrations.forEach((reg) => {
    const professionField = reg.profession || "";
    const roles: string[] = [];
    const professionLower = professionField.toLowerCase();

    // Extract individual roles
    if (professionLower.includes("developer")) roles.push("Developer");
    if (professionLower.includes("student")) roles.push("Student");
    if (professionLower.includes("creator")) roles.push("Creator");
    if (professionLower.includes("researcher")) roles.push("Researcher");
    if (professionLower.includes("founder") || professionLower.includes("entrepreneur"))
      roles.push("Founder");
    if (professionLower.includes("designer")) roles.push("Designer");
    if (professionLower.includes("bd/sales") || professionLower.includes("business"))
      roles.push("Business Development");
    if (professionLower.includes("marketing")) roles.push("Marketing");
    if (professionLower.includes("policy") || professionLower.includes("lawyer"))
      roles.push("Policy/Legal");
    if (professionLower.includes("investor")) roles.push("Professional Investor");

    // If no roles found, categorize as "Other"
    if (roles.length === 0) roles.push("Other");

    // Count each role (a person can have multiple roles)
    roles.forEach((role) => {
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    });
  });

  // Convert to array and calculate percentages
  return Array.from(roleCounts.entries())
    .map(([role, count]) => ({
      role,
      count,
      percentage: Math.round((count / totalResponses) * 100 * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}
