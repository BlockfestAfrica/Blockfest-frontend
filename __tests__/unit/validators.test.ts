/**
 * Tests for validation utilities
 */

import { describe, it, expect } from "vitest";
import {
  validateGuestRegistration,
  validateGuestRegistrations,
  validateDashboardRequest,
  validateAuthRequest,
} from "@/lib/validators";

describe("validateGuestRegistration", () => {
  it("validates a complete registration", () => {
    const data = {
      id: "guest-1",
      timestamp: "2025-01-01T00:00:00Z",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      country: "Nigeria",
      city: "Lagos",
      profession: "Developer",
      company: "TechCorp",
      experience: "Intermediate",
      interests: "Web3",
      source: "Twitter",
      status: "confirmed",
    };

    const result = validateGuestRegistration(data);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("guest-1");
    expect(result?.email).toBe("test@example.com");
  });

  it("validates registration with optional fields", () => {
    const data = {
      id: "guest-2",
      timestamp: "2025-01-01T00:00:00Z",
      email: "test@example.com",
      firstName: "Jane",
      lastName: "Doe",
      country: "Nigeria",
      city: "Abuja",
      profession: "Student",
      company: "",
      experience: "Newcomer",
      interests: "",
      source: "Friend",
      status: "pending",
      gender: "Female",
      school: "University of Lagos",
    };

    const result = validateGuestRegistration(data);
    expect(result).not.toBeNull();
    expect(result?.gender).toBe("Female");
    expect(result?.school).toBe("University of Lagos");
  });

  it("returns null for invalid data", () => {
    const data = {
      // Missing required id
      timestamp: "2025-01-01T00:00:00Z",
      email: "test@example.com",
    };

    const result = validateGuestRegistration(data);
    expect(result).toBeNull();
  });

  it("applies default values", () => {
    const data = {
      id: "guest-3",
      timestamp: "2025-01-01T00:00:00Z",
      email: "",
      firstName: "Test",
      lastName: "User",
      // Missing optional fields
    };

    const result = validateGuestRegistration(data);
    expect(result).not.toBeNull();
    expect(result?.country).toBe("Nigeria");
    expect(result?.status).toBe("pending");
    expect(result?.profession).toBe("Other");
  });
});

describe("validateGuestRegistrations", () => {
  it("filters out invalid registrations", () => {
    const data = [
      {
        id: "valid-1",
        timestamp: "2025-01-01T00:00:00Z",
        email: "valid@example.com",
        firstName: "Valid",
        lastName: "User",
      },
      {
        // Invalid - missing id
        timestamp: "2025-01-01T00:00:00Z",
        email: "invalid@example.com",
      },
      {
        id: "valid-2",
        timestamp: "2025-01-01T00:00:00Z",
        email: "valid2@example.com",
        firstName: "Another",
        lastName: "User",
      },
    ];

    const result = validateGuestRegistrations(data);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("valid-1");
    expect(result[1].id).toBe("valid-2");
  });

  it("returns empty array for all invalid data", () => {
    const data = [
      { invalid: "data" },
      { also: "invalid" },
    ];

    const result = validateGuestRegistrations(data);
    expect(result).toHaveLength(0);
  });
});

describe("validateDashboardRequest", () => {
  it("validates refresh action", () => {
    const result = validateDashboardRequest({ action: "refresh" });
    expect(result).not.toBeNull();
    expect(result?.action).toBe("refresh");
  });

  it("returns null for invalid action", () => {
    const result = validateDashboardRequest({ action: "invalid" });
    expect(result).toBeNull();
  });

  it("returns null for missing action", () => {
    const result = validateDashboardRequest({});
    expect(result).toBeNull();
  });
});

describe("validateAuthRequest", () => {
  it("validates valid password", () => {
    const result = validateAuthRequest({ password: "secret123" });
    expect(result).not.toBeNull();
    expect(result?.password).toBe("secret123");
  });

  it("returns null for empty password", () => {
    const result = validateAuthRequest({ password: "" });
    expect(result).toBeNull();
  });

  it("returns null for missing password", () => {
    const result = validateAuthRequest({});
    expect(result).toBeNull();
  });
});
