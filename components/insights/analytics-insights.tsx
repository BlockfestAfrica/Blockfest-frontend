"use client";

import { memo, useMemo } from "react";
import { DashboardStats } from "./dashboard";

interface AnalyticsInsightsProps {
  stats: DashboardStats & {
    analyticsBreakdown: {
      // Application Quality
      completeApplications: number;
      partialApplications: number;
      completionRate: number;

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
        intermediate: {
          count: number;
          percentage: number;
          approvalRate: number;
        };
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
  };
  loading?: boolean;
}

interface QualityScoreCardProps {
  title: string;
  score: number;
  description: string;
  icon: React.ReactNode;
  color: "green" | "yellow" | "blue" | "purple";
  loading?: boolean;
}

function QualityScoreCard({
  title,
  score,
  description,
  icon,
  color,
  loading,
}: QualityScoreCardProps) {
  const colorClasses = {
    green: "bg-green-500/20 border-green-500/30 text-green-200",
    yellow: "bg-yellow-500/20 border-yellow-500/30 text-yellow-200",
    blue: "bg-blue-500/20 border-blue-500/30 text-blue-200",
    purple: "bg-purple-500/20 border-purple-500/30 text-purple-200",
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-white/10 rounded w-3/4"></div>
          <div className="h-12 bg-white/10 rounded w-full"></div>
          <div className="h-3 bg-white/10 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${colorClasses[color]} backdrop-blur-sm border rounded-xl p-6 hover:bg-opacity-30 transition-all duration-200 group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-gray-300 text-sm font-medium mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {score.toFixed(1)}
            </span>
            <span className="text-sm text-gray-400">/ 100</span>
          </div>
        </div>
        <div className="text-white/70 group-hover:text-white/90 transition-colors duration-200">
          {icon}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              score >= 80
                ? "bg-green-400"
                : score >= 60
                ? "bg-yellow-400"
                : "bg-red-400"
            }`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">{description}</p>
    </div>
  );
}

interface InfoCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  items?: Array<{ label: string; value: string | number; percentage?: number }>;
  icon: React.ReactNode;
  loading?: boolean;
}

function InfoCard({
  title,
  value,
  subtitle,
  items,
  icon,
  loading,
}: InfoCardProps) {
  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-white/10 rounded w-3/4"></div>
          <div className="h-8 bg-white/10 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-3 bg-white/10 rounded w-full"></div>
            <div className="h-3 bg-white/10 rounded w-3/4"></div>
            <div className="h-3 bg-white/10 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-gray-300 text-sm font-medium mb-1">{title}</p>
          <p className="text-white text-2xl font-bold">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="text-gray-400 text-xs">{subtitle}</p>
        </div>
        <div className="text-white/60 group-hover:text-white/80 transition-colors duration-200">
          {icon}
        </div>
      </div>

      {items && items.length > 0 && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          {items.slice(0, 3).map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-300">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{item.value}</span>
                {item.percentage && (
                  <span className="text-gray-400 text-xs">
                    ({item.percentage.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const AnalyticsInsights = memo(function AnalyticsInsights({
  stats,
  loading,
}: AnalyticsInsightsProps) {
  const analytics = stats.analyticsBreakdown;

  // Memoize expensive calculations
  const qualityMetrics = useMemo(() => {
    if (!analytics) return null;

    return {
      totalApplications:
        (analytics.completeApplications || 0) +
        (analytics.partialApplications || 0),
      completionDescription: `${
        analytics.completeApplications || 0
      } complete out of ${
        (analytics.completeApplications || 0) +
        (analytics.partialApplications || 0)
      } total`,
      uniqueCompaniesCount: analytics.uniqueCompanies || 0,
      communityDescription: `${
        analytics.uniqueCompanies || 0
      } unique companies`,
    };
  }, [analytics]);

  const sourceQualityItems = useMemo(() => {
    return (
      analytics?.sourceQuality?.map((source) => ({
        label: source.source,
        value: source.applications,
        percentage: source.approvalRate,
      })) || []
    );
  }, [analytics]);

  const topAfricanCitiesItems = useMemo(() => {
    if (!analytics?.topAfricanCities) return [];

    // Calculate total count for percentage calculation
    const totalCityCount = analytics.topAfricanCities.reduce(
      (sum, city) => sum + city.count,
      0
    );

    return analytics.topAfricanCities.map((city) => ({
      label: `${city.city}, ${city.country}`,
      value: city.count,
      percentage:
        totalCityCount > 0
          ? Math.round((city.count / totalCityCount) * 100)
          : 0,
    }));
  }, [analytics]);

  const experienceDistributionItems = useMemo(() => {
    if (!analytics?.experienceDistribution) return [];

    return [
      {
        label: "Advanced",
        value: analytics.experienceDistribution.advanced.count,
        percentage: analytics.experienceDistribution.advanced.percentage,
      },
      {
        label: "Intermediate",
        value: analytics.experienceDistribution.intermediate.count,
        percentage: analytics.experienceDistribution.intermediate.percentage,
      },
      {
        label: "Newcomer",
        value: analytics.experienceDistribution.newcomer.count,
        percentage: analytics.experienceDistribution.newcomer.percentage,
      },
    ];
  }, [analytics]);

  const experienceLevelsCount = useMemo(() => {
    return analytics?.experienceDistribution
      ? Object.keys(analytics.experienceDistribution).length.toString()
      : "0";
  }, [analytics]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Advanced Analytics</h3>
        <div className="text-sm text-gray-300">
          Data-driven insights for better decision making
        </div>
      </div>

      {/* Quality Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <QualityScoreCard
          title="Application Quality"
          score={analytics?.completionRate || 0}
          description={
            qualityMetrics?.completionDescription || "No data available"
          }
          color="green"
          loading={loading}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />

        <QualityScoreCard
          title="Geographic Diversity"
          score={analytics?.diversityScore || 0}
          description={`${
            analytics?.africanCountries || 0
          } African countries represented`}
          color="blue"
          loading={loading}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />

        <QualityScoreCard
          title="Conversion Rate"
          score={analytics?.conversionRate || 0}
          description="Application to approval success rate"
          color="purple"
          loading={loading}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          }
        />

        <QualityScoreCard
          title="Community Strength"
          score={analytics?.referralRate || 0}
          description={
            qualityMetrics?.communityDescription || "No data available"
          }
          color="yellow"
          loading={loading}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Detailed Analysis Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <InfoCard
          title="Top Traffic Sources"
          value={analytics?.sourceQuality?.length || 0}
          subtitle="Sources tracked"
          items={sourceQualityItems}
          loading={loading}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
          }
        />

        <InfoCard
          title="Top African Cities"
          value={analytics?.topAfricanCities?.length || 0}
          subtitle="City hotspots"
          items={topAfricanCitiesItems}
          loading={loading}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />

        <InfoCard
          title="Experience Distribution"
          value={experienceLevelsCount}
          subtitle="Experience levels"
          items={experienceDistributionItems}
          loading={loading}
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
        />
      </div>
    </div>
  );
});
