import React from "react";

export function SpeakerCardSkeleton() {
  return (
    <div className="flex flex-col items-center bg-white rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 md:p-6 border border-[#D1D1D1] shadow-sm gap-y-4 sm:gap-y-6 justify-around animate-pulse">
      {/* Image skeleton */}
      <div className="relative shrink-0 w-[140px] h-[140px] xs:w-[160px] xs:h-[160px] sm:w-[180px] sm:h-[180px] md:w-[220px] md:h-[220px] lg:w-[280px] lg:h-[280px] rounded-full bg-gray-200"></div>

      {/* Content skeleton */}
      <div className="flex flex-col items-center gap-y-3 sm:gap-y-4 w-full">
        <div className="flex flex-col gap-y-1 sm:gap-y-2 items-center text-center w-full">
          {/* Name skeleton */}
          <div className="h-5 xs:h-6 sm:h-7 md:h-8 bg-gray-200 rounded-md w-3/4"></div>
          {/* Title skeleton */}
          <div className="h-4 xs:h-4 sm:h-5 md:h-6 bg-gray-200 rounded-md w-5/6"></div>
        </div>

        {/* Social links skeleton */}
        <div className="inline-flex gap-x-3 items-center">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

export function SpeakersGridSkeleton() {
  return (
    <section className="flex flex-col items-center justify-center lg:py-[30px] lg:px-[70px] py-8 px-4 sm:px-6">
      <div className="h-8 sm:h-10 md:h-12 lg:h-20 bg-gray-200 rounded-md w-48 sm:w-56 md:w-64 mb-6 sm:mb-8 lg:mb-16 animate-pulse"></div>

      {/* Search and Filter Skeleton */}
      <div className="w-full max-w-4xl mb-6 sm:mb-8 space-y-3 sm:space-y-4 px-2 sm:px-0">
        {/* Search bar skeleton */}
        <div className="h-10 sm:h-12 bg-gray-200 rounded-lg sm:rounded-xl animate-pulse"></div>

        {/* Filter buttons skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto sm:mx-0 animate-pulse"></div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-7 sm:h-8 bg-gray-200 rounded-full w-16 sm:w-20 animate-pulse"
              ></div>
            ))}
          </div>
        </div>

        {/* Results count skeleton */}
        <div className="h-4 bg-gray-200 rounded w-40 mx-auto animate-pulse"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 w-full max-w-7xl">
        {Array.from({ length: 6 }).map((_, index) => (
          <SpeakerCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
