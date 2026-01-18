/**
 * Analytics module - main entry point
 * Re-exports all analytics utilities
 */

// Types
export type {
  GuestRegistration,
  DashboardStats,
  CSVColumnIndices,
  ExperienceBreakdown,
  InterestCount,
  RegistrationTrendItem,
  LocationBreakdownItem,
  TrafficSourceItem,
  CompanyCount,
  RegistrationTimePatterns,
  GenderBreakdownItem,
  EducationInsights,
  ApprovalBreakdown,
  AnalyticsBreakdown,
  TransportationInsights,
  ProfessionalRoleItem,
  EducationalInstitutionItem,
  DietaryRequirements,
  ConsentAnalytics,
  CompanyRolesResult,
} from "./types";

// CSV Parser
export { parseCSVLine, parseGuestCSV } from "./csv-parser";

// Dashboard Stats
export { calculateDashboardStats } from "./dashboard-stats";

// Data Loader
export { loadGuestData } from "./data-loader";

// Individual Calculators
export {
  calculateProfessionalRoles,
  calculateCompanyRoles,
  calculateEducationalInstitutions,
  calculateDietaryRequirements,
  calculateConsentAnalytics,
  calculateTransportationInsights,
} from "./calculators";
