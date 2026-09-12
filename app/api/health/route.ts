/**
 * Health Check API Route
 * Provides system health status for monitoring and load balancers
 */

import { databaseFingerprint } from "@/lib/db/client";
import { NextResponse } from "next/server";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  /** production, deploy-preview, branch-deploy, or dev. Set by Netlify. */
  context: string;
  /**
   * A short hash of the database host, never the host and never the
   * credential.
   *
   * Netlify DB gives every deploy preview its own branch, so a preview cannot
   * write to live campaign data. That is the platform's behaviour rather than
   * anything this repository arranges, and the only honest way to know it is
   * still true is to compare this value on a preview against production. Same
   * value, same database.
   */
  database: string | null;
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

  // Both previous checks — required env vars and reachability of the guest
  // spreadsheet — existed for the /insights dashboard and went with it. The
  // campaign platform will reintroduce an environment check naming its own
  // required variables; until then this endpoint reports liveness only.

  // Determine overall status
  const hasFailure = checks.some((c) => c.status === "fail");
  const hasWarning = checks.some((c) => c.status === "warn");

  const status: HealthStatus = {
    status: hasFailure ? "unhealthy" : hasWarning ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
    context: process.env.CONTEXT ?? "unknown",
    database: databaseFingerprint(),
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
