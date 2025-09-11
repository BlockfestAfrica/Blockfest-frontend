"use client";

import { memo } from "react";
import { FaBus, FaMapMarkerAlt, FaRoute } from "react-icons/fa";

export interface TransportationData {
  totalTransportationRequests: number;
  transportationPercentage: number;
  topLocations: Array<{
    location: string;
    count: number;
    percentage: number;
  }>;
  transportationBreakdown: Array<{
    zone: string;
    count: number;
    percentage: number;
  }>;
}

interface TransportationInsightsProps {
  data: TransportationData;
  loading?: boolean;
  maxLocations?: number;
}

export const TransportationInsights = memo(function TransportationInsights({
  data,
  loading = false,
  maxLocations = 8,
}: TransportationInsightsProps) {
  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 h-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-orange-500/20 rounded-xl">
            <FaBus className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Transportation Analytics
            </h3>
            <p className="text-gray-400 text-sm">
              Loading transportation data...
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Loading skeletons */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded mb-2"></div>
              <div className="h-8 bg-white/10 rounded"></div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded mb-2"></div>
              <div className="h-8 bg-white/10 rounded"></div>
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/5 rounded-lg p-3 animate-pulse">
                <div className="h-4 bg-white/10 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasData = data.totalTransportationRequests > 0;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-orange-500/20 rounded-xl">
          <FaBus className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">
            Transportation Analytics
          </h3>
          <p className="text-gray-400 text-sm">
            Where attendees are coming from within Lagos
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-8">
          <FaRoute className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No transportation requests yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Data will appear as attendees register
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaBus className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-400">Total Requests</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {data.totalTransportationRequests}
              </div>
              <div className="text-sm text-orange-400 mt-1">
                {data.transportationPercentage.toFixed(1)}% of attendees
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaMapMarkerAlt className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Locations</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {data.topLocations.length}
              </div>
              <div className="text-sm text-blue-400 mt-1">Pickup points</div>
            </div>
          </div>

          {/* Top Locations */}
          {data.topLocations.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FaMapMarkerAlt className="w-4 h-4 text-blue-400" />
                Top Pickup Locations
              </h4>
              <div className="space-y-3">
                {data.topLocations
                  .slice(0, maxLocations)
                  .map((location, index) => (
                    <div
                      key={location.location}
                      className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500/20 to-orange-500/20 rounded-lg flex items-center justify-center text-sm font-semibold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {location.location || "Not specified"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {location.count} attendee
                            {location.count !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-orange-400">
                          {location.percentage.toFixed(1)}%
                        </div>
                        <div className="w-12 bg-white/10 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                            style={{
                              width: `${Math.min(location.percentage, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm">
                Detailed locations are anonymized for privacy protection
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Only aggregated zone data is shown
              </p>
            </div>
          )}

          {/* Transportation Zones Summary */}
          {data.transportationBreakdown.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FaRoute className="w-4 h-4 text-green-400" />
                Transportation Zones
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.transportationBreakdown.map((zone) => (
                  <div
                    key={zone.zone}
                    className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">
                        {zone.zone}
                      </span>
                      <span className="text-sm text-green-400 font-semibold">
                        {zone.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-400">
                        {zone.count} requests
                      </div>
                      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-400"
                          style={{
                            width: `${Math.min(zone.percentage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-4 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <p className="text-xs text-orange-200 flex items-center gap-2">
              <FaBus className="w-3 h-3" />
              Transportation service is provided within Lagos to help attendees
              reach the venue
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

TransportationInsights.displayName = "TransportationInsights";
