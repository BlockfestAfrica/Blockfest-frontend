// Utility functions for processing guest registration data

export interface GuestRegistration {
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
}

/**
 * Parse CSV content into guest registration objects
 * @param csvContent - Raw CSV content as string
 * @returns Array of GuestRegistration objects
 */
export function parseCSVData(csvContent: string): GuestRegistration[] {
  const lines = csvContent.trim().split("\n");
  console.log(`CSV parsing: ${lines.length} lines found`);

  if (lines.length < 2) {
    console.log("CSV parsing: Not enough lines");
    return [];
  }

  const headers = parseCSVLine(lines[0]);
  console.log(`CSV headers (first 10):`, headers.slice(0, 10));
  console.log(
    `Looking for location header:`,
    headers.find(
      (h) =>
        h.toLowerCase().includes("city") && h.toLowerCase().includes("country")
    )
  );

  const registrations: GuestRegistration[] = [];

  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    // Process first 5 rows for debugging
    console.log(`\n--- Processing Row ${i} ---`);
    const values = parseCSVLine(lines[i]);

    if (values.length === 0) {
      console.log(`Row ${i}: Empty row, skipping`);
      continue;
    }

    // Be more lenient with column count - allow missing columns at the end
    if (values.length < headers.length - 5) {
      // Allow up to 5 missing columns
      console.log(
        `Row ${i}: Too few columns. Expected ~${headers.length}, got ${values.length}. Skipping.`
      );
      continue;
    }

    if (values.length !== headers.length) {
      console.log(
        `Row ${i}: Column count mismatch. Expected ${headers.length}, got ${values.length}. Processing anyway.`
      );
    }

    const registration: Record<string, string> = {};
    headers.forEach((header, index) => {
      const mappedField = mapHeaderToField(header);
      registration[mappedField] = values[index] || ""; // Default to empty string if missing

      // Debug key field mappings
      if (
        [
          "id",
          "name",
          "firstName",
          "lastName",
          "email",
          "status",
          "country",
          "experience",
        ].includes(mappedField)
      ) {
        console.log(
          `  ${header} -> ${mappedField} = "${values[index] || "MISSING"}"`
        );
      }
    });

    // Validate required fields and process location
    if (registration.email && (registration.firstName || registration.name)) {
      console.log(
        `  ✓ Valid registration found for: ${
          registration.firstName || registration.name
        } (${registration.email})`
      );

      // Extract city and country from combined field
      // The CSV has "City & Country of Residence" which gets mapped to "country"
      let city = "";
      let country = "";

      const locationField = registration.country || "";
      console.log(`  Raw location field: "${locationField}"`);

      if (
        locationField &&
        locationField.trim() !== "" &&
        locationField.toLowerCase() !== "unknown"
      ) {
        if (locationField.includes(",")) {
          const parts = locationField.split(",").map((p) => p.trim());
          if (parts.length >= 2) {
            city = parts[0];
            country = parts[1];
          } else if (parts.length === 1) {
            // If only one part, assume it's the country
            country = parts[0];
          }
          console.log(
            `  Location parsed from comma: City="${city}", Country="${country}"`
          );
        } else {
          // If no comma, try to determine if it's a city or country
          const cleaned = locationField.trim().replace(/\.$/, ""); // Remove trailing period

          // Common Nigerian cities that might be listed without country
          const nigerianCities = [
            "lagos",
            "abuja",
            "ibadan",
            "kano",
            "port harcourt",
            "benin",
            "kaduna",
            "jos",
            "warri",
            "enugu",
          ];

          if (nigerianCities.includes(cleaned.toLowerCase())) {
            city = cleaned;
            country = "Nigeria";
            console.log(
              `  Location inferred Nigerian city: City="${city}", Country="${country}"`
            );
          } else {
            // Assume it's a country
            country = cleaned;
            console.log(`  Location (no comma): Country="${country}"`);
          }
        }

        // Clean up country name
        if (country) {
          country = country.replace(/\.$/, "").trim(); // Remove trailing periods
          if (country.toLowerCase() === "nigeria") {
            country = "Nigeria"; // Normalize case
          }
        }
      } else {
        console.log(`  No valid location data found`);
      }

      // Parse experience level into numeric value
      let experienceLevel = "0";
      const expText = registration.experience || "";
      if (expText.toLowerCase().includes("newcomer")) {
        experienceLevel = "1";
      } else if (expText.toLowerCase().includes("intermediate")) {
        experienceLevel = "2";
      } else if (expText.toLowerCase().includes("advanced")) {
        experienceLevel = "4";
      } else if (expText.toLowerCase().includes("web2 professional")) {
        experienceLevel = "3";
      }
      console.log(`  Experience: "${expText}" -> ${experienceLevel}`);

      registrations.push({
        id: registration.id || generateId(),
        timestamp: registration.timestamp || new Date().toISOString(),
        email: registration.email,
        firstName: registration.firstName || registration.name || "",
        lastName: registration.lastName || "",
        country: country || "Unknown",
        city: city || "Unknown",
        profession: registration.profession || "",
        company: registration.company || "",
        experience: experienceLevel,
        interests: registration.interests || "",
        source: registration.source || "direct",
        status: validateStatus(registration.status || "") || "confirmed", // Default approved to confirmed
      });
    } else {
      console.log(`  ✗ Invalid registration - missing email or name`);
    }
  }

  // If first 5 rows worked, process the rest without detailed logging
  if (registrations.length > 0 && lines.length > 6) {
    console.log(
      `\nFirst 5 rows successful, processing remaining ${
        lines.length - 6
      } rows...`
    );

    for (let i = 6; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      // Skip empty rows or rows with too few columns
      if (values.length === 0 || values.length < headers.length - 5) continue;

      const registration: Record<string, string> = {};
      headers.forEach((header, index) => {
        registration[mapHeaderToField(header)] = values[index] || "";
      });

      if (registration.email && (registration.firstName || registration.name)) {
        // Extract city and country from the location field
        // The CSV has "City & Country of Residence" which maps to "country" field
        let city = "";
        let country = "";

        const locationField = registration.country || "";

        if (
          locationField &&
          locationField.trim() !== "" &&
          locationField.toLowerCase() !== "unknown"
        ) {
          if (locationField.includes(",")) {
            const parts = locationField.split(",").map((p) => p.trim());
            if (parts.length >= 2) {
              city = parts[0];
              country = parts[1];
            } else if (parts.length === 1) {
              country = parts[0];
            }
          } else {
            // If no comma, try to determine if it's a city or country
            const cleaned = locationField.trim().replace(/\.$/, ""); // Remove trailing period

            // Common Nigerian cities that might be listed without country
            const nigerianCities = [
              "lagos",
              "abuja",
              "ibadan",
              "kano",
              "port harcourt",
              "benin",
              "kaduna",
              "jos",
              "warri",
              "enugu",
            ];

            if (nigerianCities.includes(cleaned.toLowerCase())) {
              city = cleaned;
              country = "Nigeria";
            } else {
              country = cleaned;
            }
          }

          // Clean up country name
          if (country) {
            country = country.replace(/\.$/, "").trim(); // Remove trailing periods
            if (country.toLowerCase() === "nigeria") {
              country = "Nigeria"; // Normalize case
            }
          }
        }

        let experienceLevel = "0";
        const expText = registration.experience || "";
        if (expText.toLowerCase().includes("newcomer")) {
          experienceLevel = "1";
        } else if (expText.toLowerCase().includes("intermediate")) {
          experienceLevel = "2";
        } else if (expText.toLowerCase().includes("advanced")) {
          experienceLevel = "4";
        } else if (expText.toLowerCase().includes("web2 professional")) {
          experienceLevel = "3";
        }

        registrations.push({
          id: registration.id || generateId(),
          timestamp: registration.timestamp || new Date().toISOString(),
          email: registration.email,
          firstName: registration.firstName || registration.name || "",
          lastName: registration.lastName || "",
          country: country || "Unknown",
          city: city || "Unknown",
          profession: registration.profession || "",
          company: registration.company || "",
          experience: experienceLevel,
          interests: registration.interests || "",
          source: registration.source || "direct",
          status: validateStatus(registration.status || "") || "confirmed",
        });
      }
    }
  }

  console.log(
    `Successfully parsed ${registrations.length} registrations from ${
      lines.length - 1
    } total rows`
  );
  return registrations;
}

/**
 * Parse a single CSV line, handling quoted values and commas
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map((v) => v.replace(/^"|"$/g, ""));
}

/**
 * Map CSV headers to our field names
 */
function mapHeaderToField(header: string): string {
  const headerMap: { [key: string]: string } = {
    // Basic info from actual CSV
    api_id: "id",
    email: "email",
    first_name: "firstName",
    last_name: "lastName",
    name: "name", // Keep as name for fallback
    created_at: "timestamp",
    approval_status: "status",

    // Location info from actual CSV headers
    "city & country of residence (e.g abuja, nigeria)": "country",
    "city & country of residence": "country",

    // Professional info from actual CSV headers
    "what is your role at the company?": "profession",
    "which project or company are you representing? (if any)?": "company",
    "what is your current experience level in web3?": "experience",
    "which of the following best describes you? select all that applies":
      "interests",

    // Source tracking from actual CSV
    custom_source: "source",
    "how did you hear about this event?": "source",

    // Fallback mappings for common variations
    city: "city",
    country: "country",
    profession: "profession",
    "job title": "profession",
    organization: "company",
    experience: "experience",
    interests: "interests",
    source: "source",
    status: "status",
    timestamp: "timestamp",
    date: "timestamp",
    id: "id",
  };

  const normalizedHeader = header.toLowerCase().trim();
  return (
    headerMap[normalizedHeader] || normalizedHeader.replace(/[^a-zA-Z0-9]/g, "")
  );
}

/**
 * Validate status field
 */
function validateStatus(
  status: string
): "confirmed" | "pending" | "cancelled" | null {
  if (!status) return null;

  const normalized = status.toLowerCase().trim();

  if (
    [
      "confirmed",
      "confirm",
      "active",
      "approved",
      "approve",
      "yes",
      "accepted",
    ].includes(normalized)
  ) {
    return "confirmed";
  }

  if (
    ["pending", "waiting", "review", "maybe", "submitted"].includes(normalized)
  ) {
    return "pending";
  }

  if (
    ["cancelled", "canceled", "declined", "rejected", "no", "denied"].includes(
      normalized
    )
  ) {
    return "cancelled";
  }

  return null;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate guest registration data
 */
export function validateGuestData(registrations: GuestRegistration[]): {
  valid: GuestRegistration[];
  invalid: Array<{ data: GuestRegistration; errors: string[] }>;
} {
  const valid: GuestRegistration[] = [];
  const invalid: Array<{ data: GuestRegistration; errors: string[] }> = [];

  registrations.forEach((registration) => {
    const errors: string[] = [];

    if (!registration.email || !isValidEmail(registration.email)) {
      errors.push("Invalid or missing email address");
    }

    if (!registration.firstName || registration.firstName.trim().length < 2) {
      errors.push("Invalid or missing first name");
    }

    if (!registration.lastName || registration.lastName.trim().length < 2) {
      errors.push("Invalid or missing last name");
    }

    if (registration.experience && isNaN(Number(registration.experience))) {
      errors.push("Experience must be a number");
    }

    if (errors.length > 0) {
      invalid.push({ data: registration, errors });
    } else {
      valid.push(registration);
    }
  });

  return { valid, invalid };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Convert registration data to CSV format
 */
export function exportToCSV(registrations: GuestRegistration[]): string {
  if (registrations.length === 0) return "";

  const headers = [
    "ID",
    "Timestamp",
    "Email",
    "First Name",
    "Last Name",
    "Country",
    "City",
    "Profession",
    "Company",
    "Experience",
    "Interests",
    "Source",
    "Status",
  ];

  const rows = registrations.map((reg) => [
    reg.id,
    reg.timestamp,
    reg.email,
    reg.firstName,
    reg.lastName,
    reg.country,
    reg.city,
    reg.profession,
    reg.company,
    reg.experience,
    reg.interests,
    reg.source,
    reg.status,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  return csvContent;
}

/**
 * Get summary statistics from registration data
 */
export function getDataSummary(registrations: GuestRegistration[]) {
  const total = registrations.length;
  const confirmed = registrations.filter(
    (r) => r.status === "confirmed"
  ).length;
  const pending = registrations.filter((r) => r.status === "pending").length;
  const cancelled = registrations.filter(
    (r) => r.status === "cancelled"
  ).length;

  const countries = new Set(registrations.map((r) => r.country)).size;
  const cities = new Set(registrations.map((r) => `${r.city}, ${r.country}`))
    .size;

  const sources = registrations.reduce((acc, reg) => {
    acc[reg.source] = (acc[reg.source] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  return {
    total,
    confirmed,
    pending,
    cancelled,
    confirmationRate: total > 0 ? (confirmed / total) * 100 : 0,
    countries,
    cities,
    topSources: Object.entries(sources)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([source, count]) => ({ source, count })),
    lastUpdated: new Date().toISOString(),
  };
}
