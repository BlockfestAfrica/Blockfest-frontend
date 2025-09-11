"use client";

import { memo } from "react";

interface RegistrationChartProps {
  data: Array<{ date: string; count: number }>;
  loading?: boolean;
}

const RegistrationChart = memo(function RegistrationChart({
  data,
  loading,
}: RegistrationChartProps) {
  // Debug logging in development
  if (process.env.NODE_ENV === "development" && data?.length > 0) {
    console.log("Registration Trends Data:", {
      dataPoints: data.length,
      totalRegistrations: data.reduce((sum, item) => sum + item.count, 0),
      maxCount: Math.max(...data.map((d) => d.count)),
      data: data.map((d) => ({ date: d.date, count: d.count })),
    });
  }

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          <div className="h-64 bg-white/10 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Handle empty or invalid data
  if (!data || data.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">
            Registration Trends
          </h3>
          <p className="text-gray-300 text-sm">
            No registration data available
          </p>
        </div>
      </div>
    );
  }

  // Validate and sanitize data
  const validData = data.filter(
    (item) =>
      item &&
      typeof item.count === "number" &&
      item.count >= 0 &&
      item.date &&
      !isNaN(new Date(item.date).getTime())
  );

  if (validData.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">
            Registration Trends
          </h3>
          <p className="text-gray-300 text-sm">
            Invalid registration data format
          </p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...validData.map((d) => d.count));
  const totalCount = validData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          Registration Trends
        </h3>
        <p className="text-gray-300 text-sm">
          Weekly registration volume over time ({validData.length} weeks)
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Chart */}
        <div className="relative bg-gray-900/20 rounded-lg p-6 flex-1 min-h-[320px]">
          {/* Chart area */}
          <div className="relative h-64 ml-12 mr-4">
            {/* Y-axis labels */}
            <div className="absolute -left-12 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 text-right w-10">
              <span>{maxCount.toLocaleString()}</span>
              <span>{Math.floor(maxCount * 0.75).toLocaleString()}</span>
              <span>{Math.floor(maxCount * 0.5).toLocaleString()}</span>
              <span>{Math.floor(maxCount * 0.25).toLocaleString()}</span>
              <span>0</span>
            </div>

            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="border-t border-white/20 absolute top-0 left-0 right-0"></div>
              <div className="border-t border-white/10 absolute top-1/4 left-0 right-0"></div>
              <div className="border-t border-white/10 absolute top-1/2 left-0 right-0"></div>
              <div className="border-t border-white/10 absolute top-3/4 left-0 right-0"></div>
              <div className="border-t border-white/20 absolute bottom-0 left-0 right-0"></div>
            </div>

            {/* Bars */}
            <div className="flex items-end justify-between h-full gap-2 relative z-10">
              {validData.map((item, index) => {
                const date = new Date(item.date);
                const isHighest = item.count === maxCount;
                // Calculate exact height to match Y-axis scale
                const heightPercent =
                  maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col justify-end items-center group h-full"
                  >
                    {/* Bar with calculated height */}
                    <div className="relative mb-2">
                      <div
                        className={`w-8 rounded-t-md transition-all duration-300 group-hover:opacity-80 ${
                          isHighest
                            ? "bg-gradient-to-t from-blue-500 to-blue-400 shadow-lg shadow-blue-500/20"
                            : "bg-gradient-to-t from-blue-600/80 to-blue-500/80"
                        }`}
                        style={{
                          height: `${Math.max(heightPercent * 2.24, 8)}px`, // Better scaling with minimum height
                        }}
                      />

                      {/* Value label on hover */}
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <div className="bg-gray-900/95 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">
                          {item.count.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Date label */}
                    <div className="text-xs text-gray-400 text-center truncate">
                      {(() => {
                        // For weekly data, show week range
                        const weekStart = new Date(date);
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekEnd.getDate() + 6);

                        // If it's the same month, show range like "Sep 1-7"
                        if (weekStart.getMonth() === weekEnd.getMonth()) {
                          return `${weekStart.toLocaleDateString("en-US", {
                            month: "short",
                          })} ${weekStart.getDate()}-${weekEnd.getDate()}`;
                        } else {
                          // Different months, show like "Aug 31-Sep 6"
                          return `${weekStart.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}-${weekEnd.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}`;
                        }
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/10 text-sm">
          <div>
            <span className="text-gray-400">Total: </span>
            <span className="text-white font-medium">
              {totalCount.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Peak: </span>
            <span className="text-white font-medium">
              {maxCount.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Average: </span>
            <span className="text-white font-medium">
              {Math.round(totalCount / validData.length).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export { RegistrationChart };
