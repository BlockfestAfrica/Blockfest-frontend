/**
 * Location normalization utilities for analytics
 * Handles country, city, and transportation location normalization
 */

import locationData from "../data/nigerian-locations.json";

const {
  nigerianKeywords,
  stateMap,
  internationalMappings,
  countryMappings,
  nonLocationKeywords,
  lagosAreas,
  ogunAreas,
} = locationData;

/**
 * Normalize country names to standard format
 * Defaults to Nigeria for Nigerian event
 */
export function normalizeCountry(country: string): string {
  if (!country) return "Nigeria";

  // Clean and normalize the input
  const cleaned = country
    .toLowerCase()
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/[.,\s)(\-]+$/, "")
    .replace(/^[.,\s)(\-]+/, "")
    .replace(/\s+/g, " ");

  // Handle empty or invalid entries
  if (
    !cleaned ||
    cleaned === "nil" ||
    cleaned === "none" ||
    cleaned === "n/a" ||
    cleaned === "null" ||
    cleaned === "-" ||
    cleaned === "nah" ||
    cleaned === "no"
  ) {
    return "Nigeria";
  }

  // Handle direct Nigerian variants and typos
  if (
    cleaned.match(/^nigeri[a-z]*$/i) ||
    cleaned === "ng" ||
    cleaned === "nige" ||
    cleaned === "nigerai" ||
    cleaned === "nigera" ||
    cleaned === "nigerua" ||
    cleaned === "nigerian" ||
    cleaned === "nigerians"
  ) {
    return "Nigeria";
  }

  // Handle international mappings first (exact match)
  const intlMapping = internationalMappings[cleaned as keyof typeof internationalMappings];
  if (intlMapping) {
    return intlMapping;
  }

  // Check country mappings (exact match) before Nigerian keywords
  const countryMapping = countryMappings[cleaned as keyof typeof countryMappings];
  if (countryMapping) {
    return countryMapping;
  }

  // Check if any Nigerian keyword matches
  for (const keyword of nigerianKeywords) {
    if (cleaned.includes(keyword) || keyword.includes(cleaned)) {
      return "Nigeria";
    }
  }

  // If it contains "state" without a country, assume Nigeria
  if (cleaned.includes("state") && !cleaned.includes("united")) {
    return "Nigeria";
  }

  // Handle non-location entries
  const hasNonLocationKeyword = nonLocationKeywords.some((keyword) =>
    cleaned.includes(keyword)
  );

  if (hasNonLocationKeyword) {
    return "Nigeria";
  }

  // Default to Nigeria for unrecognized entries
  return "Nigeria";
}

/**
 * Normalize location entries for city-level analytics
 */
export function normalizeLocation(locationInput: string): string {
  if (!locationInput || locationInput.trim() === "") {
    return "Nigeria";
  }

  const location = locationInput.trim();
  const locationLower = location.toLowerCase();

  // Handle obvious non-location entries
  const hasNonLocationKeyword = nonLocationKeywords.some((keyword) =>
    locationLower.includes(keyword)
  );

  if (hasNonLocationKeyword) {
    return "Nigeria";
  }

  // Lagos variations
  if (lagosAreas.some((area) => locationLower.includes(area))) {
    return "Lagos, Nigeria";
  }

  // Abuja variations
  if (locationLower.includes("abuja") || locationLower.includes("fct")) {
    return "Abuja, Nigeria";
  }

  // Ibadan variations
  if (
    locationLower.includes("ibadan") ||
    (locationLower.includes("oyo") && !locationLower.includes("state"))
  ) {
    return "Ibadan, Nigeria";
  }

  // Ogun State variations
  if (ogunAreas.some((area) => locationLower.includes(area))) {
    return "Ogun State, Nigeria";
  }

  // Port Harcourt variations
  if (
    locationLower.includes("port harcourt") ||
    locationLower.includes("portharcourt") ||
    (locationLower.includes("rivers") && locationLower.includes("state"))
  ) {
    return "Port Harcourt, Nigeria";
  }

  // Enugu variations
  if (locationLower.includes("enugu") || locationLower.includes("nsukka")) {
    return "Enugu, Nigeria";
  }

  // Benin City variations
  if (
    locationLower.includes("benin city") ||
    locationLower.includes("benin-city") ||
    (locationLower.includes("benin") && !locationLower.includes("republic")) ||
    (locationLower.includes("edo") && locationLower.includes("state"))
  ) {
    return "Benin City, Nigeria";
  }

  // Ilorin variations
  if (
    locationLower.includes("ilorin") ||
    (locationLower.includes("kwara") && locationLower.includes("state"))
  ) {
    return "Ilorin, Nigeria";
  }

  // Akure variations
  if (
    locationLower.includes("akure") ||
    (locationLower.includes("ondo") && locationLower.includes("state"))
  ) {
    return "Akure, Nigeria";
  }

  // Owerri variations
  if (
    locationLower.includes("owerri") ||
    (locationLower.includes("imo") && locationLower.includes("state"))
  ) {
    return "Owerri, Nigeria";
  }

  // Kaduna variations
  if (locationLower.includes("kaduna") || locationLower.includes("zaria")) {
    return "Kaduna, Nigeria";
  }

  // Uyo variations
  if (
    locationLower.includes("uyo") ||
    locationLower.includes("akwa ibom") ||
    locationLower.includes("akwaibom")
  ) {
    return "Uyo, Nigeria";
  }

  // Warri variations
  if (
    locationLower.includes("warri") ||
    (locationLower.includes("delta") && locationLower.includes("state"))
  ) {
    return "Warri, Nigeria";
  }

  // Calabar variations
  if (locationLower.includes("calabar") || locationLower.includes("cross river")) {
    return "Calabar, Nigeria";
  }

  // Kano variations
  if (locationLower.includes("kano")) {
    return "Kano, Nigeria";
  }

  // Osogbo variations
  if (
    locationLower.includes("osogbo") ||
    (locationLower.includes("osun") && locationLower.includes("state"))
  ) {
    return "Osogbo, Nigeria";
  }

  // Handle other Nigerian states
  for (const [state, normalized] of Object.entries(stateMap)) {
    if (
      locationLower.includes(state + " state") ||
      (locationLower.includes(state) && locationLower.includes("state"))
    ) {
      return normalized;
    }
  }

  // International locations
  if (locationLower.includes("ghana")) return "Ghana";
  if (locationLower.includes("kenya")) return "Kenya";
  if (locationLower.includes("south africa")) return "South Africa";
  if (locationLower.includes("egypt")) return "Egypt";
  if (locationLower.includes("morocco")) return "Morocco";
  if (locationLower.includes("tunisia")) return "Tunisia";
  if (locationLower.includes("algeria")) return "Algeria";
  if (locationLower.includes("usa") || locationLower.includes("united states"))
    return "United States";
  if (locationLower.includes("uk") || locationLower.includes("united kingdom"))
    return "United Kingdom";
  if (locationLower.includes("canada")) return "Canada";
  if (locationLower.includes("france")) return "France";
  if (locationLower.includes("germany")) return "Germany";
  if (locationLower.includes("poland")) return "Poland";
  if (locationLower.includes("turkey") || locationLower.includes("türkiye"))
    return "Turkey";

  // If contains any Nigerian indicators, default to Nigeria
  if (
    locationLower.includes("nigeria") ||
    locationLower.includes("ng") ||
    locationLower.includes("nigerian") ||
    locationLower.includes("state")
  ) {
    return "Nigeria";
  }

  // Default fallback
  return location.includes(",") ? location : `${location}, Nigeria`;
}

/**
 * Normalize a free-text Lagos location for analytics display and grouping
 * Privacy-focused: removes specific addresses and numbers
 */
export function normalizeTransportLocation(input: string): string {
  if (!input) return "";

  // Lowercase, collapse spaces, remove quotes, canonicalize common synonyms
  let s = input
    .toLowerCase()
    .replace(/["'']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Canonicalize "VI" variants to "victoria island"
  s = s.replace(/\b(v\.?\s*\/?\s*i)\b/g, "victoria island");

  // Trim obvious address numerals to reduce PII risk
  s = s
    .replace(/\b\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Title Case for nicer display
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Classify transport location to major zones with word boundaries
 */
export function classifyTransportZone(displayLocation: string): string {
  const l = displayLocation.toLowerCase();

  if (/\bikeja\b|\bmaryland\b|\bojota\b/.test(l)) return "Ikeja/Maryland Axis";
  if (/\bsurulere\b|\byaba\b|\blagos island\b/.test(l))
    return "Lagos Island/Surulere";
  if (/\bfestac\b|\bsatellite\b|\bamuwo\b/.test(l)) return "Festac/Satellite Town";
  if (/\bajah\b|\blekki\b|\bvictoria island\b|\bvi\b/.test(l))
    return "Lekki/VI Axis";
  if (/\biyana?\s*ipaja\b|\balimosho\b|\begbeda\b/.test(l))
    return "Alimosho/Iyana Ipaja";
  if (/\bikorodu\b|\bkosofe\b/.test(l)) return "Ikorodu/Kosofe";

  return "Other";
}
