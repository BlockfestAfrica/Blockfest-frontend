import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Add headers to exclude from analytics tracking
const PRIVATE_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
};

// This would typically connect to your actual database
// For now, we'll structure it to work with CSV data processing

interface GuestRegistration {
  id: string;
  timestamp: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  profession: string;
  company: string;
  experience: string;
  interests: string;
  source: string;
  status: "confirmed" | "pending" | "cancelled";
  gender?: string;
  school?: string;
  transportation?: string;
  dietary?: string;
  photoConsent?: string;
  emailConsent?: string;
  xFollow?: string;
  telegramJoin?: string;
}

// Utility function to parse CSV line with proper quoted field handling
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote within quoted field
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  // Remove surrounding quotes from parsed values
  return result.map((v) => v.replace(/^"|"$/g, ""));
}

/**
 * Parse experience text into standardized level
 */
function parseExperienceLevel(expText: string): string {
  const normalized = expText.toLowerCase();

  if (normalized.includes("newcomer") || normalized.includes("just learning")) {
    return "Newcomer";
  }
  if (normalized.includes("intermediate") || normalized.includes("familiar")) {
    return "Intermediate";
  }
  if (
    normalized.includes("advanced") ||
    normalized.includes("actively building")
  ) {
    return "Advanced";
  }
  if (normalized.includes("web2") && normalized.includes("transitioning")) {
    return "Web2 Transitioning";
  }

  return "Unknown";
}

// Normalizes a free-text Lagos location for analytics display and grouping.
function normalizeTransportLocation(input: string): string {
  if (!input) return "";
  // Lowercase, collapse spaces, remove quotes, canonicalize common synonyms, strip standalone numbers
  let s = input.toLowerCase().replace(/["'']/g, "").replace(/\s+/g, " ").trim();
  // Canonicalize "VI" variants to "victoria island"
  s = s.replace(/\b(v\.?\s*\/?\s*i)\b/g, "victoria island");
  // Trim obvious address numerals to reduce PII risk (keeps words)
  s = s
    .replace(/\b\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Title Case for nicer display
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Classify to major zones with word boundaries to avoid false positives.
function classifyTransportZone(displayLocation: string): string {
  const l = displayLocation.toLowerCase();
  if (/\bikeja\b|\bmaryland\b|\bojota\b/.test(l)) return "Ikeja/Maryland Axis";
  if (/\bsurulere\b|\byaba\b|\blagos island\b/.test(l))
    return "Lagos Island/Surulere";
  if (/\bfestac\b|\bsatellite\b|\bamuwo\b/.test(l))
    return "Festac/Satellite Town";
  if (/\bajah\b|\blekki\b|\bvictoria island\b|\bvi\b/.test(l))
    return "Lekki/VI Axis";
  if (/\biyana?\s*ipaja\b|\balimosho\b|\begbeda\b/.test(l))
    return "Alimosho/Iyana Ipaja";
  if (/\bikorodu\b|\bkosofe\b/.test(l)) return "Ikorodu/Kosofe";
  return "Other";
}

// Function to normalize country names
function normalizeCountry(country: string): string {
  if (!country) return "Nigeria"; // Default for Nigerian event

  // Clean and normalize the input
  const cleaned = country
    .toLowerCase()
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "") // Remove quotes and spaces from start/end
    .replace(/[.,\s)(\-]+$/, "") // Remove trailing punctuation, spaces, parentheses, hyphens
    .replace(/^[.,\s)(\-]+/, "") // Remove leading punctuation, spaces, parentheses, hyphens
    .replace(/\s+/g, " "); // Normalize multiple spaces to single space

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

  // Handle international cities/countries
  const internationalMappings: { [key: string]: string } = {
    nairobi: "Kenya",
    kenya: "Kenya",
    poland: "Poland",
    türkiye: "Turkey",
    turkey: "Turkey",
    ghana: "Ghana",
    "south africa": "South Africa",
    "benin republic": "Benin",
  };

  if (internationalMappings[cleaned]) {
    return internationalMappings[cleaned];
  }

  // Comprehensive Nigerian locations mapping
  const nigerianKeywords = [
    // Direct Nigeria references
    "nigeria",
    "ng",
    "nige",
    "nigerian",
    "nigerians",

    // Major cities
    "lagos",
    "abuja",
    "ibadan",
    "kano",
    "port harcourt",
    "portharcourt",
    "benin city",
    "maiduguri",
    "zaria",
    "aba",
    "jos",
    "ilorin",
    "enugu",
    "abeokuta",
    "sokoto",
    "onitsha",
    "warri",
    "calabar",
    "uyo",
    "kaduna",
    "bauchi",
    "akure",
    "osogbo",
    "gombe",
    "minna",
    "owerri",
    "asaba",
    "abakaliki",
    "umuahia",
    "awka",
    "makurdi",
    "yenagoa",
    "lafia",
    "jalingo",
    "gusau",
    "dutse",
    "birnin kebbi",
    "yola",

    // Lagos areas
    "ikeja",
    "lekki",
    "victoria island",
    "ikoyi",
    "surulere",
    "mushin",
    "isolo",
    "agege",
    "ikorodu",
    "epe",
    "badagry",
    "egbeda",
    "yaba",
    "apapa",
    "alaba",
    "ogba",
    "berger",
    "gbagada",
    "bariga",
    "shomolu",
    "ojo",
    "island",
    "mainland",
    "ikotun",
    "ipaja",
    "igando",
    "alakuko",
    "abule egba",
    "mowe",
    "magboro",
    "arepo",
    "ifo",
    "ota",
    "agbara",
    "badore",
    "ajah",
    "sangotedo",

    // Other Nigerian cities/towns
    "ile ife",
    "itori",
    "ogbomosho",
    "ogbomoso",
    "ijebu ode",
    "sagamu",
    "offa",
    "ado ekiti",
    "akoka",
    "ebutte meta",
    "meiran",
    "ewekoro",
    "akute",
    "sango",
    "agbor",
    "warri",
    "sapele",
    "benin",
    "asaba",
    "onitsha",
    "nnewi",
    "awka",
    "enugu",
    "nsukka",
    "abakaliki",
    "ebonyi",
    "abia",
    "umuahia",
    "aba",
    "owerri",
    "orlu",
    "okigwe",
    "imo",

    // All 36 Nigerian states (with variations)
    "abia",
    "abia state",
    "adamawa",
    "adamawa state",
    "akwa ibom",
    "akwaibom",
    "akwa ibom state",
    "anambra",
    "anambra state",
    "bauchi",
    "bauchi state",
    "bayelsa",
    "bayelsa state",
    "benue",
    "benue state",
    "borno",
    "borno state",
    "cross river",
    "cross river state",
    "delta",
    "delta state",
    "ebonyi",
    "ebonyi state",
    "edo",
    "edo state",
    "ekiti",
    "ekiti state",
    "enugu",
    "enugu state",
    "gombe",
    "gombe state",
    "imo",
    "imo state",
    "jigawa",
    "jigawa state",
    "kaduna",
    "kaduna state",
    "kano",
    "kano state",
    "katsina",
    "katsina state",
    "kebbi",
    "kebbi state",
    "kogi",
    "kogi state",
    "kwara",
    "kwara state",
    "lagos",
    "lagos state",
    "nasarawa",
    "nasarawa state",
    "niger",
    "niger state",
    "ogun",
    "ogun state",
    "ondo",
    "ondo state",
    "osun",
    "osun state",
    "oyo",
    "oyo state",
    "plateau",
    "plateau state",
    "rivers",
    "rivers state",
    "sokoto",
    "sokoto state",
    "taraba",
    "taraba state",
    "yobe",
    "yobe state",
    "zamfara",
    "zamfara state",
    "fct",
    "federal capital territory",
    "abuja fct",

    // State abbreviations and variations
    "rivers state",
    "riverstate",
    "river state",
    "oyo nigeria",
    "lagos nigeria",
    "abuja nigeria",
    "ibadan nigeria",
    "port harcourt nigeria",
    "lagos epe",
    "lagos island",
    "lagos mainland",
    "lagos ikotun",
  ];

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

  // Handle university names, job titles, and other non-location entries
  const nonLocationKeywords = [
    "university",
    "college",
    "school",
    "polytechnic",
    "institute",
    "founder",
    "ceo",
    "manager",
    "developer",
    "designer",
    "creator",
    "ambassador",
    "moderator",
    "lead",
    "analyst",
    "director",
    "officer",
    "student",
    "graduate",
    "undergraduate",
    "corper",
    "nysc",
    "ltd",
    "limited",
    "inc",
    "company",
    "corp",
    "enterprise",
    "academy",
    "tech",
    "technology",
    "web3",
    "blockchain",
    "protocol",
  ];

  const hasNonLocationKeyword = nonLocationKeywords.some((keyword) =>
    cleaned.includes(keyword)
  );

  if (hasNonLocationKeyword) {
    return "Nigeria"; // Default for Nigerian event when non-location detected
  }

  // Common country normalizations for remaining entries
  const countryMappings: { [key: string]: string } = {
    "united states": "United States",
    usa: "United States",
    us: "United States",
    uk: "United Kingdom",
    "united kingdom": "United Kingdom",
    uae: "United Arab Emirates",
    "south africa": "South Africa",
    ghana: "Ghana",
    kenya: "Kenya",
    egypt: "Egypt",
    morocco: "Morocco",
    tunisia: "Tunisia",
    algeria: "Algeria",
    ethiopia: "Ethiopia",
    uganda: "Uganda",
    tanzania: "Tanzania",
    rwanda: "Rwanda",
    senegal: "Senegal",
    "ivory coast": "Ivory Coast",
    cameroon: "Cameroon",
    zimbabwe: "Zimbabwe",
    zambia: "Zambia",
    botswana: "Botswana",
    canada: "Canada",
    france: "France",
    germany: "Germany",
    netherlands: "Netherlands",
    spain: "Spain",
    italy: "Italy",
    portugal: "Portugal",
    india: "India",
    china: "China",
    japan: "Japan",
    australia: "Australia",
    brazil: "Brazil",
    mexico: "Mexico",
    argentina: "Argentina",
    poland: "Poland",
    turkey: "Turkey",
    türkiye: "Turkey",
  };

  // Return normalized country name or default to Nigeria for unrecognized entries
  return countryMappings[cleaned] || "Nigeria";
}

// Function to parse CSV data from the guest list
function parseGuestCSV(csvContent: string): GuestRegistration[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]);
  const registrations: GuestRegistration[] = [];

  // Map CSV column indices
  const getColumnIndex = (possibleNames: string[]) => {
    for (const name of possibleNames) {
      const index = headers.findIndex(
        (header) => header.toLowerCase().trim() === name.toLowerCase()
      );
      if (index !== -1) return index;
    }
    // Fallback to partial matching
    for (const name of possibleNames) {
      const index = headers.findIndex((header) =>
        header.toLowerCase().includes(name.toLowerCase())
      );
      if (index !== -1) return index;
    }
    return -1;
  };

  const indices = {
    id: getColumnIndex(["api_id"]),
    name: getColumnIndex(["name"]),
    firstName: getColumnIndex(["first_name"]),
    lastName: getColumnIndex(["last_name"]),
    email: getColumnIndex(["email"]),
    phone: getColumnIndex(["phone_number"]),
    timestamp: getColumnIndex(["created_at"]),
    approvalStatus: getColumnIndex(["approval_status"]),
    checkedIn: getColumnIndex(["checked_in_at"]),
    ticketType: getColumnIndex(["ticket_name"]),
    gender: getColumnIndex(["gender"]),
    experience: getColumnIndex([
      "what is your current experience level in web3?",
    ]),
    profession: getColumnIndex([
      "which of the following best describes you? select all that applies",
    ]),
    company: getColumnIndex([
      "which project or company are you representing? (if any)?",
    ]),
    role: getColumnIndex(["what is your role at the company?"]),
    school: getColumnIndex([
      "if you're a student, what's the name of your school?",
    ]),
    location: getColumnIndex([
      "city & country of residence (e.g abuja, nigeria)",
    ]),
    transportation: getColumnIndex([
      "transportation might be provided (within lagos). where will you be coming from that day?",
    ]),
    dietary: getColumnIndex([
      "we will be providing lunch. do you have any dietary restrictions or special needs we should be aware of?",
    ]),
    source: getColumnIndex(["how did you hear about this event?"]),
    photoConsent: getColumnIndex([
      "i consent to photos/videos being taken during the event for promotional use",
    ]),
    emailConsent: getColumnIndex([
      "do you consent to receive email updates and event information from blockfest africa?",
    ]),
    xFollow: getColumnIndex([
      "follow blockf3st africa on x: https://x.com/blockfestafrica",
    ]),
    telegramJoin: getColumnIndex([
      "join the blockfest africa telegram channel here: https://t.me/blockf3stafrica",
    ]),
  };

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    try {
      const fields = parseCSVLine(lines[i]);

      // Map approval_status to our expected status values
      const approvalStatus = fields[indices.approvalStatus] || "";
      let status: "confirmed" | "pending" | "cancelled";

      switch (approvalStatus.toLowerCase().trim()) {
        case "approved":
          status = "confirmed";
          break;
        case "pending_approval":
          status = "pending";
          break;
        case "declined":
          status = "cancelled";
          break;
        default:
          status = "pending"; // Default for any unknown status
      }

      // Extract location (City & Country) with normalization
      const locationField = fields[indices.location] || "";
      const locationParts = locationField.split(",").map((p) => p.trim());
      const city = locationParts.length > 0 ? locationParts[0] : "";
      const rawCountry =
        locationParts.length > 1 ? locationParts[locationParts.length - 1] : "";
      const country = normalizeCountry(rawCountry);

      // Parse profession from "describes you" field - HANDLE MULTIPLE SELECTIONS
      const professionField = fields[indices.profession] || "";
      const professions: string[] = [];
      const professionLower = professionField.toLowerCase();

      // Check for ALL selected professions (not just first match)
      if (professionLower.includes("developer")) professions.push("Developer");
      if (professionLower.includes("student")) professions.push("Student");
      if (professionLower.includes("creator")) professions.push("Creator");
      if (professionLower.includes("researcher"))
        professions.push("Researcher");
      if (
        professionLower.includes("founder") ||
        professionLower.includes("entrepreneur")
      )
        professions.push("Founder");
      if (professionLower.includes("designer")) professions.push("Designer");
      if (
        professionLower.includes("bd/sales") ||
        professionLower.includes("business")
      )
        professions.push("Business Development");
      if (professionLower.includes("marketing")) professions.push("Marketing");
      if (
        professionLower.includes("policy") ||
        professionLower.includes("lawyer")
      )
        professions.push("Policy/Legal");
      if (professionLower.includes("investor"))
        professions.push("Professional Investor");

      // If no matches found or empty, use "Other"
      const profession =
        professions.length > 0 ? professions.join(", ") : "Other";

      // Parse experience level more accurately
      const experienceField = fields[indices.experience] || "";
      const experienceLevel = parseExperienceLevel(experienceField);

      // Clean up source field
      const sourceField = fields[indices.source] || "";
      let source = "Unknown";
      const sourceLower = sourceField.toLowerCase();

      if (sourceLower.includes("friend") || sourceLower.includes("referral"))
        source = "Friend/Referral";
      else if (sourceLower.includes("x") || sourceLower.includes("twitter"))
        source = "X (Twitter)";
      else if (sourceLower.includes("linkedin")) source = "LinkedIn";
      else if (sourceLower.includes("instagram")) source = "Instagram";
      else if (sourceLower.includes("telegram")) source = "Telegram";
      else if (sourceLower.includes("other")) source = "Other";
      else if (sourceField.trim()) source = sourceField.trim();

      // Parse gender, school, transportation, dietary, and consent fields
      const gender = fields[indices.gender]?.trim() || "";
      const school = fields[indices.school]?.trim() || "";
      const transportation = fields[indices.transportation]?.trim() || "";
      const dietary = fields[indices.dietary]?.trim() || "";
      const photoConsent = fields[indices.photoConsent]?.trim() || "";
      const emailConsent = fields[indices.emailConsent]?.trim() || "";
      const xFollow = fields[indices.xFollow]?.trim() || "";
      const telegramJoin = fields[indices.telegramJoin]?.trim() || "";

      const registration: GuestRegistration = {
        id: fields[indices.id] || `guest-${i}`,
        timestamp: fields[indices.timestamp] || new Date().toISOString(),
        email: fields[indices.email] || "",
        firstName: fields[indices.firstName] || "",
        lastName: fields[indices.lastName] || "",
        country: country || "Nigeria", // Default to Nigeria for Nigerian event
        city: city || "",
        profession,
        company: fields[indices.company] || "",
        experience: experienceLevel,
        interests: professionField || "",
        source,
        status,
        gender: gender || undefined,
        school: school || undefined,
        transportation: transportation || undefined,
        dietary: dietary || undefined,
        photoConsent: photoConsent || undefined,
        emailConsent: emailConsent || undefined,
        xFollow: xFollow || undefined,
        telegramJoin: telegramJoin || undefined,
      };

      registrations.push(registration);
    } catch (error) {
      console.error(`Error parsing line ${i}:`, error);
      continue;
    }
  }

  // Only log in development
  if (process.env.NODE_ENV === "development") {
    console.log(`Parsed ${registrations.length} registrations from CSV`);
  }
  return registrations;
}

// Helper function to calculate professional roles breakdown
function calculateProfessionalRoles(registrations: GuestRegistration[]) {
  const roleCounts = new Map<string, number>();
  const totalResponses = registrations.length;

  registrations.forEach((reg) => {
    // Parse profession field that may contain multiple selections
    const professionField = reg.profession || "";
    const roles = [];
    const professionLower = professionField.toLowerCase();

    // Extract individual roles
    if (professionLower.includes("developer")) roles.push("Developer");
    if (professionLower.includes("student")) roles.push("Student");
    if (professionLower.includes("creator")) roles.push("Creator");
    if (professionLower.includes("researcher")) roles.push("Researcher");
    if (
      professionLower.includes("founder") ||
      professionLower.includes("entrepreneur")
    )
      roles.push("Founder");
    if (professionLower.includes("designer")) roles.push("Designer");
    if (
      professionLower.includes("bd/sales") ||
      professionLower.includes("business")
    )
      roles.push("Business Development");
    if (professionLower.includes("marketing")) roles.push("Marketing");
    if (
      professionLower.includes("policy") ||
      professionLower.includes("lawyer")
    )
      roles.push("Policy/Legal");
    if (professionLower.includes("investor"))
      roles.push("Professional Investor");

    // If no roles found, categorize as "Other"
    if (roles.length === 0) roles.push("Other");

    // Count each role (a person can have multiple roles)
    roles.forEach((role) => {
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    });
  });

  // Convert to array and calculate percentages
  const rolesArray = Array.from(roleCounts.entries())
    .map(([role, count]) => ({
      role,
      count,
      percentage: Math.round((count / totalResponses) * 100 * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  return rolesArray;
}

// Helper function to calculate educational institutions breakdown
function calculateEducationalInstitutions(registrations: GuestRegistration[]) {
  const institutionCounts = new Map<string, number>();
  const validInstitutions = registrations
    .map((reg) => reg.school?.trim())
    .filter(
      (school) =>
        school &&
        school !== "" &&
        school.toLowerCase() !== "n/a" &&
        school.toLowerCase() !== "none"
    );

  const totalResponses = validInstitutions.length;

  validInstitutions.forEach((institution) => {
    if (institution) {
      // Normalize institution names
      const normalizedName = institution
        .replace(/\buniversity\b/gi, "University")
        .replace(/\bcollege\b/gi, "College")
        .replace(/\binstitute\b/gi, "Institute")
        .trim();

      institutionCounts.set(
        normalizedName,
        (institutionCounts.get(normalizedName) || 0) + 1
      );
    }
  });

  // Convert to array and calculate percentages
  const institutionsArray = Array.from(institutionCounts.entries())
    .map(([institution, count]) => ({
      institution,
      count,
      percentage:
        totalResponses > 0
          ? Math.round((count / totalResponses) * 100 * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return institutionsArray;
}

// Helper function to calculate dietary requirements breakdown
function calculateDietaryRequirements(registrations: GuestRegistration[]) {
  const restrictionCounts = new Map<string, number>();
  let hasRestrictions = 0;
  let noRestrictions = 0;
  const allRestrictions: string[] = [];

  const totalResponses = registrations.length;

  registrations.forEach((reg) => {
    const dietaryField = reg.dietary?.toLowerCase() || "";

    // Check if they have no restrictions (common responses)
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

    const hasNoRestrictions =
      !dietaryField ||
      dietaryField.trim() === "" ||
      noRestrictionIndicators.some((indicator) =>
        dietaryField.includes(indicator)
      );

    if (hasNoRestrictions) {
      noRestrictions++;
    } else {
      hasRestrictions++;

      // Parse dietary restrictions from text
      const restrictions = [];
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
      if (
        dietaryLower.includes("seafood") ||
        dietaryLower.includes("shellfish")
      )
        restrictions.push("Seafood Allergy");
      if (
        dietaryLower.includes("diabetic") ||
        dietaryLower.includes("diabetes")
      )
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
    commonRestrictions: [...new Set(allRestrictions)].slice(0, 5), // Top 5 unique restrictions
  };
}

// Helper function to calculate consent analytics
function calculateConsentAnalytics(registrations: GuestRegistration[]) {
  const totalResponses = registrations.length;
  let photoConsentYes = 0;
  let photoConsentNo = 0;
  let emailConsentYes = 0;
  let emailConsentNo = 0;
  let xFollowed = 0;
  let telegramJoined = 0;

  registrations.forEach((reg) => {
    // Photo consent analysis
    const photoConsent = reg.photoConsent?.toLowerCase() || "";
    if (
      photoConsent.includes("yes") ||
      photoConsent.includes("done") ||
      photoConsent === "true"
    ) {
      photoConsentYes++;
    } else if (photoConsent.includes("no") || photoConsent === "false") {
      photoConsentNo++;
    }

    // Email consent analysis
    const emailConsent = reg.emailConsent?.toLowerCase() || "";
    if (
      emailConsent.includes("yes") ||
      emailConsent.includes("done") ||
      emailConsent === "true"
    ) {
      emailConsentYes++;
    } else if (emailConsent.includes("no") || emailConsent === "false") {
      emailConsentNo++;
    }

    // Social media engagement
    const xFollow = reg.xFollow?.toLowerCase() || "";
    if (
      xFollow.includes("done") ||
      xFollow.includes("yes") ||
      xFollow.includes("followed")
    ) {
      xFollowed++;
    }

    const telegramJoin = reg.telegramJoin?.toLowerCase() || "";
    if (
      telegramJoin.includes("done") ||
      telegramJoin.includes("yes") ||
      telegramJoin.includes("joined")
    ) {
      telegramJoined++;
    }
  });

  // Calculate percentages
  const photoPercentage =
    totalResponses > 0
      ? Math.round((photoConsentYes / totalResponses) * 100)
      : 0;
  const emailPercentage =
    totalResponses > 0
      ? Math.round((emailConsentYes / totalResponses) * 100)
      : 0;
  const xPercentage =
    totalResponses > 0 ? Math.round((xFollowed / totalResponses) * 100) : 0;
  const telegramPercentage =
    totalResponses > 0
      ? Math.round((telegramJoined / totalResponses) * 100)
      : 0;

  // Overall compliance score
  const complianceScore = Math.round(
    (photoPercentage + emailPercentage + xPercentage + telegramPercentage) / 4
  );

  return {
    totalResponses,
    photoConsent: {
      yes: photoConsentYes,
      no: photoConsentNo,
      percentage: photoPercentage,
    },
    emailConsent: {
      yes: emailConsentYes,
      no: emailConsentNo,
      percentage: emailPercentage,
    },
    socialEngagement: {
      xFollowed,
      telegramJoined,
      xPercentage,
      telegramPercentage,
    },
    complianceScore,
  };
}

// Function to process CSV data or database results into dashboard stats
function calculateDashboardStats(registrations: GuestRegistration[]) {
  const now = new Date().toISOString();

  // Ensure we have valid data
  if (!registrations || registrations.length === 0) {
    return {
      totalGuests: 0,
      confirmedGuests: 0,
      pendingGuests: 0,
      cancelledGuests: 0,
      countriesRepresented: 0,
      citiesRepresented: 0,
      averageExperience: 0,
      topInterests: [],
      registrationTrend: [],
      locationBreakdown: [],
      recentRegistrations: [],
      lastUpdated: now,
    };
  }

  // Basic counts
  const totalGuests = registrations.length;
  const confirmedGuests = registrations.filter(
    (r) => r.status === "confirmed"
  ).length;
  const pendingGuests = registrations.filter(
    (r) => r.status === "pending"
  ).length;
  const cancelledGuests = registrations.filter(
    (r) => r.status === "cancelled"
  ).length;

  // Geographic analysis - countries are already normalized during parsing
  const validCountries = registrations
    .map((r) => r.country)
    .filter(
      (country) => country && country.trim() !== "" && country !== "Unknown"
    );
  const countryCount = new Set(validCountries).size;

  const validCities = registrations
    .filter(
      (r) =>
        r.city &&
        r.city.trim() !== "" &&
        r.city !== "Unknown" &&
        r.country &&
        r.country.trim() !== "" &&
        r.country !== "Unknown"
    )
    .map((r) => `${r.city.trim()}, ${r.country.trim()}`);
  const cityCount = new Set(validCities).size;

  // Experience level analysis - now using categorical data
  const experienceCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    if (reg.experience && reg.experience !== "Unknown") {
      experienceCounts[reg.experience] =
        (experienceCounts[reg.experience] || 0) + 1;
    }
  });

  // Create experience breakdown with percentages
  const experienceBreakdown = Object.entries(experienceCounts)
    .map(([level, count]) => ({
      level,
      count,
      percentage: totalGuests > 0 ? (count / totalGuests) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Get the most common experience level
  const topExperienceLevel =
    experienceBreakdown.length > 0 ? experienceBreakdown[0].level : "Unknown";

  // Calculate a numeric score for average (Newcomer=1, Intermediate=2, Advanced=3, Web2=2.5)
  const experienceScores: number[] = registrations
    .map((r) => {
      const exp = r.experience;
      if (exp === "Newcomer") return 1;
      else if (exp === "Intermediate") return 2;
      else if (exp === "Web2 Transitioning") return 2.5;
      else if (exp === "Advanced") return 3;
      else return 0;
    })
    .filter((score) => score > 0);

  const averageExperience =
    experienceScores.length > 0
      ? experienceScores.reduce((sum, score) => sum + score, 0) /
        experienceScores.length
      : 0;

  // Interest/Profession analysis - handle multiple selections correctly
  const professionCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    if (
      reg.profession &&
      reg.profession !== "Other" &&
      reg.profession !== "Unknown"
    ) {
      // Handle multiple professions (comma-separated)
      const individualProfessions = reg.profession
        .split(", ")
        .map((p) => p.trim());

      individualProfessions.forEach((profession) => {
        if (profession && profession !== "Other" && profession !== "Unknown") {
          professionCounts[profession] =
            (professionCounts[profession] || 0) + 1;
        }
      });
    }
  });

  const topInterests = Object.entries(professionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([interest, count]) => ({ interest, count }));

  // Registration trends (weekly) - handle invalid dates
  const registrationsByWeek: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    try {
      const date = new Date(reg.timestamp);
      if (isNaN(date.getTime())) {
        // Use current date if timestamp is invalid
        const fallbackDate = new Date();
        // Create new date object to avoid mutation
        const weekStart = new Date(fallbackDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0); // Start of day
        const weekKey = weekStart.toISOString().split("T")[0];
        registrationsByWeek[weekKey] = (registrationsByWeek[weekKey] || 0) + 1;
      } else {
        // Create new date object to avoid mutation
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0); // Start of day
        const weekKey = weekStart.toISOString().split("T")[0];
        registrationsByWeek[weekKey] = (registrationsByWeek[weekKey] || 0) + 1;
      }
    } catch {
      // Only warn in development
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "Invalid timestamp for registration:",
          reg.id,
          reg.timestamp
        );
      }
    }
  });

  const registrationTrend = Object.entries(registrationsByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8) // Last 8 weeks
    .map(([date, count]) => ({
      date,
      count: count > registrations.length ? registrations.length : count, // Cap at total registrations as sanity check
    }));

  // Debug logging in development
  if (process.env.NODE_ENV === "development") {
    const totalTrendCount = registrationTrend.reduce(
      (sum, t) => sum + t.count,
      0
    );
    console.log("Registration Trends Debug:", {
      totalRegistrations: registrations.length,
      weekCounts: registrationsByWeek,
      trendData: registrationTrend,
      trendTotal: totalTrendCount,
      possibleIssue:
        totalTrendCount > registrations.length
          ? "POTENTIAL DATA DUPLICATION DETECTED"
          : "Data looks normal",
      maxWeeklyCount: Math.max(...registrationTrend.map((t) => t.count)),
      avgWeeklyCount:
        registrationTrend.length > 0
          ? Math.round(
              registrationTrend.reduce((sum, t) => sum + t.count, 0) /
                registrationTrend.length
            )
          : 0,
    });
  }

  // Location breakdown - countries are already normalized during parsing
  const locationCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    const country =
      reg.country && reg.country.trim() !== "" && reg.country !== "Unknown"
        ? reg.country.trim()
        : "Unknown";
    locationCounts[country] = (locationCounts[country] || 0) + 1;
  });

  const locationBreakdown = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([country, count]) => ({
      country,
      count,
      percentage: totalGuests > 0 ? (count / totalGuests) * 100 : 0,
    }));

  // Traffic Sources Analysis
  const sourceCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    const source = reg.source || "Unknown";
    // Normalize source names for better grouping
    let normalizedSource = source;
    if (
      source.toLowerCase().includes("x (twitter)") ||
      source.toLowerCase().includes("twitter")
    ) {
      normalizedSource = "X (Twitter)";
    } else if (source.toLowerCase().includes("instagram")) {
      normalizedSource = "Instagram";
    } else if (source.toLowerCase().includes("linkedin")) {
      normalizedSource = "LinkedIn";
    } else if (
      source.toLowerCase().includes("friend") ||
      source.toLowerCase().includes("referral")
    ) {
      normalizedSource = "Friend/Referral";
    } else if (
      source.toLowerCase().includes("other") ||
      source.toLowerCase().includes("unknown")
    ) {
      normalizedSource = source === "Unknown" ? "Unknown" : "Other";
    }

    sourceCounts[normalizedSource] = (sourceCounts[normalizedSource] || 0) + 1;
  });

  const trafficSources = Object.entries(sourceCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([source, count]) => ({
      source,
      count,
      percentage: totalGuests > 0 ? (count / totalGuests) * 100 : 0,
    }));

  // Company/Project Analysis
  const companyCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    const company = reg.company?.trim();
    if (
      company &&
      company.toLowerCase() !== "n/a" &&
      company.toLowerCase() !== "none" &&
      company.toLowerCase() !== "nil" &&
      company.toLowerCase() !== "nill" &&
      company.toLowerCase() !== "non" &&
      company.toLowerCase() !== "none for now" &&
      company.toLowerCase() !== "myself" &&
      company !== "" &&
      company.length > 2
    ) {
      companyCounts[company] = (companyCounts[company] || 0) + 1;
    }
  });

  const topCompanies = Object.entries(companyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([company, count]) => ({ company, count }));

  // Registration Time Patterns
  const registrationsByHour: { [key: number]: number } = {};
  const registrationsByDay: { [key: string]: number } = {};

  registrations.forEach((reg) => {
    try {
      const date = new Date(reg.timestamp);
      if (!isNaN(date.getTime())) {
        // Hour analysis (0-23)
        const hour = date.getHours();
        registrationsByHour[hour] = (registrationsByHour[hour] || 0) + 1;

        // Day of week analysis
        const days = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const dayName = days[date.getDay()];
        registrationsByDay[dayName] = (registrationsByDay[dayName] || 0) + 1;
      }
    } catch {
      // Skip invalid timestamps
    }
  });

  const peakRegistrationHour = Object.entries(registrationsByHour).sort(
    ([, a], [, b]) => b - a
  )[0];

  const registrationTimePatterns = {
    peakHour: peakRegistrationHour
      ? {
          hour: parseInt(peakRegistrationHour[0]),
          count: peakRegistrationHour[1],
        }
      : null,
    byDay: Object.entries(registrationsByDay)
      .sort(([, a], [, b]) => b - a)
      .map(([day, count]) => ({ day, count })),
    byHour: Object.entries(registrationsByHour)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour),
  };

  // Gender Distribution Analysis
  const genderCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    if (reg.gender) {
      const normalizedGender = reg.gender.toLowerCase().trim();
      if (normalizedGender === "male" || normalizedGender === "m") {
        genderCounts["Male"] = (genderCounts["Male"] || 0) + 1;
      } else if (normalizedGender === "female" || normalizedGender === "f") {
        genderCounts["Female"] = (genderCounts["Female"] || 0) + 1;
      } else if (normalizedGender !== "" && normalizedGender !== "n/a") {
        genderCounts["Other/Prefer not to say"] =
          (genderCounts["Other/Prefer not to say"] || 0) + 1;
      }
    }
  });

  const genderBreakdown = Object.entries(genderCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([gender, count]) => ({
      gender,
      count,
      percentage: totalGuests > 0 ? (count / totalGuests) * 100 : 0,
    }));

  // Education Sector Analysis - handle multiple professions
  const studentCount = registrations.filter(
    (reg) =>
      (reg.profession && reg.profession.includes("Student")) ||
      (reg.school &&
        reg.school.length > 2 &&
        reg.school.toLowerCase() !== "n/a")
  ).length;

  const professionalCount = registrations.filter((reg) => {
    if (!reg.profession) return false;

    const professions = reg.profession.split(", ");
    // Consider as professional if they have any non-student, non-other profession
    return professions.some(
      (prof) =>
        prof.trim() !== "Student" &&
        prof.trim() !== "Other" &&
        prof.trim() !== "Unknown"
    );
  }).length;

  const topSchools: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    if (
      reg.school &&
      reg.school.length > 2 &&
      reg.school.toLowerCase() !== "n/a"
    ) {
      const school = reg.school.trim();
      topSchools[school] = (topSchools[school] || 0) + 1;
    }
  });

  const educationInsights = {
    studentCount,
    professionalCount,
    studentPercentage: totalGuests > 0 ? (studentCount / totalGuests) * 100 : 0,
    professionalPercentage:
      totalGuests > 0 ? (professionalCount / totalGuests) * 100 : 0,
    topSchools: Object.entries(topSchools)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([school, count]) => ({ school, count })),
  };

  // Approval Status Analysis by Profession
  const developerStats = {
    approved: registrations.filter(
      (r) => r.profession?.includes("Developer") && r.status === "confirmed"
    ).length,
    pending: registrations.filter(
      (r) => r.profession?.includes("Developer") && r.status === "pending"
    ).length,
    declined: registrations.filter(
      (r) => r.profession?.includes("Developer") && r.status === "cancelled"
    ).length,
    total: registrations.filter((r) => r.profession?.includes("Developer"))
      .length,
  };

  const designerStats = {
    approved: registrations.filter(
      (r) =>
        (r.profession?.includes("Creator") ||
          r.profession?.includes("Designer")) &&
        r.status === "confirmed"
    ).length,
    pending: registrations.filter(
      (r) =>
        (r.profession?.includes("Creator") ||
          r.profession?.includes("Designer")) &&
        r.status === "pending"
    ).length,
    declined: registrations.filter(
      (r) =>
        (r.profession?.includes("Creator") ||
          r.profession?.includes("Designer")) &&
        r.status === "cancelled"
    ).length,
    total: registrations.filter(
      (r) =>
        r.profession?.includes("Creator") || r.profession?.includes("Designer")
    ).length,
  };

  const founderStats = {
    approved: registrations.filter(
      (r) => r.profession?.includes("Founder") && r.status === "confirmed"
    ).length,
    pending: registrations.filter(
      (r) => r.profession?.includes("Founder") && r.status === "pending"
    ).length,
    declined: registrations.filter(
      (r) => r.profession?.includes("Founder") && r.status === "cancelled"
    ).length,
    total: registrations.filter((r) => r.profession?.includes("Founder"))
      .length,
  };

  const studentStats = {
    approved: registrations.filter(
      (r) => r.profession?.includes("Student") && r.status === "confirmed"
    ).length,
    pending: registrations.filter(
      (r) => r.profession?.includes("Student") && r.status === "pending"
    ).length,
    declined: registrations.filter(
      (r) => r.profession?.includes("Student") && r.status === "cancelled"
    ).length,
    total: registrations.filter((r) => r.profession?.includes("Student"))
      .length,
  };

  const approvalBreakdown = {
    approvedDevelopers: developerStats.approved,
    pendingDevelopers: developerStats.pending,
    declinedDevelopers: developerStats.declined,
    totalDevelopers: developerStats.total,
    developerApprovalRate:
      developerStats.total > 0
        ? (developerStats.approved / developerStats.total) * 100
        : 0,
    approvedCreators: designerStats.approved,
    pendingCreators: designerStats.pending,
    declinedCreators: designerStats.declined,
    totalCreators: designerStats.total,
    creatorApprovalRate:
      designerStats.total > 0
        ? (designerStats.approved / designerStats.total) * 100
        : 0,
    approvedFounders: founderStats.approved,
    pendingFounders: founderStats.pending,
    declinedFounders: founderStats.declined,
    totalFounders: founderStats.total,
    founderApprovalRate:
      founderStats.total > 0
        ? (founderStats.approved / founderStats.total) * 100
        : 0,
    approvedStudents: studentStats.approved,
    pendingStudents: studentStats.pending,
    declinedStudents: studentStats.declined,
    totalStudents: studentStats.total,
    studentApprovalRate:
      studentStats.total > 0
        ? (studentStats.approved / studentStats.total) * 100
        : 0,
    overallApprovalRate:
      totalGuests > 0 ? (confirmedGuests / totalGuests) * 100 : 0,
  };

  // Advanced Analytics Breakdown
  // 1. Application Quality Analysis
  const completeApplications = registrations.filter(
    (r) =>
      r.email &&
      r.firstName &&
      r.lastName &&
      r.country &&
      r.city &&
      r.profession &&
      r.company &&
      r.experience
  ).length;
  const partialApplications = totalGuests - completeApplications;
  const completionRate =
    totalGuests > 0 ? (completeApplications / totalGuests) * 100 : 0;

  // 2. Source Quality Analysis
  const sourceQualityMap: {
    [key: string]: { applications: number; approved: number };
  } = {};
  registrations.forEach((r) => {
    const source = r.source || "Unknown";
    if (!sourceQualityMap[source]) {
      sourceQualityMap[source] = { applications: 0, approved: 0 };
    }
    sourceQualityMap[source].applications++;
    if (r.status === "confirmed") {
      sourceQualityMap[source].approved++;
    }
  });

  const sourceQuality = Object.entries(sourceQualityMap)
    .map(([source, stats]) => ({
      source,
      applications: stats.applications,
      approvalRate:
        stats.applications > 0
          ? (stats.approved / stats.applications) * 100
          : 0,
      qualityScore:
        stats.applications > 0
          ? (stats.approved / stats.applications) * 100
          : 0,
    }))
    .sort((a, b) => b.applications - a.applications)
    .slice(0, 5);

  // 3. Geographic Analysis
  const africanCountriesSet = new Set();
  const cityCountMap: {
    [key: string]: { city: string; country: string; count: number };
  } = {};

  registrations.forEach((r) => {
    if (r.country && r.country !== "Unknown") {
      africanCountriesSet.add(r.country);

      if (r.city && r.city !== "Unknown") {
        const key = `${r.city}, ${r.country}`;
        if (!cityCountMap[key]) {
          cityCountMap[key] = { city: r.city, country: r.country, count: 0 };
        }
        cityCountMap[key].count++;
      }
    }
  });

  const africanCountries = africanCountriesSet.size;
  const topAfricanCities = Object.values(cityCountMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Diversity score based on country distribution
  const countryDistribution = Array.from(africanCountriesSet).length;
  const diversityScore = Math.min((countryDistribution / 10) * 100, 100); // Max score at 10+ countries

  // 4. Experience Distribution with Approval Rates
  const expStats = {
    newcomer: { total: 0, approved: 0 },
    intermediate: { total: 0, approved: 0 },
    advanced: { total: 0, approved: 0 },
    web2Transitioning: { total: 0, approved: 0 },
  };

  registrations.forEach((r) => {
    const exp = r.experience; // Already normalized by parseExperienceLevel
    if (exp === "Newcomer") {
      expStats.newcomer.total++;
      if (r.status === "confirmed") expStats.newcomer.approved++;
    } else if (exp === "Intermediate") {
      expStats.intermediate.total++;
      if (r.status === "confirmed") expStats.intermediate.approved++;
    } else if (exp === "Advanced") {
      expStats.advanced.total++;
      if (r.status === "confirmed") expStats.advanced.approved++;
    } else if (exp === "Web2 Transitioning") {
      expStats.web2Transitioning.total++;
      if (r.status === "confirmed") expStats.web2Transitioning.approved++;
    }
  });

  const experienceDistribution = {
    newcomer: {
      count: expStats.newcomer.total,
      percentage:
        totalGuests > 0 ? (expStats.newcomer.total / totalGuests) * 100 : 0,
      approvalRate:
        expStats.newcomer.total > 0
          ? (expStats.newcomer.approved / expStats.newcomer.total) * 100
          : 0,
    },
    intermediate: {
      count: expStats.intermediate.total,
      percentage:
        totalGuests > 0 ? (expStats.intermediate.total / totalGuests) * 100 : 0,
      approvalRate:
        expStats.intermediate.total > 0
          ? (expStats.intermediate.approved / expStats.intermediate.total) * 100
          : 0,
    },
    advanced: {
      count: expStats.advanced.total,
      percentage:
        totalGuests > 0 ? (expStats.advanced.total / totalGuests) * 100 : 0,
      approvalRate:
        expStats.advanced.total > 0
          ? (expStats.advanced.approved / expStats.advanced.total) * 100
          : 0,
    },
    web2Transitioning: {
      count: expStats.web2Transitioning.total,
      percentage:
        totalGuests > 0
          ? (expStats.web2Transitioning.total / totalGuests) * 100
          : 0,
      approvalRate:
        expStats.web2Transitioning.total > 0
          ? (expStats.web2Transitioning.approved /
              expStats.web2Transitioning.total) *
            100
          : 0,
    },
  };

  // 5. Community & Company Analysis
  const uniqueCompanies = new Set(
    registrations.map((r) => r.company).filter((c) => c && c.trim() !== "")
  ).size;
  const referralCount = registrations.filter(
    (r) =>
      r.source?.toLowerCase().includes("referral") ||
      r.source?.toLowerCase().includes("friend")
  ).length;
  const referralRate =
    totalGuests > 0 ? (referralCount / totalGuests) * 100 : 0;

  // Company type classification
  const companyTypeMap: { [key: string]: number } = {};
  registrations.forEach((r) => {
    if (r.company && r.company.trim() !== "") {
      const company = r.company.toLowerCase();
      let type = "Other";

      if (
        company.includes("startup") ||
        company.includes("tech") ||
        company.includes("software")
      ) {
        type = "Tech Startup";
      } else if (
        company.includes("university") ||
        company.includes("college") ||
        company.includes("school")
      ) {
        type = "Educational";
      } else if (
        company.includes("bank") ||
        company.includes("finance") ||
        company.includes("fintech")
      ) {
        type = "Financial Services";
      } else if (
        company.includes("consulting") ||
        company.includes("advisory")
      ) {
        type = "Consulting";
      }

      companyTypeMap[type] = (companyTypeMap[type] || 0) + 1;
    }
  });

  const topCompanyTypes = Object.entries(companyTypeMap)
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalGuests > 0 ? (count / totalGuests) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Transportation Analytics
  // Privacy-first approach: normalize locations to prevent PII exposure
  // and apply k-anonymity to only show locations with sufficient count
  const transportationRequests = registrations.filter(
    (r) => r.transportation && r.transportation.trim() !== ""
  );
  const totalTransportationRequests = transportationRequests.length;
  const transportationPercentage =
    totalGuests > 0 ? (totalTransportationRequests / totalGuests) * 100 : 0;

  // Count transportation locations
  const transportationLocationCounts = new Map<string, number>();
  transportationRequests.forEach((r) => {
    if (r.transportation) {
      const location = normalizeTransportLocation(r.transportation);
      transportationLocationCounts.set(
        location,
        (transportationLocationCounts.get(location) || 0) + 1
      );
    }
  });

  const MIN_K = 3; // k-anonymity threshold to reduce PII risk
  const topTransportationLocations = Array.from(
    transportationLocationCounts.entries()
  )
    .filter(([, count]) => count >= MIN_K)
    .map(([location, count]) => ({
      location,
      count,
      percentage:
        totalTransportationRequests > 0
          ? (count / totalTransportationRequests) * 100
          : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Group by transportation zones (major areas)
  const transportationZones = new Map<string, number>();
  transportationRequests.forEach((r) => {
    if (r.transportation) {
      const location = normalizeTransportLocation(r.transportation);
      const zone = classifyTransportZone(location);
      transportationZones.set(zone, (transportationZones.get(zone) || 0) + 1);
    }
  });

  const transportationBreakdown = Array.from(transportationZones.entries())
    .map(([zone, count]) => ({
      zone,
      count,
      percentage:
        totalTransportationRequests > 0
          ? (count / totalTransportationRequests) * 100
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const transportationInsights = {
    totalTransportationRequests,
    transportationPercentage,
    // Only expose detailed locations in development or when explicitly enabled
    topLocations:
      process.env.NODE_ENV === "development" ||
      process.env.SHOW_TRANSPORT_DETAILS === "true"
        ? topTransportationLocations
        : [],
    transportationBreakdown,
  };

  const analyticsBreakdown = {
    completeApplications,
    partialApplications,
    completionRate,
    sourceQuality,
    africanCountries,
    topAfricanCities,
    diversityScore,
    experienceDistribution,
    pendingApplications: pendingGuests,
    conversionRate: totalGuests > 0 ? (confirmedGuests / totalGuests) * 100 : 0,
    uniqueCompanies,
    referralRate,
    topCompanyTypes,
  };

  return {
    totalGuests,
    confirmedGuests,
    pendingGuests,
    cancelledGuests,
    countriesRepresented: countryCount,
    citiesRepresented: cityCount,
    averageExperience: isNaN(averageExperience)
      ? 0
      : Math.round(averageExperience * 10) / 10,
    experienceBreakdown,
    topExperienceLevel,
    topInterests,
    registrationTrend,
    locationBreakdown,
    trafficSources,
    topCompanies,
    registrationTimePatterns,
    genderBreakdown,
    educationInsights,
    approvalBreakdown,
    analyticsBreakdown,
    transportationInsights,
    professionalRoles: calculateProfessionalRoles(registrations),
    educationalInstitutions: calculateEducationalInstitutions(registrations),
    dietaryRequirements: calculateDietaryRequirements(registrations),
    consentAnalytics: calculateConsentAnalytics(registrations),
    recentRegistrations: registrations
      .filter((r) => r.status === "confirmed")
      .sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10),
    lastUpdated: now,
  };
}

// Simple function to load guest data from Google Sheets or local file (dev only)
async function loadGuestData(): Promise<GuestRegistration[]> {
  try {
    // Option 1: Google Sheets URL (production and development)
    if (process.env.GOOGLE_SHEETS_CSV_URL) {
      const response = await fetch(process.env.GOOGLE_SHEETS_CSV_URL);
      if (response.ok) {
        const csvContent = await response.text();
        const registrations = parseGuestCSV(csvContent);

        if (process.env.NODE_ENV === "development") {
          console.log(
            `🌐 Loaded ${registrations.length} registrations from Google Sheets`
          );
        }
        return registrations;
      }
    }

    // Option 2: Local file (development fallback only)
    const csvPath = path.join(
      process.cwd(),
      "data",
      "secure",
      "guest-list.csv"
    );

    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, "utf8");
      const registrations = parseGuestCSV(csvContent);

      if (process.env.NODE_ENV === "development") {
        console.log(
          `� Loaded ${registrations.length} registrations from local file`
        );
      }
      return registrations;
    }

    // No data source available
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "⚠️ No data source available. Please set GOOGLE_SHEETS_CSV_URL environment variable."
      );
    }
    return [];
  } catch (error) {
    console.error("❌ Error loading guest data:", error);
    return [];
  }
}

export async function GET() {
  try {
    // Load the guest registration data
    const guestData = await loadGuestData();

    // Calculate dashboard statistics
    const stats = calculateDashboardStats(guestData);

    return NextResponse.json(stats, {
      headers: {
        ...PRIVATE_HEADERS,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      {
        error: "Failed to load dashboard data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: POST endpoint for manual data refresh/upload
export async function POST(request: NextRequest) {
  try {
    // This could be used to trigger a data refresh or upload new CSV data
    const body = await request.json();

    if (body.action === "refresh") {
      // Trigger data refresh
      const guestData = await loadGuestData();
      const stats = calculateDashboardStats(guestData);

      return NextResponse.json({
        success: true,
        message: "Data refreshed successfully",
        stats,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Dashboard POST API error:", error);

    return NextResponse.json(
      {
        error: "Failed to process request",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
