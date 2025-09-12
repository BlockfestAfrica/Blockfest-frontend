"use client";

import { memo, useMemo } from "react";

interface DietaryRequirementsProps {
  data: {
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
  loading?: boolean;
}

const DIETARY_COLORS = {
  vegetarian: "#10B981", // Green
  vegan: "#059669", // Dark Green
  halal: "#3B82F6", // Blue
  kosher: "#6366F1", // Indigo
  gluten: "#F59E0B", // Amber
  dairy: "#EF4444", // Red
  nut: "#F97316", // Orange
  other: "#8B5CF6", // Purple
};

export const DietaryRequirements = memo(function DietaryRequirements({
  data,
  loading = false,
}: DietaryRequirementsProps) {
  const chartData = useMemo(() => {
    return data.restrictions.map((item) => ({
      ...item,
      color:
        DIETARY_COLORS[
          item.type.toLowerCase() as keyof typeof DIETARY_COLORS
        ] || "#6B7280",
    }));
  }, [data.restrictions]);

  const restrictionPercentage = useMemo(() => {
    if (data.totalResponses === 0) return 0;
    return Math.round((data.hasRestrictions / data.totalResponses) * 100);
  }, [data.totalResponses, data.hasRestrictions]);

  const cateringInsights = useMemo(() => {
    const vegetarianCount =
      data.restrictions.find((r) => r.type.toLowerCase().includes("vegetarian"))
        ?.count || 0;
    const veganCount =
      data.restrictions.find((r) => r.type.toLowerCase().includes("vegan"))
        ?.count || 0;
    const halalCount =
      data.restrictions.find((r) => r.type.toLowerCase().includes("halal"))
        ?.count || 0;

    return {
      vegetarianFriendly: vegetarianCount + veganCount,
      halalRequired: halalCount,
      allergenFree: data.restrictions
        .filter(
          (r) =>
            r.type.toLowerCase().includes("gluten") ||
            r.type.toLowerCase().includes("nut") ||
            r.type.toLowerCase().includes("dairy")
        )
        .reduce((sum, r) => sum + r.count, 0),
    };
  }, [data.restrictions]);

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
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/[0.07] transition-all duration-300 min-h-[750px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Dietary Requirements
          </h3>
          <p className="text-gray-300 text-sm">
            Catering and accessibility planning
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-orange-400">
            {data.totalResponses}
          </div>
          <div className="text-xs text-gray-400">Total Responses</div>
        </div>
      </div>

      {data.totalResponses === 0 ? (
        <div className="flex items-center justify-center flex-grow text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">🍽️</div>
            <div>No dietary requirements data available</div>
          </div>
        </div>
      ) : (
        <div className="flex-grow flex flex-col justify-between space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <div className="text-green-400 text-2xl font-bold">
                {data.noRestrictions}
              </div>
              <div className="text-gray-300 text-sm">No Restrictions</div>
              <div className="text-gray-400 text-xs">
                {Math.round((data.noRestrictions / data.totalResponses) * 100)}%
              </div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
              <div className="text-orange-400 text-2xl font-bold">
                {data.hasRestrictions}
              </div>
              <div className="text-gray-300 text-sm">Have Restrictions</div>
              <div className="text-gray-400 text-xs">
                {restrictionPercentage}%
              </div>
            </div>
          </div>

          {/* Dietary Restrictions Breakdown */}
          {chartData.length > 0 && (
            <div className="space-y-4 mb-6">
              <h4 className="text-lg font-medium text-white">
                Restriction Types
              </h4>
              {chartData.map((restriction) => (
                <div key={restriction.type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: restriction.color }}
                      />
                      <span className="text-white font-medium capitalize">
                        {restriction.type}
                      </span>
                    </div>
                    <div className="text-gray-300">
                      {restriction.count} ({restriction.percentage}%)
                    </div>
                  </div>
                  <div className="w-full bg-gray-800/50 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-1000 ease-out"
                      style={{
                        backgroundColor: restriction.color,
                        width: `${restriction.percentage}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Catering Insights */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white">
              Catering Planning
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <div className="text-green-400 text-lg font-bold">
                  {cateringInsights.vegetarianFriendly}
                </div>
                <div className="text-gray-300 text-xs">Vegetarian/Vegan</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                <div className="text-blue-400 text-lg font-bold">
                  {cateringInsights.halalRequired}
                </div>
                <div className="text-gray-300 text-xs">Halal Required</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                <div className="text-amber-400 text-lg font-bold">
                  {cateringInsights.allergenFree}
                </div>
                <div className="text-gray-300 text-xs">Allergen Concerns</div>
              </div>
            </div>

            {/* Catering Planning Summary */}
            {(cateringInsights.vegetarianFriendly > 0 ||
              cateringInsights.halalRequired > 0) && (
              <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-lg p-4">
                <h5 className="text-orange-300 font-medium mb-2">
                  Catering Requirements
                </h5>
                <div className="text-gray-300 text-sm space-y-1">
                  {cateringInsights.vegetarianFriendly > 0 && (
                    <div>
                      • {cateringInsights.vegetarianFriendly} vegetarian/vegan
                      meals needed
                    </div>
                  )}
                  {cateringInsights.halalRequired > 0 && (
                    <div>
                      • {cateringInsights.halalRequired} halal-certified meals
                      needed
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Most Common Restrictions */}
            {data.commonRestrictions.length > 0 && (
              <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-4">
                <h5 className="text-orange-300 font-medium mb-4 flex items-center gap-2">
                  <span className="text-lg">🚫</span>
                  Most Common Restrictions
                </h5>
                <div className="space-y-3">
                  {data.commonRestrictions
                    .slice(0, 5)
                    .map((restriction, index) => {
                      const colors = [
                        "from-red-500/20 to-red-600/20 border-red-500/30 text-red-300",
                        "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-300",
                        "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-300",
                        "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-300",
                        "from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-300",
                      ];
                      const count =
                        chartData.find((c) => c.type === restriction)?.count ||
                        0;
                      const percentage =
                        chartData.find((c) => c.type === restriction)
                          ?.percentage || 0;

                      return (
                        <div
                          key={restriction}
                          className={`bg-gradient-to-r ${colors[index]} border rounded-lg p-3 flex items-center justify-between hover:scale-[1.02] transition-transform duration-200`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-current opacity-80"></div>
                            <span className="font-medium capitalize">
                              {restriction}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{count}</div>
                            <div className="text-xs opacity-75">
                              {percentage}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
