"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { StatsGrid } from "./stats-grid";
import { RegistrationChart } from "./registration-chart";
import { LocationBreakdown } from "./location-breakdown";
import { RegistrationStatus } from "./registration-status";
import { RecentActivity } from "./recent-activity";
import { TrafficSources } from "./traffic-sources";
import { TopCompanies } from "./top-companies";
import { TimeAnalysis } from "./time-analysis";
import { GenderBreakdown } from "./gender-breakdown";
import { EducationInsights } from "./education-insights";
import { ApprovalInsights } from "./approval-insights";
import { AnalyticsInsights } from "./analytics-insights";
import { TransportationInsights } from "./transportation-insights";
import { ProfessionalRoles } from "./professional-roles";
import { EducationalInstitutions } from "./educational-institutions";
import { DietaryRequirements } from "./dietary-requirements";
import { ConsentAnalytics } from "./consent-analytics";
import type { TransportationData } from "./transportation-insights";

const defaultTransportation: TransportationData = {
  totalTransportationRequests: 0,
  transportationPercentage: 0,
  topLocations: [],
  transportationBreakdown: [],
};

export interface GuestData {
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
  interests: string[];
  source: string;
  status: "confirmed" | "pending" | "cancelled";
}

export interface DashboardStats {
  totalGuests: number;
  confirmedGuests: number;
  pendingGuests: number;
  cancelledGuests: number;
  countriesRepresented: number;
  citiesRepresented: number;
  averageExperience: number;
  experienceBreakdown: Array<{
    level: string;
    count: number;
    percentage: number;
  }>;
  topExperienceLevel: string;
  topInterests: Array<{ interest: string; count: number }>;
  registrationTrend: Array<{ date: string; count: number }>;
  locationBreakdown: Array<{
    country: string;
    count: number;
    percentage: number;
  }>;
  trafficSources: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  topCompanies: Array<{
    company: string;
    count: number;
  }>;
  registrationTimePatterns: {
    peakHour: { hour: number; count: number } | null;
    byDay: Array<{ day: string; count: number }>;
    byHour: Array<{ hour: number; count: number }>;
  };
  genderBreakdown: Array<{
    gender: string;
    count: number;
    percentage: number;
  }>;
  educationInsights: {
    studentCount: number;
    professionalCount: number;
    studentPercentage: number;
    professionalPercentage: number;
    topSchools: Array<{ school: string; count: number }>;
  };
  approvalBreakdown: {
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
  };
  analyticsBreakdown: {
    // Source Quality
    sourceQuality: Array<{
      source: string;
      applications: number;
      approvalRate: number;
      qualityScore: number;
    }>;

    // Geographic Insights
    africanCountries: number;
    topAfricanCities: Array<{
      city: string;
      country: string;
      count: number;
    }>;
    diversityScore: number;

    // Experience Distribution
    experienceDistribution: {
      newcomer: { count: number; percentage: number; approvalRate: number };
      intermediate: { count: number; percentage: number; approvalRate: number };
      advanced: { count: number; percentage: number; approvalRate: number };
      web2Transitioning: {
        count: number;
        percentage: number;
        approvalRate: number;
      };
    };

    // Pipeline Health
    pendingApplications: number;
    conversionRate: number;

    // Community Value
    uniqueCompanies: number;
    referralRate: number;
    topCompanyTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
  };
  transportationInsights: TransportationData;
  professionalRoles: Array<{
    role: string;
    count: number;
    percentage: number;
  }>;
  educationalInstitutions: Array<{
    institution: string;
    count: number;
    percentage: number;
  }>;
  dietaryRequirements: {
    totalResponses: number;
    hasRestrictions: number;
    noRestrictions: number;
    restrictions: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    commonRestrictions: string[];
  };
  consentAnalytics: {
    totalResponses: number;
    photoConsent: {
      yes: number;
      no: number;
      percentage: number;
    };
    emailConsent: {
      yes: number;
      no: number;
      percentage: number;
    };
    socialEngagement: {
      xFollowed: number;
      telegramJoined: number;
      xPercentage: number;
      telegramPercentage: number;
    };
    complianceScore: number;
  };
  recentRegistrations: GuestData[];
  lastUpdated: string;
}

// API functions
async function fetchDashboardStats(
  signal?: AbortSignal
): Promise<DashboardStats> {
  try {
    // Replace with actual API endpoint
    const response = await fetch("/api/insights/dashboard", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch dashboard data: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
}

// Helper functions for consistent date formatting (prevents hydration mismatches)
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";

    // Use consistent format: Sep 8, 2025, 11:38 AM
    return date.toLocaleString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Invalid date";
  }
}

function formatTime(date: Date): string {
  try {
    if (isNaN(date.getTime())) return "Invalid time";

    // Use consistent format: 11:38 AM
    return date.toLocaleTimeString("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Invalid time";
  }
}

export const InsightsDashboard = memo(function InsightsDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
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
    registrationTimePatterns: {
      peakHour: null,
      byDay: [],
      byHour: [],
    },
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
    transportationInsights: defaultTransportation,
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
      photoConsent: {
        yes: 0,
        no: 0,
        percentage: 0,
      },
      emailConsent: {
        yes: 0,
        no: 0,
        percentage: 0,
      },
      socialEngagement: {
        xFollowed: 0,
        telegramJoined: 0,
        xPercentage: 0,
        telegramPercentage: 0,
      },
      complianceScore: 0,
    },
    recentRegistrations: [],
    lastUpdated: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Data fetching function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const data = await fetchDashboardStats(controller.signal);
      // Safe deep merge to prevent runtime breaks when API omits nested keys
      setStats((prev) => ({
        ...prev,
        ...data,
        approvalBreakdown: {
          ...prev.approvalBreakdown,
          ...(data.approvalBreakdown ?? {}),
        },
        analyticsBreakdown: {
          ...prev.analyticsBreakdown,
          ...(data.analyticsBreakdown ?? {}),
          experienceDistribution: {
            ...prev.analyticsBreakdown.experienceDistribution,
            ...(data.analyticsBreakdown?.experienceDistribution ?? {}),
            // Deep merge individual experience levels to prevent missing nested properties
            newcomer: {
              ...prev.analyticsBreakdown.experienceDistribution.newcomer,
              ...(data.analyticsBreakdown?.experienceDistribution?.newcomer ??
                {}),
            },
            intermediate: {
              ...prev.analyticsBreakdown.experienceDistribution.intermediate,
              ...(data.analyticsBreakdown?.experienceDistribution
                ?.intermediate ?? {}),
            },
            advanced: {
              ...prev.analyticsBreakdown.experienceDistribution.advanced,
              ...(data.analyticsBreakdown?.experienceDistribution?.advanced ??
                {}),
            },
            web2Transitioning: {
              ...prev.analyticsBreakdown.experienceDistribution
                .web2Transitioning,
              ...(data.analyticsBreakdown?.experienceDistribution
                ?.web2Transitioning ?? {}),
            },
          },
        },
        registrationTimePatterns: {
          ...prev.registrationTimePatterns,
          ...(data.registrationTimePatterns ?? {}),
        },
        educationInsights: {
          ...prev.educationInsights,
          ...(data.educationInsights ?? {}),
        },
        transportationInsights: {
          ...prev.transportationInsights,
          ...(data.transportationInsights ?? {}),
        },
        consentAnalytics: {
          ...prev.consentAnalytics,
          ...(data.consentAnalytics ?? {}),
          photoConsent: {
            ...prev.consentAnalytics.photoConsent,
            ...(data.consentAnalytics?.photoConsent ?? {}),
          },
          emailConsent: {
            ...prev.consentAnalytics.emailConsent,
            ...(data.consentAnalytics?.emailConsent ?? {}),
          },
          socialEngagement: {
            ...prev.consentAnalytics.socialEngagement,
            ...(data.consentAnalytics?.socialEngagement ?? {}),
          },
        },
        dietaryRequirements: {
          ...prev.dietaryRequirements,
          ...(data.dietaryRequirements ?? {}),
          restrictions:
            data.dietaryRequirements?.restrictions ??
            prev.dietaryRequirements.restrictions,
          commonRestrictions:
            data.dietaryRequirements?.commonRestrictions ??
            prev.dietaryRequirements.commonRestrictions,
        },
      }));
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh data every 6 hours
  useEffect(() => {
    const interval = setInterval(fetchData, 6 * 60 * 60 * 1000); // 6 hours
    return () => clearInterval(interval);
  }, [fetchData]);

  // Memoize expensive calculations
  const memoizedStats = useMemo(
    () => ({
      registrationStatusData: {
        confirmed: stats.confirmedGuests,
        pending: stats.pendingGuests,
        cancelled: stats.cancelledGuests,
        total: stats.totalGuests,
      },
      timeAnalysisData: stats.registrationTimePatterns,
      chartData: stats.registrationTrend,
      locationData: stats.locationBreakdown,
      trafficData: stats.trafficSources,
      companyData: stats.topCompanies,
      genderData: stats.genderBreakdown,
      educationData: stats.educationInsights,
      transportationData: stats.transportationInsights,
      topInterests: stats.topInterests,
    }),
    [stats]
  );

  const hasTransportationData = useMemo(() => {
    const t = stats.transportationInsights;
    return (
      t.totalTransportationRequests > 0 ||
      t.topLocations.length > 0 ||
      t.transportationBreakdown.length > 0
    );
  }, [stats.transportationInsights]);

  const formattedDates = useMemo(() => {
    const nextRefresh = new Date(lastRefresh.getTime() + 6 * 60 * 60 * 1000);
    return {
      lastUpdated: formatDate(stats.lastUpdated),
      nextRefresh: formatTime(nextRefresh),
    };
  }, [stats.lastUpdated, lastRefresh]);

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <div className="text-red-400 text-lg font-semibold mb-2">
            Failed to Load Dashboard Data
          </div>
          <div className="text-red-300 text-sm mb-4">{error}</div>
          <button
            onClick={fetchData}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10 p-6 sm:p-8 lg:p-12 max-w-7xl mx-auto">
      {/* Header with refresh info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-3 tracking-tight leading-tight">
            Dashboard Overview
          </h2>
          <p className="text-slate-400 text-sm sm:text-base font-medium leading-relaxed">
            Last updated: {formattedDates.lastUpdated} • Next refresh:{" "}
            {formattedDates.nextRefresh}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-3 bg-gradient-to-r from-slate-700/60 to-slate-800/60 hover:from-slate-600/70 hover:to-slate-700/70 backdrop-blur-xl text-slate-100 px-4 sm:px-6 py-3 rounded-xl border border-slate-600/40 hover:border-slate-500/50 transition-all duration-300 disabled:opacity-50 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      {/* Stats Grid */}
      <StatsGrid stats={stats} loading={loading} />

      {/* Approval Insights */}
      <ApprovalInsights stats={stats} loading={loading} />

      {/* Advanced Analytics */}
      <AnalyticsInsights stats={stats} loading={loading} />

      {/* Charts and Breakdown - Enhanced Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <div className="min-h-[400px]">
          <RegistrationChart data={memoizedStats.chartData} loading={loading} />
        </div>
        <div className="min-h-[400px]">
          <LocationBreakdown
            data={memoizedStats.locationData}
            loading={loading}
          />
        </div>
      </div>

      {/* Registration Status & Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2">
          <RegistrationStatus
            confirmed={memoizedStats.registrationStatusData.confirmed}
            pending={memoizedStats.registrationStatusData.pending}
            cancelled={memoizedStats.registrationStatusData.cancelled}
            total={memoizedStats.registrationStatusData.total}
            loading={loading}
          />
        </div>
        <div>
          <RecentActivity
            interests={memoizedStats.topInterests}
            loading={loading}
          />
        </div>
      </div>

      {/* Marketing & Engagement Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="md:col-span-1 min-h-[400px]">
          <TrafficSources data={memoizedStats.trafficData} loading={loading} />
        </div>
        <div className="md:col-span-1 min-h-[400px]">
          <TopCompanies data={memoizedStats.companyData} loading={loading} />
        </div>
        <div className="md:col-span-2 xl:col-span-1 min-h-[400px]">
          <TimeAnalysis
            data={memoizedStats.timeAnalysisData}
            loading={loading}
          />
        </div>
      </div>

      {/* Transportation Analytics */}
      {(loading || hasTransportationData) && (
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <div className="min-h-[400px]">
            <TransportationInsights
              data={memoizedStats.transportationData}
              loading={loading}
            />
          </div>
        </div>
      )}

      {/* Demographics & Education Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <div className="min-h-[500px]">
          <GenderBreakdown data={memoizedStats.genderData} loading={loading} />
        </div>
        <div className="min-h-[500px]">
          <EducationInsights
            data={memoizedStats.educationData}
            loading={loading}
          />
        </div>
      </div>

      {/* Professional & Educational Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
        <div className="min-h-[500px] insight-card">
          <ProfessionalRoles data={stats.professionalRoles} loading={loading} />
        </div>
        <div className="min-h-[500px] insight-card">
          <EducationalInstitutions
            data={stats.educationalInstitutions}
            loading={loading}
          />
        </div>
      </div>

      {/* Event Planning Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
        <div className="min-h-[400px] insight-card">
          <DietaryRequirements
            data={stats.dietaryRequirements}
            loading={loading}
          />
        </div>
        <div className="min-h-[400px] insight-card">
          <ConsentAnalytics data={stats.consentAnalytics} loading={loading} />
        </div>
      </div>
    </div>
  );
});
