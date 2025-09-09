interface GenderBreakdownProps {
  data: Array<{ gender: string; count: number; percentage: number }>;
  loading?: boolean;
}

export function GenderBreakdown({ data, loading }: GenderBreakdownProps) {
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
          <div className="h-32 bg-white/10 rounded-lg"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-white/10 rounded w-16"></div>
                <div className="h-4 bg-white/10 rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalCount = data.reduce((sum, item) => sum + item.count, 0);

  // Color scheme for gender representation
  const getGenderColor = (gender: string) => {
    if (gender.toLowerCase() === "male") return "from-blue-500 to-blue-400";
    if (gender.toLowerCase() === "female") return "from-pink-500 to-pink-400";
    return "from-purple-500 to-purple-400";
  };

  const getGenderIcon = (gender: string) => {
    if (gender.toLowerCase() === "male") {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2c2.757 0 5 2.243 5 5 0 2.025-1.21 3.77-2.938 4.542v1.458h2v2h-2v2h2v2h-8v-2h2v-2h-2v-2h2v-1.458c-1.728-.772-2.938-2.517-2.938-4.542 0-2.757 2.243-5 5-5zm0 2c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
        </svg>
      );
    }
    if (gender.toLowerCase() === "female") {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2c2.757 0 5 2.243 5 5 0 2.025-1.21 3.77-2.938 4.542v1.458h2v2h-2v2h2v2h-8v-2h2v-2h-2v-2h2v-1.458c-1.728-.772-2.938-2.517-2.938-4.542 0-2.757 2.243-5 5-5zm0 2c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
          <circle cx="12" cy="7" r="3" />
          <path d="M12 13c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3zm0-8c-2.757 0-5 2.243-5 5s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    );
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Gender Distribution
        </h3>
        <p className="text-gray-300 text-sm">
          Diversity representation at the event
        </p>
      </div>

      {/* Visual Representation */}
      <div className="mb-6">
        <div className="relative">
          {/* Progress Bar */}
          <div className="flex w-full h-6 bg-gray-700/30 rounded-full overflow-hidden">
            {data.map((item) => {
              const width =
                totalCount > 0 ? (item.count / totalCount) * 100 : 0;
              return (
                <div
                  key={item.gender}
                  className={`h-full bg-gradient-to-r ${getGenderColor(
                    item.gender
                  )} transition-all duration-1000 ease-out flex items-center justify-center text-white text-xs font-medium`}
                  style={{ width: `${width}%` }}
                  title={`${item.gender}: ${item.percentage.toFixed(1)}%`}
                >
                  {width > 15 && item.percentage.toFixed(0) + "%"}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="space-y-3 flex-1">
        {data.map((item) => (
          <div
            key={item.gender}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between group bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-2 sm:mb-0">
              <div
                className={`w-8 h-8 bg-gradient-to-r ${getGenderColor(
                  item.gender
                )} rounded-lg flex items-center justify-center text-white flex-shrink-0`}
              >
                {getGenderIcon(item.gender)}
              </div>
              <span className="text-white font-medium text-sm sm:text-base truncate">
                {item.gender}
              </span>
            </div>
            <div className="flex justify-between sm:block sm:text-right ml-11 sm:ml-0">
              <div className="text-white font-bold text-sm sm:text-base">
                {item.count.toLocaleString()}
              </div>
              <div className="text-gray-400 text-sm">
                {item.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-white text-base sm:text-lg font-bold">
            {totalCount.toLocaleString()}
          </div>
          <div className="text-gray-400 text-xs sm:text-sm">
            Total Responses
          </div>
        </div>
        <div className="text-center">
          <div className="text-green-400 text-base sm:text-lg font-bold">
            {data.length > 0 ? data.length : 0}
          </div>
          <div className="text-gray-400 text-xs sm:text-sm">Categories</div>
        </div>
      </div>

      {/* Diversity Note */}
      <div className="mt-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
        <div className="flex items-center gap-2 text-purple-300 text-xs sm:text-sm">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="leading-tight">
            Building an inclusive Web3 community for everyone
          </span>
        </div>
      </div>
    </div>
  );
}
