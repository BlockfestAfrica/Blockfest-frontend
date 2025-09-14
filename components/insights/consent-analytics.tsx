"use client";

import { memo, useMemo } from "react";

interface ConsentAnalyticsProps {
  data: {
    totalResponses: number;
    photoConsent: {
      yes: number;
      no: number;
      percentage: number;
    };
    emailConsent: {
      yes: number;
      no: number;
      percentage: number;
    };
    socialEngagement: {
      xFollowed: number;
      telegramJoined: number;
      xPercentage: number;
      telegramPercentage: number;
    };
    complianceScore: number;
  };
  loading?: boolean;
}

export const ConsentAnalytics = memo(function ConsentAnalytics({
  data,
  loading = false,
}: ConsentAnalyticsProps) {
  const insights = useMemo(() => {
    const gdprCompliance = Math.round(
      (data.emailConsent.percentage + data.photoConsent.percentage) / 2
    );
    const engagementRate = Math.round(
      (data.socialEngagement.xPercentage +
        data.socialEngagement.telegramPercentage) /
        2
    );
    const overallCompliance = Math.round((gdprCompliance + engagementRate) / 2);

    return {
      gdprCompliance,
      engagementRate,
      overallCompliance,
      bestPerforming:
        data.photoConsent.percentage > data.emailConsent.percentage
          ? "Photo Consent"
          : "Email Consent",
      socialWinner:
        data.socialEngagement.xPercentage >
        data.socialEngagement.telegramPercentage
          ? "X (Twitter)"
          : "Telegram",
    };
  }, [data]);

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
    <div className="bg-gradient-to-br from-violet-900/70 via-slate-900/80 to-rose-950/90 backdrop-blur-xl border border-violet-700/30 rounded-2xl p-8 hover:from-violet-900/80 hover:via-slate-900/90 hover:to-rose-950/95 hover:border-violet-600/40 transition-all duration-500 ease-out min-h-[750px] flex flex-col shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-100 mb-3 tracking-tight leading-tight">
            Consent & Engagement Analytics
          </h3>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            GDPR compliance and community engagement rates
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-violet-400 tabular-nums">
            {data.totalResponses}
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            Total Responses
          </div>
        </div>
      </div>

      {data.totalResponses === 0 ? (
        <div className="flex items-center justify-center flex-grow text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📋</div>
            <div>No consent data available</div>
          </div>
        </div>
      ) : (
        <div className="flex-grow flex flex-col justify-between space-y-6">
          {/* Consent Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Photo Consent */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="text-blue-400 text-lg">📸</div>
                  <div className="text-blue-300 font-medium">Photo Consent</div>
                </div>
                <div className="text-blue-400 text-xl font-bold">
                  {data.photoConsent.percentage}%
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Consented</span>
                  <span className="text-green-400">
                    {data.photoConsent.yes}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Declined</span>
                  <span className="text-red-400">{data.photoConsent.no}</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${data.photoConsent.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Email Consent */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="text-green-400 text-lg">📧</div>
                  <div className="text-green-300 font-medium">
                    Email Updates
                  </div>
                </div>
                <div className="text-green-400 text-xl font-bold">
                  {data.emailConsent.percentage}%
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Subscribed</span>
                  <span className="text-green-400">
                    {data.emailConsent.yes}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Declined</span>
                  <span className="text-red-400">{data.emailConsent.no}</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${data.emailConsent.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Social Media Engagement */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-4">
              Social Media Engagement
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* X (Twitter) Follow */}
              <div className="bg-gray-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-blue-400 text-lg">🐦</div>
                    <div className="text-white font-medium">X Follow</div>
                  </div>
                  <div className="text-blue-400 text-lg font-bold">
                    {data.socialEngagement.xPercentage}%
                  </div>
                </div>
                <div className="text-gray-300 text-sm mb-2">
                  {data.socialEngagement.xFollowed} of {data.totalResponses}{" "}
                  followed
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${data.socialEngagement.xPercentage}%` }}
                  />
                </div>
              </div>

              {/* Telegram Join */}
              <div className="bg-gray-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-cyan-400 text-lg">💬</div>
                    <div className="text-white font-medium">Telegram Join</div>
                  </div>
                  <div className="text-cyan-400 text-lg font-bold">
                    {data.socialEngagement.telegramPercentage}%
                  </div>
                </div>
                <div className="text-gray-300 text-sm mb-2">
                  {data.socialEngagement.telegramJoined} of{" "}
                  {data.totalResponses} joined
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    className="bg-cyan-500 h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${data.socialEngagement.telegramPercentage}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Insights & Recommendations */}
          <div className="space-y-4">
            {/* Key Insights */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <h5 className="text-purple-300 font-medium mb-3">Key Insights</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Best Consent Rate:</span>
                  <span className="text-purple-400 font-medium">
                    {insights.bestPerforming}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Top Social Platform:</span>
                  <span className="text-purple-400 font-medium">
                    {insights.socialWinner}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">GDPR Compliance:</span>
                  <span
                    className={`font-medium ${
                      insights.gdprCompliance > 80
                        ? "text-green-400"
                        : insights.gdprCompliance > 60
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {insights.gdprCompliance}%
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Insights */}
            {(data.photoConsent.percentage < 90 ||
              data.emailConsent.percentage < 80 ||
              data.socialEngagement.xPercentage < 70 ||
              data.socialEngagement.telegramPercentage < 70) && (
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4">
                <h5 className="text-amber-300 font-medium mb-3">
                  Performance Insights
                </h5>
                <div className="text-gray-300 text-sm space-y-2">
                  {data.photoConsent.percentage < 90 && (
                    <div>
                      • Photo consent rate: {data.photoConsent.percentage}%
                    </div>
                  )}
                  {data.emailConsent.percentage < 80 && (
                    <div>
                      • Email consent rate: {data.emailConsent.percentage}%
                    </div>
                  )}
                  {data.socialEngagement.xPercentage < 70 && (
                    <div>
                      • X engagement rate: {data.socialEngagement.xPercentage}%
                    </div>
                  )}
                  {data.socialEngagement.telegramPercentage < 70 && (
                    <div>
                      • Telegram engagement rate:{" "}
                      {data.socialEngagement.telegramPercentage}%
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compliance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                <div className="text-blue-400 text-lg font-bold">
                  {insights.gdprCompliance}%
                </div>
                <div className="text-gray-300 text-xs">GDPR Compliance</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <div className="text-green-400 text-lg font-bold">
                  {insights.engagementRate}%
                </div>
                <div className="text-gray-300 text-xs">Social Engagement</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
                <div className="text-purple-400 text-lg font-bold">
                  {data.emailConsent.yes}
                </div>
                <div className="text-gray-300 text-xs">
                  Marketing Contacts (Email)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
