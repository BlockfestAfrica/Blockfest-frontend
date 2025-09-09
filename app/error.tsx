"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { umamiTrack, sanitizeStack } from "@/lib/analytics";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);

    // Log to Umami analytics (production-only, guarded)
    try {
      if (process.env.NODE_ENV === "production") {
        umamiTrack("error", {
          errorMessage: error.message?.slice(0, 500),
          errorType: "global",
          fatal: true,
          digest: error.digest,
          stack: sanitizeStack(error.stack),
        });
      }
    } catch (analyticsErr) {
      // Never let analytics throw inside an error handler
      console.warn("umamiTrack failed:", analyticsErr);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-[#1A3461] to-[#005DFF]">
      <div className="max-w-md w-full text-center text-white">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-[#F2CB45] mb-4">500</h1>
          <h2 className="text-2xl font-semibold mb-4">Server Error</h2>
          <p className="text-gray-200 mb-6">
            We&apos;re experiencing technical difficulties. Our team has been
            notified and is working to resolve this issue.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={reset}
            className="w-full bg-[#F2CB45] hover:bg-[#F2CB45]/90 text-black font-semibold"
          >
            Try Again
          </Button>

          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
            className="w-full border-white text-white hover:bg-white hover:text-[#1B64E4]"
          >
            Go Home
          </Button>
        </div>

        <div className="mt-8 text-sm text-gray-300">
          <p>
            Error ID:{" "}
            {error.digest && (
              <code className="bg-gray-800 px-2 py-1 rounded text-xs">
                {error.digest}
              </code>
            )}
          </p>
          <p className="mt-2">
            Need help?{" "}
            <a
              href="mailto:support@blockfestafrica.com"
              className="text-[#F2CB45] hover:underline"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
