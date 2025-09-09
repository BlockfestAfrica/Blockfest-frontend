interface TopCompaniesProps {
  data: Array<{ company: string; count: number }>;
  loading?: boolean;
}

export function TopCompanies({ data, loading }: TopCompaniesProps) {
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
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-white/10 rounded w-40"></div>
                <div className="h-4 bg-white/10 rounded w-8"></div>
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
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Top Companies & Projects
        </h3>
        <p className="text-gray-300 text-sm">
          Organizations represented at the event
        </p>
      </div>

      <div className="space-y-3 flex-1">
        {data.slice(0, 8).map((item, index) => {
          const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          const isTop3 = index < 3;

          return (
            <div key={`${item.company}-${index}`} className="group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-white font-medium text-sm truncate"
                      title={item.company}
                    >
                      {item.company}
                    </div>
                    <div className="relative mt-1">
                      <div className="w-full bg-gray-700/30 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            isTop3
                              ? "bg-gradient-to-r from-yellow-500 to-yellow-400 shadow-md shadow-yellow-500/30"
                              : "bg-gradient-to-r from-blue-600/80 to-blue-500/80"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <span
                    className={`font-bold text-sm ${
                      isTop3 ? "text-yellow-400" : "text-white"
                    }`}
                  >
                    {item.count}
                  </span>
                  <span className="text-gray-400 text-xs ml-1">
                    {item.count === 1 ? "rep" : "reps"}
                  </span>
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
            {data.length.toLocaleString()}
          </div>
          <div className="text-gray-400 text-sm">Unique Companies</div>
        </div>
        <div className="text-center">
          <div className="text-blue-400 text-lg font-bold">
            {data.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
          </div>
          <div className="text-gray-400 text-sm">Total Reps</div>
        </div>
      </div>
    </div>
  );
}
