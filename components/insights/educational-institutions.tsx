"use client";

import { memo, useMemo } from "react";

interface EducationalInstitutionsProps {
  data: Array<{
    institution: string;
    count: number;
    percentage: number;
  }>;
  loading?: boolean;
}

const INSTITUTION_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#EC4899", // Pink
  "#84CC16", // Lime
  "#6B7280", // Gray
];

export const EducationalInstitutions = memo(function EducationalInstitutions({
  data,
  loading = false,
}: EducationalInstitutionsProps) {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: INSTITUTION_COLORS[index % INSTITUTION_COLORS.length],
    }));
  }, [data]);

  const totalCount = useMemo(() => {
    return data.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  const topInstitution = useMemo(() => {
    return data.length > 0 ? data[0] : null;
  }, [data]);

  const stats = useMemo(() => {
    const totalInstitutions = data.length;
    const studentsFromTopUniversities = data
      .slice(0, 5)
      .reduce((sum, inst) => sum + inst.count, 0);
    const diversityScore = Math.min(
      100,
      totalCount > 0 ? (totalInstitutions / totalCount) * 100 : 0
    );

    return {
      totalInstitutions,
      studentsFromTopUniversities,
      diversityScore: Math.round(diversityScore),
    };
  }, [data, totalCount]);

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
    <div className="bg-gradient-to-br from-emerald-900/70 via-slate-900/80 to-teal-950/90 backdrop-blur-xl border border-emerald-700/30 rounded-2xl p-8 hover:from-emerald-900/80 hover:via-slate-900/90 hover:to-teal-950/95 hover:border-emerald-600/40 transition-all duration-500 ease-out min-h-[600px] flex flex-col shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-100 mb-3 tracking-tight leading-tight">
            Educational Institutions
          </h3>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            Universities and schools represented
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-emerald-400 tabular-nums">
            {data.length}
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            Institutions
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center flex-grow text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">🎓</div>
            <div>No educational institution data available</div>
          </div>
        </div>
      ) : (
        <div className="flex-grow flex flex-col justify-between space-y-6">
          {/* Institution Rankings */}
          <div className="space-y-3 mb-6">
            <h4 className="text-lg font-medium text-white mb-4">
              Top Institutions
            </h4>
            {chartData.slice(0, 8).map((institution, index) => (
              <div key={institution.institution} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 bg-gray-700 rounded-full text-xs text-white font-bold">
                      {index + 1}
                    </div>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: institution.color }}
                    />
                    <span
                      className="text-white font-medium truncate max-w-[200px]"
                      title={institution.institution}
                    >
                      {institution.institution}
                    </span>
                  </div>
                  <div className="text-gray-300 flex-shrink-0">
                    {institution.count} ({institution.percentage}%)
                  </div>
                </div>
                <div className="w-full bg-gray-800/50 rounded-full h-1.5 ml-9">
                  <div
                    className="h-1.5 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      backgroundColor: institution.color,
                      width: `${institution.percentage}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Key Insights */}
          <div className="space-y-3">
            {topInstitution && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-purple-400 font-medium">
                      Top Institution
                    </div>
                    <div className="text-white text-lg font-semibold">
                      {topInstitution.institution}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-purple-400 text-2xl font-bold">
                      {topInstitution.percentage}%
                    </div>
                    <div className="text-gray-300 text-sm">
                      {topInstitution.count} students
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Partnership Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                <div className="text-blue-400 text-xl font-bold">
                  {stats.totalInstitutions}
                </div>
                <div className="text-gray-300 text-xs">Total Institutions</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <div className="text-green-400 text-xl font-bold">
                  {stats.studentsFromTopUniversities}
                </div>
                <div className="text-gray-300 text-xs">Top 5 Universities</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                <div className="text-amber-400 text-xl font-bold">
                  {stats.diversityScore}%
                </div>
                <div className="text-gray-300 text-xs">Diversity Score</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
