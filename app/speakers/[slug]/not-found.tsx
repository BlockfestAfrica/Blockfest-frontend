import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { gotham } from "@/lib/fonts";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-12 h-12 text-blue-500" />
          </div>

          <h1
            className={`${gotham.className} text-4xl font-bold text-gray-900 mb-4`}
          >
            Speaker Not Found
          </h1>

          <p className="text-gray-600 text-lg leading-relaxed mb-8">
            The speaker you&apos;re looking for doesn&apos;t exist or may have
            been moved. Let&apos;s get you back to our amazing lineup of
            speakers.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/speakers"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-300"
          >
            <ArrowLeft className="w-4 h-4" />
            View All Speakers
          </Link>

          <div>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
            >
              Back to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
