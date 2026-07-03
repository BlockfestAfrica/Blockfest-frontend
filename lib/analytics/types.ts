/**
 * Type definitions for analytics and guest registration data
 */

/**
 * Represents a guest registration record from the CSV data
 */
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
  gender?: string;
  school?: string;
  role?: string;
  transportation?: string;
  dietary?: string;
  photoConsent?: string;
  emailConsent?: string;
  xFollow?: string;
  telegramJoin?: string;
}

/**
 * Dashboard statistics response structure
 */
export interface DashboardStats {
  totalGuests: number;
  confirmedGuests: number;
  pendingGuests: number;
  cancelledGuests: number;
  countriesRepresented: number;
  citiesRepresented: number;
  averageExperience: number;
  experienceBreakdown: ExperienceBreakdown[];
  topExperienceLevel: string;
  topInterests: InterestCount[];
  registrationTrend: RegistrationTrendItem[];
  locationBreakdown: LocationBreakdownItem[];
  trafficSources: TrafficSourceItem[];
  topCompanies: CompanyCount[];
  registrationTimePatterns: RegistrationTimePatterns;
  genderBreakdown: GenderBreakdownItem[];
  educationInsights: EducationInsights;
  approvalBreakdown: ApprovalBreakdown;
  analyticsBreakdown: AnalyticsBreakdown;
  transportationInsights: TransportationInsights;
  professionalRoles: ProfessionalRoleItem[];
  educationalInstitutions: EducationalInstitutionItem[];
  dietaryRequirements: DietaryRequirements;
  consentAnalytics: ConsentAnalytics;
  companyRoles: CompanyRolesResult;
  recentRegistrations: GuestRegistration[];
  lastUpdated: string;
}

export interface ExperienceBreakdown {
  level: string;
  count: number;
  percentage: number;
}

export interface InterestCount {
  interest: string;
  count: number;
}

export interface RegistrationTrendItem {
  date: string;
  count: number;
}

export interface LocationBreakdownItem {
  country: string;
  count: number;
  percentage: number;
}

export interface TrafficSourceItem {
  source: string;
  count: number;
  percentage: number;
}

export interface CompanyCount {
  company: string;
  count: number;
}

export interface RegistrationTimePatterns {
  peakHour: { hour: number; count: number } | null;
  byDay: { day: string; count: number }[];
  byHour: { hour: number; count: number }[];
}

export interface GenderBreakdownItem {
  gender: string;
  count: number;
  percentage: number;
}

export interface EducationInsights {
  studentCount: number;
  professionalCount: number;
  studentPercentage: number;
  professionalPercentage: number;
  topSchools: { school: string; count: number }[];
}

export interface ApprovalBreakdown {
  approvedDevelopers: number;
  pendingDevelopers: number;
  declinedDevelopers: number;
  totalDevelopers: number;
  developerApprovalRate: number;
  approvedCreators: number;
  pendingCreators: number;
  declinedCreators: number;
  totalCreators: number;
  creatorApprovalRate: number;
  approvedFounders: number;
  pendingFounders: number;
  declinedFounders: number;
  totalFounders: number;
  founderApprovalRate: number;
  approvedStudents: number;
  pendingStudents: number;
  declinedStudents: number;
  totalStudents: number;
  studentApprovalRate: number;
  overallApprovalRate: number;
}

export interface AnalyticsBreakdown {
  completeApplications: number;
  partialApplications: number;
  completionRate: number;
  sourceQuality: SourceQualityItem[];
  africanCountries: number;
  topAfricanCities: { city: string; country: string; count: number }[];
  diversityScore: number;
  experienceDistribution: ExperienceDistributionItem;
  pendingApplications: number;
  conversionRate: number;
  uniqueCompanies: number;
  referralRate: number;
  topCompanyTypes: { type: string; count: number; percentage: number }[];
}

export interface SourceQualityItem {
  source: string;
  applications: number;
  approvalRate: number;
  qualityScore: number;
}

export interface ExperienceDistributionItem {
  newcomer: { count: number; percentage: number; approvalRate: number };
  intermediate: { count: number; percentage: number; approvalRate: number };
  advanced: { count: number; percentage: number; approvalRate: number };
  web2Transitioning: { count: number; percentage: number; approvalRate: number };
}

export interface TransportationInsights {
  totalTransportationRequests: number;
  transportationPercentage: number;
  topLocations: TransportationLocationItem[];
  transportationBreakdown: TransportationZoneItem[];
}

export interface TransportationLocationItem {
  location: string;
  count: number;
  percentage: number;
}

export interface TransportationZoneItem {
  zone: string;
  count: number;
  percentage: number;
}

export interface ProfessionalRoleItem {
  role: string;
  count: number;
  percentage: number;
}

export interface EducationalInstitutionItem {
  institution: string;
  count: number;
  percentage: number;
}

export interface DietaryRequirements {
  totalResponses: number;
  hasRestrictions: number;
  noRestrictions: number;
  restrictions: { type: string; count: number; percentage: number }[];
  commonRestrictions: string[];
}

export interface ConsentAnalytics {
  totalResponses: number;
  photoConsent: { yes: number; no: number; percentage: number };
  emailConsent: { yes: number; no: number; percentage: number };
  socialEngagement: {
    xFollowed: number;
    telegramJoined: number;
    xPercentage: number;
    telegramPercentage: number;
  };
  complianceScore: number;
}

export interface CompanyRolesResult {
  roles: { role: string; count: number; percentage: number }[];
  categories: {
    leadership: { count: number; percentage: number };
    technical: { count: number; percentage: number };
    business: { count: number; percentage: number };
  };
  totalValidRoles: number;
  totalResponses: number;
}

/**
 * CSV column indices mapping
 */
export interface CSVColumnIndices {
  id: number;
  name: number;
  firstName: number;
  lastName: number;
  email: number;
  phone: number;
  timestamp: number;
  approvalStatus: number;
  checkedIn: number;
  ticketType: number;
  gender: number;
  experience: number;
  profession: number;
  company: number;
  role: number;
  school: number;
  location: number;
  transportation: number;
  dietary: number;
  source: number;
  photoConsent: number;
  emailConsent: number;
  xFollow: number;
  telegramJoin: number;
}
