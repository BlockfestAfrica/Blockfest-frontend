export function DashboardSkeleton() {
  const SkeletonCard = ({ className }: { className?: string }) => (
    <div
      className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse ${className}`}
    >
      <div className="space-y-4">
        <div className="h-4 bg-white/10 rounded w-3/4"></div>
        <div className="h-8 bg-white/10 rounded w-1/2"></div>
        <div className="space-y-2">
          <div className="h-3 bg-white/10 rounded w-full"></div>
          <div className="h-3 bg-white/10 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  );

  const ChartSkeleton = ({ className }: { className?: string }) => (
    <div
      className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse ${className}`}
    >
      <div className="space-y-4">
        <div className="h-6 bg-white/10 rounded w-1/3"></div>
        <div className="h-64 bg-white/10 rounded-lg"></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 bg-white/10 rounded w-64 mb-2"></div>
          <div className="h-4 bg-white/10 rounded w-96"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 bg-white/10 rounded-lg w-24"></div>
          <div className="h-10 bg-white/10 rounded-lg w-28"></div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Bottom Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div>
          <SkeletonCard className="h-80" />
        </div>
      </div>
    </div>
  );
}
