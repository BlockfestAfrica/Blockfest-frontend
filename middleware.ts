import { NextRequest, NextResponse } from "next/server";

// Simple session validation for middleware
function validateSessionToken(token: string): boolean {
  // Basic format validation - in production use proper session storage
  return /^[a-f0-9]{64}$/.test(token);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Allow auth endpoint and login page to pass through
  if (pathname === "/api/insights/auth" || pathname === "/insights/login") {
    return NextResponse.next();
  }

  // Protect insights pages and APIs (except login)
  if (
    pathname.startsWith("/insights") ||
    pathname.startsWith("/api/insights")
  ) {
    const sessionToken = request.cookies.get("insights_session")?.value;

    if (!sessionToken || !validateSessionToken(sessionToken)) {
      if (pathname.startsWith("/api/insights")) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        );
      }
      const url = new URL("/insights/login", request.url);
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/insights/:path*", "/api/insights/:path*"],
};
