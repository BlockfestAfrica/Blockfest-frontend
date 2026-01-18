/**
 * Zod validation schemas for guest registration data
 */

import { z } from "zod";

/**
 * Schema for guest registration status
 */
export const GuestStatusSchema = z.enum(["confirmed", "pending", "cancelled"]);

/**
 * Schema for a single guest registration
 */
export const GuestRegistrationSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string(),
  email: z.string().email().or(z.string().length(0)),
  firstName: z.string(),
  lastName: z.string(),
  country: z.string().default("Nigeria"),
  city: z.string().default(""),
  profession: z.string().default("Other"),
  company: z.string().default(""),
  experience: z.string().default("Unknown"),
  interests: z.string().default(""),
  source: z.string().default("Unknown"),
  status: GuestStatusSchema.default("pending"),
  gender: z.string().optional(),
  school: z.string().optional(),
  role: z.string().optional(),
  transportation: z.string().optional(),
  dietary: z.string().optional(),
  photoConsent: z.string().optional(),
  emailConsent: z.string().optional(),
  xFollow: z.string().optional(),
  telegramJoin: z.string().optional(),
});

/**
 * Type inferred from schema
 */
export type ValidatedGuestRegistration = z.infer<typeof GuestRegistrationSchema>;

/**
 * Schema for dashboard API request body (POST)
 */
export const DashboardRequestSchema = z.object({
  action: z.enum(["refresh"]),
});

/**
 * Schema for auth request
 */
export const AuthRequestSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

/**
 * Validate a single guest registration
 */
export function validateGuestRegistration(data: unknown): ValidatedGuestRegistration | null {
  try {
    return GuestRegistrationSchema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Validate an array of guest registrations
 * Returns only valid registrations, filtering out invalid ones
 */
export function validateGuestRegistrations(
  data: unknown[]
): ValidatedGuestRegistration[] {
  return data
    .map((item) => {
      try {
        return GuestRegistrationSchema.parse(item);
      } catch {
        return null;
      }
    })
    .filter((item): item is ValidatedGuestRegistration => item !== null);
}

/**
 * Validate dashboard request body
 */
export function validateDashboardRequest(
  data: unknown
): z.infer<typeof DashboardRequestSchema> | null {
  try {
    return DashboardRequestSchema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Validate auth request body
 */
export function validateAuthRequest(
  data: unknown
): z.infer<typeof AuthRequestSchema> | null {
  try {
    return AuthRequestSchema.parse(data);
  } catch {
    return null;
  }
}
