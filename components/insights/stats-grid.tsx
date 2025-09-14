import { memo, useMemo } from "react";
import { DashboardStats } from "./dashboard";

interface StatsGridProps {
  stats: DashboardStats;
  loading?: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  loading?: boolean;
}

const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  loading,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        className="bg-gradient-to-br from-slate-800/70 via-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-700/30 rounded-2xl p-6 animate-pulse motion-reduce:animate-none shadow-2xl shadow-black/20"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={`Loading ${title}`}
      >
        <div className="space-y-4">
          <div className="h-4 bg-slate-700/50 rounded-lg w-3/4"></div>
          <div className="h-8 bg-slate-700/50 rounded-lg w-1/2"></div>
          <div className="h-3 bg-slate-800/50 rounded-lg w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/70 via-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-700/30 rounded-2xl p-6 hover:from-slate-800/80 hover:via-slate-900/90 hover:to-slate-950/95 hover:border-slate-600/40 transition-all duration-300 ease-out group shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-sm font-medium mb-2 tracking-wide">
            {title}
          </p>
          <p className="text-slate-100 text-3xl font-bold mb-2 tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-slate-500 text-xs font-medium">{subtitle}</p>
          )}
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs ${
                trend.direction === "up" ? "text-green-400" : "text-red-400"
              }`}
            >
              <svg
                className={`w-3 h-3 ${
                  trend.direction === "down" ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 17l5-5 5 5"
                />
              </svg>
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className="text-white/60 group-hover:text-white/80 transition-colors duration-200">
          {icon}
        </div>
      </div>
    </div>
  );
});

export const StatsGrid = memo(function StatsGrid({
  stats,
  loading,
}: StatsGridProps) {
  const confirmationRate = useMemo(
    () =>
      stats.totalGuests > 0
        ? ((stats.confirmedGuests / stats.totalGuests) * 100).toFixed(1)
        : "0.0",
    [stats.totalGuests, stats.confirmedGuests]
  );

  const statCards = useMemo(
    () => [
      {
        title: "Total Registrations",
        value: stats.totalGuests,
        subtitle: `${confirmationRate}% confirmed`,
        icon: (
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        ),
        // Removed hardcoded trend - no real trend data available from API
        // trend: { value: 12.5, direction: "up" as const },
      },
      {
        title: "Confirmed Guests",
        value: stats.confirmedGuests,
        subtitle: `${stats.pendingGuests} pending`,
        icon: (
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
        ),
        // Removed hardcoded trend - no real trend data available from API
        // trend: { value: 8.3, direction: "up" as const },
      },
      {
        title: "Countries",
        value: stats.countriesRepresented,
        subtitle: `${stats.citiesRepresented} cities`,
        icon: (
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
        ),
        // Removed hardcoded trend - no real trend data available from API
        // trend: { value: 5.7, direction: "up" as const },
      },
      {
        title: "Common Level",
        value: stats.topExperienceLevel || "Unknown",
        subtitle: `Web3 experience`,
        icon: (
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
        ),
        // Removed hardcoded trend - no real trend data available from API
        // trend: { value: 4.2, direction: "up" as const },
      },
    ],
    [stats, confirmationRate]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((card, index) => (
        <StatCard key={index} {...card} loading={loading} />
      ))}
    </div>
  );
});
