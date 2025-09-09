interface RegistrationTimePatterns {
  peakHour: { hour: number; count: number } | null;
  byDay: Array<{ day: string; count: number }>;
  byHour: Array<{ hour: number; count: number }>;
}

interface TimeAnalysisProps {
  data: RegistrationTimePatterns;
  loading?: boolean;
}

export function TimeAnalysis({ data, loading }: TimeAnalysisProps) {
  if (loading) {
    return (
      <div
        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse motion-reduce:animate-none"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-white/10 rounded-lg"></div>
            <div className="h-32 bg-white/10 rounded-lg"></div>
          </div>
          <div className="h-24 bg-white/10 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Format hour to 12-hour format
  const formatHour = (hour: number): string => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  };

  const maxDayCount = data.byDay.length
    ? Math.max(...data.byDay.map((d) => d.count))
    : 0;
  const maxHourCount = data.byHour.length
    ? Math.max(...data.byHour.map((h) => h.count))
    : 0;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Registration Patterns
        </h3>
        <p className="text-gray-300 text-sm">
          When people register for the event
        </p>
      </div>

      {/* Peak Hour Highlight */}
      {data.peakHour && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-white font-semibold">
                Peak Time: {formatHour(data.peakHour.hour)}
              </div>
              <div className="text-gray-300 text-sm">
                {data.peakHour.count} registrations in this hour
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Day of Week Analysis */}
        <div>
          <h4 className="text-white font-medium mb-4 text-sm">
            By Day of Week
          </h4>
          <div className="space-y-3">
            {data.byDay.map((item) => {
              const barWidth =
                maxDayCount > 0 ? (item.count / maxDayCount) * 100 : 0;
              const isWeekend =
                item.day === "Saturday" || item.day === "Sunday";

              return (
                <div key={item.day} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 text-sm font-medium">
                      {item.day}
                    </span>
                    <span className="text-white text-sm font-bold">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700/30 rounded-full h-2">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        isWeekend
                          ? "bg-gradient-to-r from-green-500 to-green-400"
                          : "bg-gradient-to-r from-blue-500 to-blue-400"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Hours */}
        <div>
          <h4 className="text-white font-medium mb-4 text-sm">
            Top Registration Hours
          </h4>
          <div className="space-y-3">
            {data.byHour
              .filter((h) => h.count > 0)
              .sort((a, b) => b.count - a.count)
              .slice(0, 6)
              .map((item, index) => {
                const barWidth =
                  maxHourCount > 0 ? (item.count / maxHourCount) * 100 : 0;
                const isTopHour = index === 0;

                return (
                  <div key={item.hour} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-300 text-sm font-medium">
                        {formatHour(item.hour)}
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          isTopHour ? "text-yellow-400" : "text-white"
                        }`}
                      >
                        {item.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700/30 rounded-full h-2">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          isTopHour
                            ? "bg-gradient-to-r from-yellow-500 to-yellow-400 shadow-lg shadow-yellow-500/30"
                            : "bg-gradient-to-r from-purple-500 to-purple-400"
                        }`}
                        style={{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-green-400 text-lg font-bold">
            {data.byDay.find((d) => d.day === "Sunday")?.count || 0}
          </div>
          <div className="text-gray-400 text-xs">Sunday Regs</div>
        </div>
        <div className="text-center">
          <div className="text-blue-400 text-lg font-bold">
            {data.peakHour ? formatHour(data.peakHour.hour) : "N/A"}
          </div>
          <div className="text-gray-400 text-xs">Peak Hour</div>
        </div>
        <div className="text-center">
          <div className="text-purple-400 text-lg font-bold">
            {data.byHour.filter((h) => h.count > 0).length}
          </div>
          <div className="text-gray-400 text-xs">Active Hours</div>
        </div>
      </div>
    </div>
  );
}
