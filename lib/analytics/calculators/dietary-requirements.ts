/**
 * Dietary requirements analytics calculator
 */

import type { GuestRegistration, DietaryRequirements } from "../types";

/**
 * Calculate dietary requirements breakdown
 */
export function calculateDietaryRequirements(
  registrations: GuestRegistration[]
): DietaryRequirements {
  const restrictionCounts = new Map<string, number>();
  let hasRestrictions = 0;
  let noRestrictions = 0;
  const allRestrictions: string[] = [];

  const totalResponses = registrations.length;

  // Common responses indicating no restrictions
  const noRestrictionIndicators = [
    "no",
    "none",
    "nil",
    "nothing",
    "n/a",
    "na",
    "no restrictions",
    "no dietary restrictions",
    "i don't have any",
    "i do not have any",
  ];

  registrations.forEach((reg) => {
    const dietaryField = reg.dietary?.toLowerCase() || "";

    const hasNoRestrictions =
      !dietaryField ||
      dietaryField.trim() === "" ||
      noRestrictionIndicators.some((indicator) => dietaryField.includes(indicator));

    if (hasNoRestrictions) {
      noRestrictions++;
    } else {
      hasRestrictions++;

      // Parse dietary restrictions from text
      const restrictions: string[] = [];
      const dietaryLower = dietaryField;

      if (dietaryLower.includes("vegetarian")) restrictions.push("Vegetarian");
      if (dietaryLower.includes("vegan")) restrictions.push("Vegan");
      if (dietaryLower.includes("halal")) restrictions.push("Halal");
      if (dietaryLower.includes("kosher")) restrictions.push("Kosher");
      if (dietaryLower.includes("gluten") || dietaryLower.includes("celiac"))
        restrictions.push("Gluten-Free");
      if (dietaryLower.includes("dairy") || dietaryLower.includes("lactose"))
        restrictions.push("Dairy-Free");
      if (dietaryLower.includes("nut") || dietaryLower.includes("peanut"))
        restrictions.push("Nut Allergy");
      if (dietaryLower.includes("seafood") || dietaryLower.includes("shellfish"))
        restrictions.push("Seafood Allergy");
      if (dietaryLower.includes("diabetic") || dietaryLower.includes("diabetes"))
        restrictions.push("Diabetic");

      // If no specific restriction found but they indicated they have restrictions
      if (restrictions.length === 0) restrictions.push("Other");

      // Count each restriction
      restrictions.forEach((restriction) => {
        restrictionCounts.set(
          restriction,
          (restrictionCounts.get(restriction) || 0) + 1
        );
        allRestrictions.push(restriction);
      });
    }
  });

  // Convert to array format
  const restrictionsArray = Array.from(restrictionCounts.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage:
        hasRestrictions > 0
          ? Math.round((count / hasRestrictions) * 100 * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalResponses,
    hasRestrictions,
    noRestrictions,
    restrictions: restrictionsArray,
    commonRestrictions: [...new Set(allRestrictions)].slice(0, 5),
  };
}
