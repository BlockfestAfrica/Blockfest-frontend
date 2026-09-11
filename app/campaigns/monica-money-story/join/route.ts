import { NextResponse, type NextRequest } from "next/server";
import { monicaRoutes } from "@/lib/campaigns";
import { REFERRAL_COOKIE } from "@/lib/campaign-registration";

/** Long enough to read the rules and think about it, short enough to expire. */
const REFERRAL_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Referral capture.
 *
 * A creator shares /join?ref=THEIRCODE. This records who sent the visitor and
 * forwards them to the form. It exists as its own route, rather than the form
 * reading the query string, for one reason: a visitor rarely registers in the
 * same page view. They arrive from a WhatsApp link, read the rules, look at the
 * prize breakdown, close the tab, and come back the next day from a bookmark
 * with no ref on it. A cookie survives that. A query parameter does not.
 *
 * This had to be live on day one even though referrals pay nothing until the
 * first approved entries are reviewed. Attribution is the one thing in the
 * campaign that cannot be reconstructed afterwards: a week of unattributed
 * signups is a week of creators who recruited people and have nothing to show
 * for it, and no amount of later work recovers who sent whom.
 *
 * The code is not validated against the database here. That is deliberate. This
 * route runs before anyone has registered, it should be fast and impossible to
 * fail, and a code that turns out to belong to nobody is discarded at
 * registration where the real check belongs. Its only job is to not lose the
 * value.
 */
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")?.trim() ?? "";

  const response = NextResponse.redirect(
    new URL(monicaRoutes.register, request.url),
  );

  // Referral codes are short and alphanumeric. Anything else is somebody
  // probing, and it is never echoed back into the page, so it is dropped
  // rather than stored.
  if (ref && /^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
    response.cookies.set(REFERRAL_COOKIE, ref, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: REFERRAL_TTL_SECONDS,
    });
  }

  return response;
}
