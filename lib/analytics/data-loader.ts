/**
 * Data loading utilities for guest registration data
 */

import fs from "fs";
import path from "path";
import type { GuestRegistration } from "./types";
import { parseGuestCSV } from "./csv-parser";

/**
 * Load guest data from Google Sheets or local file (dev only)
 */
export async function loadGuestData(): Promise<GuestRegistration[]> {
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
    const csvPath = path.join(process.cwd(), "data", "secure", "guest-list.csv");

    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, "utf8");
      const registrations = parseGuestCSV(csvContent);

      if (process.env.NODE_ENV === "development") {
        console.log(
          `📁 Loaded ${registrations.length} registrations from local file`
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
