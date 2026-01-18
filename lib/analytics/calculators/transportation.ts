/**
 * Transportation analytics calculator
 */

import type { GuestRegistration, TransportationInsights } from "../types";
import {
  normalizeTransportLocation,
  classifyTransportZone,
} from "../../normalizers/location";

/** K-anonymity threshold to reduce PII risk */
const MIN_K = 3;

/**
 * Calculate transportation insights
 * Privacy-first approach: normalizes locations and applies k-anonymity
 */
export function calculateTransportationInsights(
  registrations: GuestRegistration[]
): TransportationInsights {
  const transportationRequests = registrations.filter(
    (r) => r.transportation && r.transportation.trim() !== ""
  );
  const totalTransportationRequests = transportationRequests.length;
  const transportationPercentage =
    registrations.length > 0
      ? (totalTransportationRequests / registrations.length) * 100
      : 0;

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

  // Apply k-anonymity: only show locations with sufficient count
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

  return {
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
}
