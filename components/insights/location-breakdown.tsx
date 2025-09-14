import { memo } from "react";

interface LocationBreakdownProps {
  data: Array<{ country: string; count: number; percentage: number }>;
  loading?: boolean;
}

export const LocationBreakdown = memo(function LocationBreakdown({
  data,
  loading,
}: LocationBreakdownProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950/90 via-slate-900/95 to-teal-950/90 backdrop-blur-sm border border-emerald-300/20 rounded-xl p-8 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/5 via-transparent to-teal-400/5 pointer-events-none" />
        <div className="relative z-10 space-y-6">
          <div className="h-7 bg-emerald-200/20 rounded-lg w-1/3"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-5 bg-emerald-200/15 rounded-md w-32"></div>
                <div className="h-3 bg-emerald-200/10 rounded-full w-full"></div>
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
    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950/90 via-slate-900/95 to-teal-950/90 backdrop-blur-sm border border-emerald-300/20 rounded-xl p-8 h-full flex flex-col transition-all duration-300 hover:border-emerald-300/30 hover:shadow-xl hover:shadow-emerald-500/10">
      {/* Enhanced background overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/5 via-transparent to-teal-400/5 pointer-events-none" />

      <div className="relative z-10 mb-6">
        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
          Geographic Distribution
        </h3>
        <p className="text-emerald-100/70 text-sm leading-relaxed">
          Registration breakdown by country
        </p>
      </div>

      <div className="relative z-10 space-y-5 flex-1">
        {topCountries.map((item, index) => {
          const widthPercentage =
            maxCount > 0 ? (item.count / maxCount) * 100 : 0;

          return (
            <div
              key={item.country}
              className="group transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full shadow-sm ${
                      index === 0
                        ? "bg-emerald-400 shadow-emerald-400/30"
                        : index === 1
                        ? "bg-emerald-500 shadow-emerald-500/30"
                        : index === 2
                        ? "bg-emerald-600 shadow-emerald-600/30"
                        : "bg-teal-500/70 shadow-teal-500/20"
                    }`}
                  />
                  <span className="text-emerald-50 text-sm font-medium tracking-wide">
                    {item.country}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-emerald-50 text-sm font-bold tabular-nums">
                    {item.count.toLocaleString()}
                  </div>
                  <div className="text-emerald-100/60 text-xs tabular-nums">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="w-full bg-emerald-950/30 rounded-full h-3 overflow-hidden border border-emerald-800/20">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    index === 0
                      ? "bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-200 shadow-lg shadow-emerald-400/20"
                      : index === 1
                      ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 shadow-md shadow-emerald-500/20"
                      : index === 2
                      ? "bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 shadow-md shadow-emerald-600/20"
                      : "bg-gradient-to-r from-teal-500/70 via-teal-400/60 to-teal-300/50 shadow-sm shadow-teal-500/15"
                  } group-hover:brightness-110 group-hover:shadow-lg`}
                  style={{
                    width: `${widthPercentage}%`,
                    animationDelay: `${index * 150}ms`,
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
});
