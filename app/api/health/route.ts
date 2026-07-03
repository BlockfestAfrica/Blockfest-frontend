/**
 * Health Check API Route
 * Provides system health status for monitoring and load balancers
 */

import { NextResponse } from "next/server";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    name: string;
    status: "pass" | "fail" | "warn";
    message?: string;
    responseTime?: number;
  }[];
}

/**
 * GET /api/health
 * Returns health status of the application
 */
export async function GET() {
  const startTime = Date.now();
  const checks: HealthStatus["checks"] = [];

  // Check environment variables
  const envCheck = checkEnvironmentVariables();
  checks.push(envCheck);

  // Check external data source (Google Sheets)
  const dataSourceCheck = await checkDataSource();
  checks.push(dataSourceCheck);

  // Determine overall status
  const hasFailure = checks.some((c) => c.status === "fail");
  const hasWarning = checks.some((c) => c.status === "warn");

  const status: HealthStatus = {
    status: hasFailure ? "unhealthy" : hasWarning ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
    checks,
  };

  const httpStatus = status.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(status, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Response-Time": `${Date.now() - startTime}ms`,
    },
  });
}

/**
 * Check required environment variables
 */
function checkEnvironmentVariables(): HealthStatus["checks"][0] {
  const required = ["GOOGLE_SHEETS_CSV_URL"];
  const optional = ["INSIGHTS_PASSWORD", "NEXT_PUBLIC_UMAMI_WEBSITE_ID"];

  const missingRequired = required.filter((key) => !process.env[key]);
  const missingOptional = optional.filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    return {
      name: "environment",
      status: "fail",
      message: `Missing required env vars: ${missingRequired.join(", ")}`,
    };
  }

  if (missingOptional.length > 0) {
    return {
      name: "environment",
      status: "warn",
      message: `Missing optional env vars: ${missingOptional.join(", ")}`,
    };
  }

  return {
    name: "environment",
    status: "pass",
    message: "All environment variables configured",
  };
}

/**
 * Check data source connectivity
 */
async function checkDataSource(): Promise<HealthStatus["checks"][0]> {
  const startTime = Date.now();

  if (!process.env.GOOGLE_SHEETS_CSV_URL) {
    return {
      name: "data_source",
      status: "warn",
      message: "Data source URL not configured",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(process.env.GOOGLE_SHEETS_CSV_URL, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        name: "data_source",
        status: "pass",
        message: "Data source accessible",
        responseTime,
      };
    }

    return {
      name: "data_source",
      status: "warn",
      message: `Data source returned ${response.status}`,
      responseTime,
    };
  } catch (error) {
    return {
      name: "data_source",
      status: "fail",
      message:
        error instanceof Error ? error.message : "Failed to reach data source",
      responseTime: Date.now() - startTime,
    };
  }
}
