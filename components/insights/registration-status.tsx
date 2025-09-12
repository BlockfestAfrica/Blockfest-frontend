interface RegistrationStatusProps {
  confirmed: number;
  pending: number;
  cancelled: number;
  total: number;
  loading?: boolean;
}

export function RegistrationStatus({
  confirmed,
  pending,
  cancelled,
  total,
  loading,
}: RegistrationStatusProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-green-950/90 via-slate-900/95 to-emerald-950/90 backdrop-blur-sm border border-green-300/20 rounded-xl p-8 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-tr from-green-600/5 via-transparent to-emerald-400/5 pointer-events-none" />
        <div className="relative z-10 space-y-6">
          <div className="h-7 bg-green-200/20 rounded-lg w-1/3"></div>
          <div className="h-40 bg-green-200/10 rounded-xl border border-green-300/10"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-5 bg-green-200/15 rounded-md w-24"></div>
                <div className="h-5 bg-green-200/15 rounded-md w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const confirmedPercentage = total > 0 ? (confirmed / total) * 100 : 0;
  const pendingPercentage = total > 0 ? (pending / total) * 100 : 0;
  const cancelledPercentage = total > 0 ? (cancelled / total) * 100 : 0;

  const statusData = [
    {
      label: "Confirmed",
      count: confirmed,
      percentage: confirmedPercentage,
      color: "from-green-400 to-green-300",
      bgColor: "bg-green-400/20",
      textColor: "text-green-400",
    },
    {
      label: "Pending",
      count: pending,
      percentage: pendingPercentage,
      color: "from-yellow-400 to-yellow-300",
      bgColor: "bg-yellow-400/20",
      textColor: "text-yellow-400",
    },
    {
      label: "Cancelled",
      count: cancelled,
      percentage: cancelledPercentage,
      color: "from-red-400 to-red-300",
      bgColor: "bg-red-400/20",
      textColor: "text-red-400",
    },
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-green-950/90 via-slate-900/95 to-emerald-950/90 backdrop-blur-sm border border-green-300/20 rounded-xl p-8 h-full flex flex-col transition-all duration-300 hover:border-green-300/30 hover:shadow-xl hover:shadow-green-500/10">
      {/* Enhanced background overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-green-600/5 via-transparent to-emerald-400/5 pointer-events-none" />

      <div className="relative z-10 mb-6">
        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
          Registration Status
        </h3>
        <p className="text-green-100/70 text-sm leading-relaxed">
          Current breakdown of all registrations
        </p>
      </div>

      {/* Donut Chart */}
      <div className="flex items-center justify-center mb-8 flex-1">
        <div className="relative">
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            className="transform -rotate-90"
          >
            <circle
              cx="100"
              cy="100"
              r="80"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="20"
              fill="none"
            />

            {/* Confirmed Arc */}
            <circle
              cx="100"
              cy="100"
              r="80"
              stroke="url(#confirmedGradient)"
              strokeWidth="20"
              fill="none"
              strokeDasharray={`${(confirmedPercentage / 100) * 502.4} 502.4`}
              strokeDashoffset="0"
              className="transition-all duration-1000 ease-out"
              style={{ animationDelay: "0ms" }}
            />

            {/* Pending Arc */}
            <circle
              cx="100"
              cy="100"
              r="80"
              stroke="url(#pendingGradient)"
              strokeWidth="20"
              fill="none"
              strokeDasharray={`${(pendingPercentage / 100) * 502.4} 502.4`}
              strokeDashoffset={`-${(confirmedPercentage / 100) * 502.4}`}
              className="transition-all duration-1000 ease-out"
              style={{ animationDelay: "300ms" }}
            />

            {/* Cancelled Arc */}
            <circle
              cx="100"
              cy="100"
              r="80"
              stroke="url(#cancelledGradient)"
              strokeWidth="20"
              fill="none"
              strokeDasharray={`${(cancelledPercentage / 100) * 502.4} 502.4`}
              strokeDashoffset={`-${
                ((confirmedPercentage + pendingPercentage) / 100) * 502.4
              }`}
              className="transition-all duration-1000 ease-out"
              style={{ animationDelay: "600ms" }}
            />

            <defs>
              <linearGradient
                id="confirmedGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgb(74, 222, 128)" />
                <stop offset="100%" stopColor="rgb(34, 197, 94)" />
              </linearGradient>
              <linearGradient
                id="pendingGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgb(251, 191, 36)" />
                <stop offset="100%" stopColor="rgb(245, 158, 11)" />
              </linearGradient>
              <linearGradient
                id="cancelledGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgb(248, 113, 113)" />
                <stop offset="100%" stopColor="rgb(239, 68, 68)" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-white">
              {total.toLocaleString()}
            </div>
            <div className="text-gray-400 text-sm">Total</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-4">
        {statusData.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full bg-gradient-to-r ${item.color}`}
              />
              <span className="text-white font-medium">{item.label}</span>
            </div>
            <div className="text-right">
              <div className="text-white font-medium">
                {item.count.toLocaleString()}
              </div>
              <div className="text-gray-400 text-sm">
                {item.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-green-400 text-lg font-bold">
            {confirmedPercentage.toFixed(1)}%
          </div>
          <div className="text-gray-400 text-xs">Confirmation Rate</div>
        </div>
        <div className="text-center">
          <div className="text-yellow-400 text-lg font-bold">
            {pendingPercentage.toFixed(1)}%
          </div>
          <div className="text-gray-400 text-xs">Pending Rate</div>
        </div>
      </div>
    </div>
  );
}
