interface EducationInsightsProps {
  data: {
    studentCount: number;
    professionalCount: number;
    studentPercentage: number;
    professionalPercentage: number;
    topSchools: Array<{ school: string; count: number }>;
  };
  loading?: boolean;
}

export function EducationInsights({ data, loading }: EducationInsightsProps) {
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
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-white/10 rounded-lg"></div>
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-white/10 rounded w-32"></div>
                <div className="h-4 bg-white/10 rounded w-8"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalCount = data.studentCount + data.professionalCount;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Education & Professional Background
        </h3>
        <p className="text-gray-300 text-sm">
          Student vs professional breakdown and top educational institutions
        </p>
      </div>

      {/* Student vs Professional Split */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Students */}
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 sm:w-5 h-4 sm:h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm sm:text-base">
                Students
              </h4>
              <p className="text-blue-300 text-xs sm:text-sm">
                Learning & Building
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-white text-xl sm:text-2xl font-bold">
              {data.studentCount.toLocaleString()}
            </div>
            <div className="text-blue-300 text-xs sm:text-sm">
              {data.studentPercentage.toFixed(1)}% of attendees
            </div>
            <div className="w-full bg-blue-900/30 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${data.studentPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Professionals */}
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-green-500 to-green-400 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 sm:w-5 h-4 sm:h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm sm:text-base">
                Professionals
              </h4>
              <p className="text-green-300 text-xs sm:text-sm">
                Industry Experts
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-white text-xl sm:text-2xl font-bold">
              {data.professionalCount.toLocaleString()}
            </div>
            <div className="text-green-300 text-xs sm:text-sm">
              {data.professionalPercentage.toFixed(1)}% of attendees
            </div>
            <div className="w-full bg-green-900/30 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${data.professionalPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Educational Institutions */}
      <div className="mb-6 flex-1">
        <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
          </svg>
          Top Educational Institutions
        </h4>

        <div className="space-y-3">
          {data.topSchools.slice(0, 8).map((school, index) => {
            const maxCount = data.topSchools[0]?.count || 1;
            const percentage = (school.count / maxCount) * 100;

            return (
              <div
                key={school.school}
                className="flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-white/5 rounded-lg p-3 transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-2 sm:mb-0 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm leading-tight truncate">
                      {school.school}
                    </div>
                    <div className="w-full bg-gray-700/30 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="text-white font-bold text-sm self-end sm:self-center sm:ml-4">
                  {school.count}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <div className="text-white text-base sm:text-lg font-bold">
            {totalCount.toLocaleString()}
          </div>
          <div className="text-gray-400 text-xs sm:text-sm">
            Total Responses
          </div>
        </div>
        <div className="text-center">
          <div className="text-blue-400 text-base sm:text-lg font-bold">
            {data.topSchools.length}
          </div>
          <div className="text-gray-400 text-xs sm:text-sm">
            Schools Represented
          </div>
        </div>
        <div className="text-center">
          <div className="text-purple-400 text-base sm:text-lg font-bold">
            {data.topSchools[0]?.count || 0}
          </div>
          <div className="text-gray-400 text-xs sm:text-sm">
            Top School Count
          </div>
        </div>
      </div>

      {/* Education Note */}
      <div className="mt-4 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
        <div className="flex items-center gap-2 text-blue-300 text-xs sm:text-sm">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
          </svg>
          <span className="leading-tight">
            Bridging academia and industry in the Web3 space
          </span>
        </div>
      </div>
    </div>
  );
}
