"use client";

import { memo, useMemo } from "react";
import { DashboardStats } from "./dashboard";

interface ApprovalInsightsProps {
  stats: DashboardStats & {
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
  };
  loading?: boolean;
}

interface ApprovalCardProps {
  title: string;
  category: string;
  approved: number;
  pending: number;
  declined: number;
  total: number;
  icon: React.ReactNode;
  loading?: boolean;
}

function ApprovalCard({
  title,
  category,
  approved,
  pending,
  declined,
  total,
  icon,
  loading,
}: ApprovalCardProps) {
  const approvalRate =
    total > 0 ? ((approved / total) * 100).toFixed(1) : "0.0";
  const pendingRate = total > 0 ? ((pending / total) * 100).toFixed(1) : "0.0";

  if (loading) {
    return (
      <div
        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse motion-reduce:animate-none"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={`Loading ${category} approval data`}
      >
        <div className="space-y-4">
          <div className="h-4 bg-white/10 rounded w-3/4"></div>
          <div className="h-8 bg-white/10 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-3 bg-white/10 rounded w-2/3"></div>
            <div className="h-3 bg-white/10 rounded w-1/2"></div>
            <div className="h-3 bg-white/10 rounded w-3/4"></div>
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
            {total.toLocaleString()}
          </p>
          <p className="text-gray-400 text-xs">Total {category}</p>
        </div>
        <div className="text-white/60 group-hover:text-white/80 transition-colors duration-200">
          {icon}
        </div>
      </div>

      <div className="space-y-3">
        {/* Approved */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="text-green-300 text-sm">Approved</span>
          </div>
          <div className="text-right">
            <span className="text-green-300 font-semibold">{approved}</span>
            <span className="text-gray-400 text-xs ml-1">
              ({approvalRate}%)
            </span>
          </div>
        </div>

        {/* Pending */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <span className="text-yellow-300 text-sm">Pending</span>
          </div>
          <div className="text-right">
            <span className="text-yellow-300 font-semibold">{pending}</span>
            <span className="text-gray-400 text-xs ml-1">({pendingRate}%)</span>
          </div>
        </div>

        {/* Declined */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <span className="text-red-300 text-sm">Declined</span>
          </div>
          <div className="text-right">
            <span className="text-red-300 font-semibold">{declined}</span>
            <span className="text-gray-400 text-xs ml-1">
              ({total > 0 ? ((declined / total) * 100).toFixed(1) : "0.0"}%)
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="bg-white/10 rounded-full h-2 overflow-hidden">
            <div className="flex h-full">
              {total > 0 && (
                <>
                  <div
                    className="bg-green-400"
                    style={{ width: `${(approved / total) * 100}%` }}
                  ></div>
                  <div
                    className="bg-yellow-400"
                    style={{ width: `${(pending / total) * 100}%` }}
                  ></div>
                  <div
                    className="bg-red-400"
                    style={{ width: `${(declined / total) * 100}%` }}
                  ></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ApprovalInsights = memo(function ApprovalInsights({
  stats,
  loading,
}: ApprovalInsightsProps) {
  const approvalCards = useMemo(
    () => [
      {
        title: "Developers",
        category: "developers",
        approved: stats.approvalBreakdown?.approvedDevelopers || 0,
        pending: stats.approvalBreakdown?.pendingDevelopers || 0,
        declined: stats.approvalBreakdown?.declinedDevelopers || 0,
        total: stats.approvalBreakdown?.totalDevelopers || 0,
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
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        ),
      },
      {
        title: "Founders",
        category: "founders",
        approved: stats.approvalBreakdown?.approvedFounders || 0,
        pending: stats.approvalBreakdown?.pendingFounders || 0,
        declined: stats.approvalBreakdown?.declinedFounders || 0,
        total: stats.approvalBreakdown?.totalFounders || 0,
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
      },
      {
        title: "Students",
        category: "students",
        approved: stats.approvalBreakdown?.approvedStudents || 0,
        pending: stats.approvalBreakdown?.pendingStudents || 0,
        declined: stats.approvalBreakdown?.declinedStudents || 0,
        total: stats.approvalBreakdown?.totalStudents || 0,
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
              d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
            />
          </svg>
        ),
      },
      {
        title: "Creators",
        category: "creators",
        approved: stats.approvalBreakdown?.approvedCreators || 0,
        pending: stats.approvalBreakdown?.pendingCreators || 0,
        declined: stats.approvalBreakdown?.declinedCreators || 0,
        total: stats.approvalBreakdown?.totalCreators || 0,
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
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        ),
      },
    ],
    [stats.approvalBreakdown]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Approval Status</h3>
        <div className="text-sm text-gray-300">
          Overall Rate:{" "}
          <span className="text-green-300 font-semibold">
            {stats.approvalBreakdown?.overallApprovalRate?.toFixed(1) || "0.0"}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {approvalCards.map((card, index) => (
          <ApprovalCard key={index} {...card} loading={loading} />
        ))}
      </div>
    </div>
  );
});
