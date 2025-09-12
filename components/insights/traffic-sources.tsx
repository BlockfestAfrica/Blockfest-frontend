interface TrafficSourcesProps {
  data: Array<{ source: string; count: number; percentage: number }>;
  loading?: boolean;
}

export function TrafficSources({ data, loading }: TrafficSourcesProps) {
  if (loading) {
    return (
      <div
        className="relative overflow-hidden bg-gradient-to-br from-amber-950/90 via-slate-900/95 to-orange-950/90 backdrop-blur-sm border border-amber-300/20 rounded-xl p-8 animate-pulse motion-reduce:animate-none"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-600/5 via-transparent to-orange-400/5 pointer-events-none" />
        <div className="relative z-10 space-y-6">
          <div className="h-7 bg-amber-200/20 rounded-lg w-1/3"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-5 bg-amber-200/15 rounded-md w-36"></div>
                <div className="h-5 bg-amber-200/15 rounded-md w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const maxCount = data.length
    ? Math.max(...data.map((item) => item.count))
    : 0;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/90 via-slate-900/95 to-orange-950/90 backdrop-blur-sm border border-amber-300/20 rounded-xl p-8 h-full flex flex-col transition-all duration-300 hover:border-amber-300/30 hover:shadow-xl hover:shadow-amber-500/10">
      {/* Enhanced background overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-600/5 via-transparent to-orange-400/5 pointer-events-none" />

      <div className="relative z-10 mb-6">
        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
          Traffic Sources
        </h3>
        <p className="text-amber-100/70 text-sm leading-relaxed">
          How attendees discovered the event
        </p>
      </div>

      <div className="space-y-4 flex-1">
        {data.slice(0, 7).map((item, index) => {
          const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          const isTopSource = index === 0;

          return (
            <div key={item.source} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isTopSource
                        ? "bg-green-400 shadow-lg shadow-green-400/50"
                        : index === 1
                        ? "bg-blue-400"
                        : index === 2
                        ? "bg-purple-400"
                        : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-white font-medium text-sm">
                    {item.source}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-white font-bold text-sm">
                    {item.count}
                  </span>
                  <span className="text-gray-400 text-xs ml-1">
                    ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="relative">
                <div className="w-full bg-gray-700/30 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      isTopSource
                        ? "bg-gradient-to-r from-green-500 to-green-400 shadow-lg shadow-green-500/30"
                        : index === 1
                        ? "bg-gradient-to-r from-blue-500 to-blue-400"
                        : index === 2
                        ? "bg-gradient-to-r from-purple-500 to-purple-400"
                        : "bg-gradient-to-r from-gray-500 to-gray-400"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-white text-lg font-bold">
            {data.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
          </div>
          <div className="text-gray-400 text-sm">Total Tracked</div>
        </div>
        <div className="text-center">
          <div className="text-green-400 text-lg font-bold">
            {data.length > 0 ? data[0].source : "N/A"}
          </div>
          <div className="text-gray-400 text-sm">Top Source</div>
        </div>
      </div>
    </div>
  );
}
