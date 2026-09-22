/**
 * CSV parsing utilities for guest registration data
 */

import type { GuestRegistration, CSVColumnIndices } from "./types";
import { normalizeLocation, normalizeCountry } from "../normalizers/location";
import { parseExperienceLevel, parseProfessions, parseSource } from "../normalizers/fields";

/**
 * Parse a CSV line with proper quoted field handling
 * Handles escaped quotes within quoted fields
 */
export function parseCSVLine(line: string): string[] {
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
 * Get column index from possible header names
 */
function getColumnIndex(headers: string[], possibleNames: string[]): number {
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
}

/**
 * Map CSV headers to column indices
 */
function mapColumnIndices(headers: string[]): CSVColumnIndices {
  return {
    id: getColumnIndex(headers, ["api_id"]),
    name: getColumnIndex(headers, ["name"]),
    firstName: getColumnIndex(headers, ["first_name"]),
    lastName: getColumnIndex(headers, ["last_name"]),
    email: getColumnIndex(headers, ["email"]),
    phone: getColumnIndex(headers, ["phone_number"]),
    timestamp: getColumnIndex(headers, ["created_at"]),
    approvalStatus: getColumnIndex(headers, ["approval_status"]),
    checkedIn: getColumnIndex(headers, ["checked_in_at"]),
    ticketType: getColumnIndex(headers, ["ticket_name"]),
    gender: getColumnIndex(headers, ["gender"]),
    experience: getColumnIndex(headers, [
      "what is your current experience level in web3?",
    ]),
    profession: getColumnIndex(headers, [
      "which of the following best describes you? select all that applies",
    ]),
    company: getColumnIndex(headers, [
      "which project or company are you representing? (if any)?",
    ]),
    role: getColumnIndex(headers, ["what is your role at the company?"]),
    school: getColumnIndex(headers, [
      "if you're a student, what's the name of your school?",
    ]),
    location: getColumnIndex(headers, [
      "city & country of residence (e.g abuja, nigeria)",
    ]),
    transportation: getColumnIndex(headers, [
      "transportation might be provided (within lagos). where will you be coming from that day?",
    ]),
    dietary: getColumnIndex(headers, [
      "we will be providing lunch. do you have any dietary restrictions or special needs we should be aware of?",
    ]),
    source: getColumnIndex(headers, ["how did you hear about this event?"]),
    photoConsent: getColumnIndex(headers, [
      "i consent to photos/videos being taken during the event for promotional use",
    ]),
    emailConsent: getColumnIndex(headers, [
      "do you consent to receive email updates and event information from blockfest africa?",
    ]),
    xFollow: getColumnIndex(headers, [
      "follow blockf3st africa on x: https://x.com/blockfestafrica",
    ]),
    telegramJoin: getColumnIndex(headers, [
      "join the blockfest africa telegram channel here: https://t.me/blockf3stafrica",
    ]),
  };
}

/**
 * Map approval status to internal status value
 */
function mapApprovalStatus(status: string): "confirmed" | "pending" | "cancelled" {
  switch (status.toLowerCase().trim()) {
    case "approved":
      return "confirmed";
    case "pending_approval":
      return "pending";
    case "declined":
      return "cancelled";
    default:
      return "pending";
  }
}

/**
 * Parse CSV content into guest registrations
 */
export function parseGuestCSV(csvContent: string): GuestRegistration[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]);
  const indices = mapColumnIndices(headers);
  const registrations: GuestRegistration[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    try {
      const fields = parseCSVLine(lines[i]);

      // Map approval status
      const approvalStatus = fields[indices.approvalStatus] || "";
      const status = mapApprovalStatus(approvalStatus);

      // Extract and normalize location
      const locationField = fields[indices.location] || "";
      const normalizedLocation = normalizeLocation(locationField);

      // Extract city and country from normalized location
      const locationParts = normalizedLocation.split(",").map((p) => p.trim());
      const city = locationParts.length > 0 ? locationParts[0] : "";
      const country = locationParts.length > 1 ? locationParts[1] : normalizeCountry(locationField);

      // Parse profession field
      const professionField = fields[indices.profession] || "";
      const profession = parseProfessions(professionField);

      // Parse experience level
      const experienceField = fields[indices.experience] || "";
      const experienceLevel = parseExperienceLevel(experienceField);

      // Parse source field
      const sourceField = fields[indices.source] || "";
      const source = parseSource(sourceField);

      // Extract optional fields
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
        country: country || "Nigeria",
        city: city || "",
        profession,
        company: fields[indices.company] || "",
        experience: experienceLevel,
        interests: professionField || "",
        source,
        status,
        gender: gender || undefined,
        school: school || undefined,
        role: fields[indices.role]?.trim() || undefined,
        transportation: transportation || undefined,
        dietary: dietary || undefined,
        photoConsent: photoConsent || undefined,
        emailConsent: emailConsent || undefined,
        xFollow: xFollow || undefined,
        telegramJoin: telegramJoin || undefined,
      };

      registrations.push(registration);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(`Error parsing line ${i}:`, error);
      }
      continue;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`Parsed ${registrations.length} registrations from CSV`);
  }

  return registrations;
}
