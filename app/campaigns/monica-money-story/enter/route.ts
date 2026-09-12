import { NextResponse, type NextRequest } from "next/server";
import {
  CREATOR_SESSION_COOKIE,
  CREATOR_SESSION_MAX_AGE,
  looksLikeAccessToken,
} from "@/lib/creator-access";
import { monicaRoutes } from "@/lib/campaigns";

export const runtime = "nodejs";

/**
 * The way in, using the link a creator was given at registration.
 *
 * Its only job is to move the token out of the URL and into an httpOnly cookie,
 * then send the creator on to their dashboard. It exists as a separate route
 * for the same reason /join does: a value arriving in a query string should not
 * stay in one.
 *
 * A token in a URL is a bearer credential sitting in browser history, in server
 * access logs, and in the Referer header of the next outbound link clicked. The
 * redirect happens before any page renders, so there is no page for a creator
 * to click away from while the token is still in the address bar.
 *
 * Nothing is checked against the database here. The shape is validated so a
 * malformed value never becomes a query, and whether the token belongs to
 * anybody is the dashboard's question. Answering it here would turn this route
 * into an oracle for testing tokens, and would do it before any rate limit.
 */
export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";

  const response = NextResponse.redirect(
    new URL(monicaRoutes.me, request.url),
  );

  if (looksLikeAccessToken(token)) {
    response.cookies.set(CREATOR_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CREATOR_SESSION_MAX_AGE,
    });
  }

  return response;
}
