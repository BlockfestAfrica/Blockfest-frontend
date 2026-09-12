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

  /*
   * A relative Location, because request.url is not the visitor's URL.
   *
   * On Netlify, request.url carries the deploy's own host, so
   * main--<site>.netlify.app rather than blockfestafrica.com, and
   * new URL(path, request.url) therefore sends people off the domain they
   * typed. The cookie set below is host-only for the domain they were actually
   * on, so it does not travel with them: they land on a different host with no
   * session and are told we do not know who they are, having just clicked the
   * link from their own welcome email.
   *
   * A relative Location is resolved by the browser against the URL it asked
   * for, which is the public domain by definition. It cannot be wrong the way a
   * reconstructed origin can, and it needs no environment variable to be right.
   *
   * One honest caveat. The platform re-appends the original query string to a
   * redirect, so the token can still appear in the address bar on the
   * destination, which the paragraph above wished away. /me ignores query
   * parameters entirely and reads only the cookie, and Referrer-Policy is
   * strict-origin-when-cross-origin, so the value is not sent to another site.
   * It is in browser history either way, since the link in the email contains
   * it.
   */
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: monicaRoutes.me },
  });

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
