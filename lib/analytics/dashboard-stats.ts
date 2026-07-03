/**
 * Dashboard statistics calculator
 * Processes guest registration data into comprehensive analytics
 */

import type { GuestRegistration, DashboardStats } from "./types";
import { normalizeSchoolName } from "../normalizers/school";
import {
  calculateProfessionalRoles,
  calculateCompanyRoles,
  calculateEducationalInstitutions,
  calculateDietaryRequirements,
  calculateConsentAnalytics,
  calculateTransportationInsights,
} from "./calculators";

/**
 * Calculate comprehensive dashboard statistics from registration data
 */
export function calculateDashboardStats(
  registrations: GuestRegistration[]
): DashboardStats {
  const now = new Date().toISOString();

  // Ensure we have valid data
  if (!registrations || registrations.length === 0) {
    return getEmptyStats(now);
  }

  const totalGuests = registrations.length;

  // Basic counts
  const confirmedGuests = registrations.filter((r) => r.status === "confirmed").length;
  const pendingGuests = registrations.filter((r) => r.status === "pending").length;
  const cancelledGuests = registrations.filter((r) => r.status === "cancelled").length;

  // Geographic analysis
  const { countryCount, cityCount, locationBreakdown } =
    calculateGeographicStats(registrations);

  // Experience analysis
  const { experienceBreakdown, topExperienceLevel, averageExperience } =
    calculateExperienceStats(registrations);

  // Interest/Profession analysis
  const topInterests = calculateTopInterests(registrations);

  // Registration trends
  const registrationTrend = calculateRegistrationTrend(registrations);

  // Traffic sources
  const trafficSources = calculateTrafficSources(registrations);

  // Top companies
  const topCompanies = calculateTopCompanies(registrations);

  // Time patterns
  const registrationTimePatterns = calculateTimePatterns(registrations);

  // Gender breakdown
  const genderBreakdown = calculateGenderBreakdown(registrations);

  // Education insights
  const educationInsights = calculateEducationInsights(registrations);

  // Approval breakdown
  const approvalBreakdown = calculateApprovalBreakdown(registrations);

  // Advanced analytics
  const analyticsBreakdown = calculateAdvancedAnalytics(registrations);

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
    transportationInsights: calculateTransportationInsights(registrations),
    professionalRoles: calculateProfessionalRoles(registrations),
    educationalInstitutions: calculateEducationalInstitutions(registrations),
    dietaryRequirements: calculateDietaryRequirements(registrations),
    consentAnalytics: calculateConsentAnalytics(registrations),
    companyRoles: calculateCompanyRoles(registrations),
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

/**
 * Return empty stats structure
 */
function getEmptyStats(timestamp: string): DashboardStats {
  return {
    totalGuests: 0,
    confirmedGuests: 0,
    pendingGuests: 0,
    cancelledGuests: 0,
    countriesRepresented: 0,
    citiesRepresented: 0,
    averageExperience: 0,
    experienceBreakdown: [],
    topExperienceLevel: "Unknown",
    topInterests: [],
    registrationTrend: [],
    locationBreakdown: [],
    trafficSources: [],
    topCompanies: [],
    registrationTimePatterns: { peakHour: null, byDay: [], byHour: [] },
    genderBreakdown: [],
    educationInsights: {
      studentCount: 0,
      professionalCount: 0,
      studentPercentage: 0,
      professionalPercentage: 0,
      topSchools: [],
    },
    approvalBreakdown: {
      approvedDevelopers: 0,
      pendingDevelopers: 0,
      declinedDevelopers: 0,
      totalDevelopers: 0,
      developerApprovalRate: 0,
      approvedCreators: 0,
      pendingCreators: 0,
      declinedCreators: 0,
      totalCreators: 0,
      creatorApprovalRate: 0,
      approvedFounders: 0,
      pendingFounders: 0,
      declinedFounders: 0,
      totalFounders: 0,
      founderApprovalRate: 0,
      approvedStudents: 0,
      pendingStudents: 0,
      declinedStudents: 0,
      totalStudents: 0,
      studentApprovalRate: 0,
      overallApprovalRate: 0,
    },
    analyticsBreakdown: {
      completeApplications: 0,
      partialApplications: 0,
      completionRate: 0,
      sourceQuality: [],
      africanCountries: 0,
      topAfricanCities: [],
      diversityScore: 0,
      experienceDistribution: {
        newcomer: { count: 0, percentage: 0, approvalRate: 0 },
        intermediate: { count: 0, percentage: 0, approvalRate: 0 },
        advanced: { count: 0, percentage: 0, approvalRate: 0 },
        web2Transitioning: { count: 0, percentage: 0, approvalRate: 0 },
      },
      pendingApplications: 0,
      conversionRate: 0,
      uniqueCompanies: 0,
      referralRate: 0,
      topCompanyTypes: [],
    },
    transportationInsights: {
      totalTransportationRequests: 0,
      transportationPercentage: 0,
      topLocations: [],
      transportationBreakdown: [],
    },
    professionalRoles: [],
    educationalInstitutions: [],
    dietaryRequirements: {
      totalResponses: 0,
      hasRestrictions: 0,
      noRestrictions: 0,
      restrictions: [],
      commonRestrictions: [],
    },
    consentAnalytics: {
      totalResponses: 0,
      photoConsent: { yes: 0, no: 0, percentage: 0 },
      emailConsent: { yes: 0, no: 0, percentage: 0 },
      socialEngagement: {
        xFollowed: 0,
        telegramJoined: 0,
        xPercentage: 0,
        telegramPercentage: 0,
      },
      complianceScore: 0,
    },
    companyRoles: {
      roles: [],
      categories: {
        leadership: { count: 0, percentage: 0 },
        technical: { count: 0, percentage: 0 },
        business: { count: 0, percentage: 0 },
      },
      totalValidRoles: 0,
      totalResponses: 0,
    },
    recentRegistrations: [],
    lastUpdated: timestamp,
  };
}

/**
 * Calculate geographic statistics
 */
function calculateGeographicStats(registrations: GuestRegistration[]) {
  const validCountries = registrations
    .map((r) => r.country)
    .filter((country) => country && country.trim() !== "" && country !== "Unknown");
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

  // Location breakdown
  const locationCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    let location = "Unknown";
    if (reg.city && reg.country) {
      location = `${reg.city}, ${reg.country}`;
    } else if (reg.country) {
      location = reg.country;
    }

    if (location !== "Unknown") {
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    } else {
      locationCounts["Unknown"] = (locationCounts["Unknown"] || 0) + 1;
    }
  });

  const locationBreakdown = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([location, count]) => ({
      country: location,
      count,
      percentage: registrations.length > 0 ? (count / registrations.length) * 100 : 0,
    }));

  return { countryCount, cityCount, locationBreakdown };
}

/**
 * Calculate experience statistics
 */
function calculateExperienceStats(registrations: GuestRegistration[]) {
  const experienceCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    if (reg.experience && reg.experience !== "Unknown") {
      experienceCounts[reg.experience] = (experienceCounts[reg.experience] || 0) + 1;
    }
  });

  const experienceBreakdown = Object.entries(experienceCounts)
    .map(([level, count]) => ({
      level,
      count,
      percentage: registrations.length > 0 ? (count / registrations.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topExperienceLevel =
    experienceBreakdown.length > 0 ? experienceBreakdown[0].level : "Unknown";

  // Calculate numeric score
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
      ? experienceScores.reduce((sum, score) => sum + score, 0) / experienceScores.length
      : 0;

  return { experienceBreakdown, topExperienceLevel, averageExperience };
}

/**
 * Calculate top interests/professions
 */
function calculateTopInterests(registrations: GuestRegistration[]) {
  const professionCounts: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    if (reg.profession && reg.profession !== "Other" && reg.profession !== "Unknown") {
      const individualProfessions = reg.profession.split(", ").map((p) => p.trim());

      individualProfessions.forEach((profession) => {
        if (profession && profession !== "Other" && profession !== "Unknown") {
          professionCounts[profession] = (professionCounts[profession] || 0) + 1;
        }
      });
    }
  });

  return Object.entries(professionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([interest, count]) => ({ interest, count }));
}

/**
 * Calculate registration trend (weekly)
 */
function calculateRegistrationTrend(registrations: GuestRegistration[]) {
  const registrationsByWeek: { [key: string]: number } = {};

  registrations.forEach((reg) => {
    try {
      const date = new Date(reg.timestamp);
      if (isNaN(date.getTime())) {
        const fallbackDate = new Date();
        const weekStart = new Date(fallbackDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekKey = weekStart.toISOString().split("T")[0];
        registrationsByWeek[weekKey] = (registrationsByWeek[weekKey] || 0) + 1;
      } else {
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekKey = weekStart.toISOString().split("T")[0];
        registrationsByWeek[weekKey] = (registrationsByWeek[weekKey] || 0) + 1;
      }
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("Invalid timestamp for registration:", reg.id, reg.timestamp);
      }
    }
  });

  return Object.entries(registrationsByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([date, count]) => ({
      date,
      count: count > registrations.length ? registrations.length : count,
    }));
}

/**
 * Calculate traffic sources
 */
function calculateTrafficSources(registrations: GuestRegistration[]) {
  const sourceCounts: { [key: string]: number } = {};

  registrations.forEach((reg) => {
    const source = reg.source || "Unknown";
    let normalizedSource = source;
    const sourceLower = source.toLowerCase();

    if (
      sourceLower.includes("x (formerly twitter)") ||
      sourceLower.includes("x (twitter)") ||
      sourceLower.includes("twitter") ||
      sourceLower === "x"
    ) {
      normalizedSource = "X (Twitter)";
    } else if (sourceLower.includes("instagram")) {
      normalizedSource = "Instagram";
    } else if (sourceLower.includes("linkedin")) {
      normalizedSource = "LinkedIn";
    } else if (
      sourceLower.includes("friend") ||
      sourceLower.includes("referral") ||
      sourceLower.includes("a friend")
    ) {
      normalizedSource = "Friend/Referral";
    } else if (sourceLower.includes("telegram")) {
      normalizedSource = "Telegram";
    } else if (sourceLower.includes("billboard")) {
      normalizedSource = "Billboard";
    } else if (sourceLower.includes("other") || sourceLower.includes("unknown")) {
      normalizedSource = source === "Unknown" ? "Unknown" : "Other";
    }

    sourceCounts[normalizedSource] = (sourceCounts[normalizedSource] || 0) + 1;
  });

  return Object.entries(sourceCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([source, count]) => ({
      source,
      count,
      percentage: registrations.length > 0 ? (count / registrations.length) * 100 : 0,
    }));
}

/**
 * Calculate top companies
 */
function calculateTopCompanies(registrations: GuestRegistration[]) {
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

  return Object.entries(companyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([company, count]) => ({ company, count }));
}

/**
 * Calculate registration time patterns
 */
function calculateTimePatterns(registrations: GuestRegistration[]) {
  const registrationsByHour: { [key: number]: number } = {};
  const registrationsByDay: { [key: string]: number } = {};
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  registrations.forEach((reg) => {
    try {
      const date = new Date(reg.timestamp);
      if (!isNaN(date.getTime())) {
        const hour = date.getHours();
        registrationsByHour[hour] = (registrationsByHour[hour] || 0) + 1;

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

  return {
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
}

/**
 * Calculate gender breakdown
 */
function calculateGenderBreakdown(registrations: GuestRegistration[]) {
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

  return Object.entries(genderCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([gender, count]) => ({
      gender,
      count,
      percentage: registrations.length > 0 ? (count / registrations.length) * 100 : 0,
    }));
}

/**
 * Calculate education insights
 */
function calculateEducationInsights(registrations: GuestRegistration[]) {
  const totalGuests = registrations.length;

  const studentCount = registrations.filter(
    (reg) =>
      (reg.profession && reg.profession.includes("Student")) ||
      (reg.school && reg.school.length > 2 && reg.school.toLowerCase() !== "n/a")
  ).length;

  const professionalCount = registrations.filter((reg) => {
    if (!reg.profession) return false;
    const professions = reg.profession.split(", ");
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
      reg.school.toLowerCase() !== "n/a" &&
      reg.school.toLowerCase() !== "none" &&
      reg.school.toLowerCase() !== "nil" &&
      reg.school.toLowerCase() !== "not a student" &&
      reg.school.toLowerCase() !== "graduate"
    ) {
      const normalizedSchool = normalizeSchoolName(reg.school);
      if (normalizedSchool && normalizedSchool.trim() !== "") {
        topSchools[normalizedSchool] = (topSchools[normalizedSchool] || 0) + 1;
      }
    }
  });

  return {
    studentCount,
    professionalCount,
    studentPercentage: totalGuests > 0 ? (studentCount / totalGuests) * 100 : 0,
    professionalPercentage: totalGuests > 0 ? (professionalCount / totalGuests) * 100 : 0,
    topSchools: Object.entries(topSchools)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([school, count]) => ({ school, count })),
  };
}

/**
 * Calculate approval breakdown by profession
 */
function calculateApprovalBreakdown(registrations: GuestRegistration[]) {
  const totalGuests = registrations.length;
  const confirmedGuests = registrations.filter((r) => r.status === "confirmed").length;

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
    total: registrations.filter((r) => r.profession?.includes("Developer")).length,
  };

  const designerStats = {
    approved: registrations.filter(
      (r) =>
        (r.profession?.includes("Creator") || r.profession?.includes("Designer")) &&
        r.status === "confirmed"
    ).length,
    pending: registrations.filter(
      (r) =>
        (r.profession?.includes("Creator") || r.profession?.includes("Designer")) &&
        r.status === "pending"
    ).length,
    declined: registrations.filter(
      (r) =>
        (r.profession?.includes("Creator") || r.profession?.includes("Designer")) &&
        r.status === "cancelled"
    ).length,
    total: registrations.filter(
      (r) => r.profession?.includes("Creator") || r.profession?.includes("Designer")
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
    total: registrations.filter((r) => r.profession?.includes("Founder")).length,
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
    total: registrations.filter((r) => r.profession?.includes("Student")).length,
  };

  return {
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
}

/**
 * Calculate advanced analytics breakdown
 */
function calculateAdvancedAnalytics(registrations: GuestRegistration[]) {
  const totalGuests = registrations.length;
  const confirmedGuests = registrations.filter((r) => r.status === "confirmed").length;
  const pendingGuests = registrations.filter((r) => r.status === "pending").length;

  // Application quality
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

  // Source quality
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
        stats.applications > 0 ? (stats.approved / stats.applications) * 100 : 0,
      qualityScore:
        stats.applications > 0 ? (stats.approved / stats.applications) * 100 : 0,
    }))
    .sort((a, b) => b.applications - a.applications)
    .slice(0, 5);

  // Geographic
  const africanCountriesSet = new Set<string>();
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
  const diversityScore = Math.min((africanCountries / 10) * 100, 100);

  // Experience distribution with approval rates
  const expStats = {
    newcomer: { total: 0, approved: 0 },
    intermediate: { total: 0, approved: 0 },
    advanced: { total: 0, approved: 0 },
    web2Transitioning: { total: 0, approved: 0 },
  };

  registrations.forEach((r) => {
    const exp = r.experience;
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
      percentage: totalGuests > 0 ? (expStats.advanced.total / totalGuests) * 100 : 0,
      approvalRate:
        expStats.advanced.total > 0
          ? (expStats.advanced.approved / expStats.advanced.total) * 100
          : 0,
    },
    web2Transitioning: {
      count: expStats.web2Transitioning.total,
      percentage:
        totalGuests > 0 ? (expStats.web2Transitioning.total / totalGuests) * 100 : 0,
      approvalRate:
        expStats.web2Transitioning.total > 0
          ? (expStats.web2Transitioning.approved / expStats.web2Transitioning.total) *
            100
          : 0,
    },
  };

  // Community analysis
  const uniqueCompanies = new Set(
    registrations.map((r) => r.company).filter((c) => c && c.trim() !== "")
  ).size;
  const referralCount = registrations.filter(
    (r) =>
      r.source?.toLowerCase().includes("referral") ||
      r.source?.toLowerCase().includes("friend")
  ).length;
  const referralRate = totalGuests > 0 ? (referralCount / totalGuests) * 100 : 0;

  // Company types
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
      } else if (company.includes("consulting") || company.includes("advisory")) {
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

  return {
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
}
