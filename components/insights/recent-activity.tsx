interface RecentActivityProps {
  interests: Array<{ interest: string; count: number }>;
  loading?: boolean;
}

export function RecentActivity({ interests, loading }: RecentActivityProps) {
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
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-white/10 rounded w-32"></div>
                <div className="h-4 bg-white/10 rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalCount = interests.reduce((sum, item) => sum + item.count, 0);
  const maxCount = interests.length
    ? Math.max(...interests.map((item) => item.count))
    : 0;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Top Interests</h3>
        <p className="text-gray-300 text-sm">Most popular areas of interest</p>
      </div>

      <div className="space-y-4 flex-1">
        {interests.slice(0, 5).map((item, index) => {
          const percentage =
            totalCount > 0 ? (item.count / totalCount) * 100 : 0;
          const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

          return (
            <div key={item.interest} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      index === 0
                        ? "bg-purple-400"
                        : index === 1
                        ? "bg-blue-400"
                        : index === 2
                        ? "bg-indigo-400"
                        : index === 3
                        ? "bg-cyan-400"
                        : "bg-teal-400"
                    }`}
                  />
                  <span className="text-white text-sm font-medium truncate">
                    {item.interest}
                  </span>
                </div>
                <div className="text-right ml-2">
                  <div className="text-white text-sm font-medium">
                    {item.count.toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    index === 0
                      ? "bg-gradient-to-r from-purple-400 to-purple-300"
                      : index === 1
                      ? "bg-gradient-to-r from-blue-400 to-blue-300"
                      : index === 2
                      ? "bg-gradient-to-r from-indigo-400 to-indigo-300"
                      : index === 3
                      ? "bg-gradient-to-r from-cyan-400 to-cyan-300"
                      : "bg-gradient-to-r from-teal-400 to-teal-300"
                  } group-hover:brightness-110`}
                  style={{
                    width: `${barWidth}%`,
                    animationDelay: `${index * 100}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <div className="text-center">
          <div className="text-white text-lg font-bold">
            {totalCount.toLocaleString()}
          </div>
          <div className="text-gray-400 text-sm">Total Interest Selections</div>
          <div className="text-gray-400 text-xs mt-1">
            Avg.{" "}
            {interests.length ? Math.round(totalCount / interests.length) : 0}{" "}
            per category
          </div>
        </div>
      </div>
    </div>
  );
}
