import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InsightsDashboard } from "@/components/insights/dashboard";
import { DashboardSkeleton } from "@/components/insights/skeleton";
import { PasswordProtected } from "@/components/password-protected";

export const metadata: Metadata = {
  title: "Event Insights | Blockfest Africa",
  description:
    "Real-time event analytics and guest insights for Blockfest Africa 2025",
  robots: "noindex, nofollow, noarchive, nosnippet", // Keep completely private
};

export default function InsightsPage() {
  return (
    <PasswordProtected>
      <div
        className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden"
        data-umami-ignore="true"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#F2CB45] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-ping"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-bounce"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 backdrop-blur-sm bg-black/20 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link href="/" aria-label="Home">
                  <div className="w-12 h-12 bg-gradient-to-r from-[#F2CB45] to-yellow-300 rounded-xl flex items-center justify-center hover:scale-105 transition-transform duration-200">
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      className="w-6 h-6 text-black"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                </Link>
                <div>
                  <Link
                    href="/"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <h1 className="text-3xl lg:text-4xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      Event Insights
                    </h1>
                    <p className="mt-1 text-lg text-gray-300 font-medium">
                      Blockfest Africa 2025 • Real-time Analytics
                    </p>
                  </Link>
                </div>
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-6">
                {/* Data Update Status */}
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                  <span className="text-sm font-medium text-white">
                    Updates Every 6hrs
                  </span>
                  {process.env.NODE_ENV === "development" && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full border border-yellow-500/30">
                      Dev
                    </span>
                  )}
                </div>

                {/* Back to Site */}
                <Link
                  href="/"
                  className="flex items-center gap-2 bg-[#F2CB45] hover:bg-yellow-400 text-black px-4 py-2 rounded-full font-medium transition-all duration-300 transform hover:scale-105"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                  </svg>
                  <span className="text-sm">Back to Site</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
          <Suspense fallback={<DashboardSkeleton />}>
            <InsightsDashboard />
          </Suspense>
        </div>

        {/* Disable Umami tracking for this page */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                // Disable Umami tracking for this page
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('umami.disabled', 'true');
                }
                // Also disable via window object if available
                if (window.umami) {
                  window.umami.disabled = true;
                }
              }
            `,
          }}
        />
      </div>
    </PasswordProtected>
  );
}
