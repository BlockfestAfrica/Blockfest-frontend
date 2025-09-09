interface LocationBreakdownProps {
  data: Array<{ country: string; count: number; percentage: number }>;
  loading?: boolean;
}

export function LocationBreakdown({ data, loading }: LocationBreakdownProps) {
  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-white/10 rounded w-24"></div>
                <div className="h-2 bg-white/10 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const topCountries = data.slice(0, 6);
  const maxCount = Math.max(0, ...topCountries.map((item) => item.count));

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Geographic Distribution
        </h3>
        <p className="text-gray-300 text-sm">
          Registration breakdown by country
        </p>
      </div>

      <div className="space-y-4 flex-1">
        {topCountries.map((item, index) => {
          const widthPercentage =
            maxCount > 0 ? (item.count / maxCount) * 100 : 0;

          return (
            <div key={item.country} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      index === 0
                        ? "bg-blue-400"
                        : index === 1
                        ? "bg-blue-500"
                        : index === 2
                        ? "bg-blue-600"
                        : "bg-blue-700/60"
                    }`}
                  />
                  <span className="text-white text-sm font-medium">
                    {item.country}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-white text-sm font-medium">
                    {item.count.toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    index === 0
                      ? "bg-gradient-to-r from-blue-400 to-blue-300"
                      : index === 1
                      ? "bg-gradient-to-r from-blue-500 to-blue-400"
                      : index === 2
                      ? "bg-gradient-to-r from-blue-600 to-blue-500"
                      : "bg-gradient-to-r from-blue-700/60 to-blue-600/60"
                  } group-hover:brightness-110`}
                  style={{
                    width: `${widthPercentage}%`,
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
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-white text-lg font-bold">{data.length}</div>
            <div className="text-gray-400 text-xs">Countries</div>
          </div>
          <div>
            <div className="text-white text-lg font-bold">
              {data
                .slice(0, 3)
                .reduce((sum, item) => sum + item.percentage, 0)
                .toFixed(1)}
              %
            </div>
            <div className="text-gray-400 text-xs">Top 3</div>
          </div>
          <div>
            <div className="text-white text-lg font-bold">
              {(
                data.find((item) => item.country === "Others")?.percentage ?? 0
              ).toFixed(1)}
              %
            </div>
            <div className="text-gray-400 text-xs">Others</div>
          </div>
        </div>
      </div>
    </div>
  );
}
