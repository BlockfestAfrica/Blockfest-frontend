"use client";

import { memo, useMemo } from "react";

interface ProfessionalRolesProps {
  data: Array<{
    role: string;
    count: number;
    percentage: number;
  }>;
  loading?: boolean;
}

const ROLE_COLORS = [
  "#3B82F6", // Developer - Blue
  "#10B981", // Creator - Green
  "#F59E0B", // Researcher - Amber
  "#EF4444", // Student - Red
  "#8B5CF6", // BD/Sales/Growth - Purple
  "#06B6D4", // Professional Investor - Cyan
  "#F97316", // Others - Orange
  "#6B7280", // Unknown - Gray
];

export const ProfessionalRoles = memo(function ProfessionalRoles({
  data,
  loading = false,
}: ProfessionalRolesProps) {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: ROLE_COLORS[index % ROLE_COLORS.length],
    }));
  }, [data]);

  const totalCount = useMemo(() => {
    return data.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  const topRole = useMemo(() => {
    return data.length > 0 ? data[0] : null;
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 bg-white/10 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-white/10 rounded w-32 mt-2 animate-pulse"></div>
          </div>
        </div>
        <div className="h-80 bg-white/5 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/[0.07] transition-all duration-300 min-h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Professional Roles
          </h3>
          <p className="text-gray-300 text-sm">
            Breakdown by professional background
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-400">{totalCount}</div>
          <div className="text-xs text-gray-400">Total Roles</div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center flex-grow text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">👥</div>
            <div>No professional role data available</div>
          </div>
        </div>
      ) : (
        <div className="flex-grow flex flex-col justify-between space-y-6">
          {/* Custom Bar Chart */}
          <div className="space-y-4 mb-6">
            {chartData.map((role) => (
              <div key={role.role} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="text-white font-medium">{role.role}</span>
                  </div>
                  <div className="text-gray-300">
                    {role.count} ({role.percentage}%)
                  </div>
                </div>
                <div className="w-full bg-gray-800/50 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      backgroundColor: role.color,
                      width: `${role.percentage}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Top Insights */}
          <div className="space-y-3">
            {topRole && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-blue-400 font-medium">
                      Most Common Role
                    </div>
                    <div className="text-white text-lg font-semibold">
                      {topRole.role}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-blue-400 text-2xl font-bold">
                      {topRole.percentage}%
                    </div>
                    <div className="text-gray-300 text-sm">
                      {topRole.count} people
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/30 rounded-lg p-3 text-center">
                <div className="text-green-400 text-lg font-bold">
                  {chartData
                    .filter((r) => r.role.toLowerCase().includes("developer"))
                    .reduce((sum, r) => sum + r.percentage, 0)
                    .toFixed(1)}
                  %
                </div>
                <div className="text-gray-400 text-xs">Technical Roles</div>
              </div>
              <div className="bg-gray-800/30 rounded-lg p-3 text-center">
                <div className="text-purple-400 text-lg font-bold">
                  {chartData
                    .filter((r) => r.role.toLowerCase().includes("student"))
                    .reduce((sum, r) => sum + r.percentage, 0)
                    .toFixed(1)}
                  %
                </div>
                <div className="text-gray-400 text-xs">Students</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
