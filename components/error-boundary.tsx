"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { umamiTrack, sanitizeStack } from "@/lib/analytics";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset: () => void }>;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);

    // Log to Umami analytics (production-only, guarded)
    try {
      if (process.env.NODE_ENV === "production") {
        umamiTrack("error", {
          errorMessage: error.message?.slice(0, 500),
          errorType: "javascript",
          stack: sanitizeStack(error.stack),
          componentStack: sanitizeStack(errorInfo.componentStack),
        });
      }
    } catch (analyticsErr) {
      // Never let analytics throw inside an error boundary
      console.warn("umamiTrack failed:", analyticsErr);
    }
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error}
          reset={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  reset,
}: {
  error?: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-[#1B64E4] mb-4">Oops!</h1>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-6">
            We encountered an unexpected error. Our team has been notified and
            is working on a fix.
          </p>
          {error && process.env.NODE_ENV === "development" && (
            <details className="mb-6 p-4 bg-gray-100 rounded-lg text-left">
              <summary className="cursor-pointer font-medium text-red-600">
                Error Details (Development)
              </summary>
              <pre className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </div>

        <div className="space-y-4">
          <Button
            onClick={reset}
            className="w-full bg-[#1B64E4] hover:bg-[#4F85EB] text-white"
          >
            Try Again
          </Button>

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full"
          >
            Refresh Page
          </Button>

          <Button
            onClick={() => (window.location.href = "/")}
            variant="ghost"
            className="w-full text-[#1B64E4]"
          >
            Go Home
          </Button>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>
            Need help?{" "}
            <a
              href="mailto:support@blockfestafrica.com"
              className="text-[#1B64E4] hover:underline"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
