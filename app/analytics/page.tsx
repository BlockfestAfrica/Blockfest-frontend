import { Metadata } from "next";
import Link from "next/link";
import {
  FaInstagram,
  FaLinkedin,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";

export const metadata: Metadata = {
  title: "Analytics Dashboard | Blockfest Africa",
  description: "Real-time website analytics for Blockfest Africa",
  robots: "noindex, nofollow",
};

interface AnalyticsData {
  shareUrl: string;
}

async function getAnalyticsData(): Promise<AnalyticsData> {
  const shareUrl = process.env.NEXT_PUBLIC_UMAMI_SHARE_URL;

  if (!shareUrl) {
    throw new Error("NEXT_PUBLIC_UMAMI_SHARE_URL is not configured");
  }

  return {
    shareUrl,
  };
}
export default async function AnalyticsPage() {
  try {
    const data = await getAnalyticsData();

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#F2CB45] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-ping"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-bounce"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 backdrop-blur-sm bg-black/20 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link href="/" className="cursor-pointer">
                  <div className="w-12 h-12 bg-gradient-to-r from-[#F2CB45] to-yellow-300 rounded-xl flex items-center justify-center hover:scale-105 transition-transform duration-200">
                    <svg
                      className="w-6 h-6 text-black"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm5-18v4h3V3h-3z" />
                    </svg>
                  </div>
                </Link>
                <div>
                  <Link
                    href="/"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <h1 className="text-3xl lg:text-4xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      Analytics Dashboard
                    </h1>
                    <p className="mt-1 text-lg text-gray-300 font-medium">
                      Blockfest Africa • Real-time Insights
                    </p>
                  </Link>
                </div>
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-6">
                {/* Live Status */}
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                  <span className="text-sm font-medium text-white">
                    Live Data
                  </span>
                  {process.env.NODE_ENV === "development" && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full border border-yellow-500/30">
                      Dev
                    </span>
                  )}
                </div>

                {/* Social Links */}
                <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
                  <Link
                    href="https://x.com/blockfestafrica"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-[#1DA1F2] transition-all duration-300 transform hover:scale-110"
                  >
                    <FaXTwitter size={18} />
                  </Link>
                  <Link
                    href="https://www.instagram.com/blockfestafrica"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-[#E4405F] transition-all duration-300 transform hover:scale-110"
                  >
                    <FaInstagram size={18} />
                  </Link>
                  <Link
                    href="https://youtube.com/@blockfestafrica"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-[#FF0000] transition-all duration-300 transform hover:scale-110"
                  >
                    <FaYoutube size={18} />
                  </Link>
                  <Link
                    href="https://www.linkedin.com/company/blockfest-africa"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-[#0A66C2] transition-all duration-300 transform hover:scale-110"
                  >
                    <FaLinkedin size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Dashboard Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-black/20 to-black/10 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-[#F2CB45] to-yellow-300 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-black"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Live Analytics
                  </h2>
                </div>

                <div className="text-sm text-gray-300 font-medium">
                  Powered by Umami Analytics
                </div>
              </div>
            </div>

            {/* Iframe Container */}
            <div className="relative">
              <iframe
                src={data.shareUrl}
                className="w-full h-[calc(100vh-180px)] border-0 bg-white rounded-b-2xl relative z-10"
                title="Blockfest Africa Analytics Dashboard"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    );
  } catch {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Analytics Unavailable
          </h1>
          <p className="text-gray-600 mb-4">
            Unable to load analytics dashboard.
          </p>
          <p className="text-sm text-gray-500">
            Please check your configuration.
          </p>
        </div>
      </div>
    );
  }
}
