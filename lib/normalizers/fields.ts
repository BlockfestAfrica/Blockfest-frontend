/**
 * Field normalization utilities for CSV data parsing
 */

/**
 * Parse experience text into standardized level
 */
export function parseExperienceLevel(expText: string): string {
  const normalized = expText.toLowerCase();

  if (normalized.includes("newcomer") || normalized.includes("just learning")) {
    return "Newcomer";
  }
  if (normalized.includes("intermediate") || normalized.includes("familiar")) {
    return "Intermediate";
  }
  if (normalized.includes("advanced") || normalized.includes("actively building")) {
    return "Advanced";
  }
  if (normalized.includes("web2") && normalized.includes("transitioning")) {
    return "Web2 Transitioning";
  }

  return "Unknown";
}

/**
 * Parse profession field that may contain multiple selections
 * Returns comma-separated string of professions
 */
export function parseProfessions(professionField: string): string {
  const professions: string[] = [];
  const professionLower = professionField.toLowerCase();

  if (professionLower.includes("developer")) professions.push("Developer");
  if (professionLower.includes("student")) professions.push("Student");
  if (professionLower.includes("creator")) professions.push("Creator");
  if (professionLower.includes("researcher")) professions.push("Researcher");
  if (professionLower.includes("founder") || professionLower.includes("entrepreneur"))
    professions.push("Founder");
  if (professionLower.includes("designer")) professions.push("Designer");
  if (professionLower.includes("bd/sales") || professionLower.includes("business"))
    professions.push("Business Development");
  if (professionLower.includes("marketing")) professions.push("Marketing");
  if (professionLower.includes("policy") || professionLower.includes("lawyer"))
    professions.push("Policy/Legal");
  if (professionLower.includes("investor")) professions.push("Professional Investor");

  return professions.length > 0 ? professions.join(", ") : "Other";
}

/**
 * Parse and normalize source field
 */
export function parseSource(sourceField: string): string {
  if (!sourceField.trim()) return "Unknown";

  const sourceLower = sourceField.toLowerCase();

  if (sourceLower.includes("friend") || sourceLower.includes("referral"))
    return "Friend/Referral";
  if (
    sourceLower.includes("x (formerly twitter)") ||
    sourceLower.includes("x (twitter)") ||
    sourceLower.includes("twitter") ||
    sourceLower === "x"
  )
    return "X (Twitter)";
  if (sourceLower.includes("linkedin")) return "LinkedIn";
  if (sourceLower.includes("instagram")) return "Instagram";
  if (sourceLower.includes("telegram")) return "Telegram";
  if (sourceLower.includes("other")) return "Other";

  return sourceField.trim();
}

/**
 * Parse gender field with normalization
 */
export function parseGender(gender: string): string {
  if (!gender) return "";

  const normalizedGender = gender.toLowerCase().trim();

  if (normalizedGender === "male" || normalizedGender === "m") {
    return "Male";
  }
  if (normalizedGender === "female" || normalizedGender === "f") {
    return "Female";
  }
  if (normalizedGender !== "" && normalizedGender !== "n/a") {
    return "Other/Prefer not to say";
  }

  return "";
}

/**
 * Parse consent field (yes/no/done variations)
 */
export function parseConsent(consentField: string): boolean | null {
  if (!consentField) return null;

  const consent = consentField.toLowerCase();

  if (consent.includes("yes") || consent.includes("done") || consent === "true") {
    return true;
  }
  if (consent.includes("no") || consent === "false") {
    return false;
  }

  return null;
}

/**
 * Check if a field indicates no value (nil, n/a, none, etc.)
 */
export function isEmptyValue(value: string | undefined | null): boolean {
  if (!value) return true;

  const normalized = value.toLowerCase().trim();
  const emptyIndicators = [
    "none",
    "nil",
    "nill",
    "n/a",
    "na",
    "non",
    "null",
    "",
    "-",
    "nah",
    "no",
  ];

  return emptyIndicators.includes(normalized);
}
