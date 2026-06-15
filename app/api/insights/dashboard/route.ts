/**
 * Dashboard API Route
 * Provides analytics data for the insights dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { loadGuestData, calculateDashboardStats } from "@/lib/analytics";
import { validateDashboardRequest } from "@/lib/validators";
import {
  rateLimiter,
  RATE_LIMITS,
  getClientId,
  createRateLimitHeaders,
} from "@/lib/rate-limit";

/** Headers to exclude from analytics tracking */
const PRIVATE_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
};

/**
 * GET /api/insights/dashboard
 * Returns dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const clientId = getClientId(request.headers);
    const rateLimit = rateLimiter.check(
      `dashboard:${clientId}`,
      RATE_LIMITS.dashboard
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Please wait before making more requests",
          retryAfter: Math.ceil(rateLimit.resetIn / 1000),
        },
        {
          status: 429,
          headers: {
            ...PRIVATE_HEADERS,
            ...createRateLimitHeaders(
              rateLimit.remaining,
              rateLimit.resetIn,
              RATE_LIMITS.dashboard.maxRequests
            ),
            "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString(),
          },
        }
      );
    }

    // Load the guest registration data
    const guestData = await loadGuestData();

    // Calculate dashboard statistics
    const stats = calculateDashboardStats(guestData);

    return NextResponse.json(stats, {
      headers: {
        ...PRIVATE_HEADERS,
        ...createRateLimitHeaders(
          rateLimit.remaining,
          rateLimit.resetIn,
          RATE_LIMITS.dashboard.maxRequests
        ),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      {
        error: "Failed to load dashboard data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/insights/dashboard
 * Triggers a data refresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedBody = validateDashboardRequest(body);

    if (!validatedBody) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (validatedBody.action === "refresh") {
      // Trigger data refresh
      const guestData = await loadGuestData();
      const stats = calculateDashboardStats(guestData);

      return NextResponse.json({
        success: true,
        message: "Data refreshed successfully",
        stats,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Dashboard POST API error:", error);

    return NextResponse.json(
      {
        error: "Failed to process request",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
