import { NextResponse, type NextRequest } from "next/server";
import {
  CREATOR_PENDING_COOKIE,
  CREATOR_SESSION_COOKIE,
} from "@/lib/creator-access";
import {
  creatorByToken,
  pendingCookieOptions,
  sessionCookieOptions,
  soleCookie,
} from "@/lib/creator-session";
import { monicaRoutes } from "@/lib/campaigns";
import { allow } from "@/lib/throttle";
import { logWarning } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The way in, using the link a creator was given at registration.
 *
 * What this route used to do was set a ninety day session cookie for any string
 * of 43 URL safe characters, without asking the database whether the token
 * belonged to anybody. That made a link a login. Anyone could post their own
 * link into the campaign group chat captioned "open your dashboard here", and
 * every creator who tapped it would silently be carrying the sender's session:
 * they would land on a page that looked right, paste the link to the post they
 * had just published, and file their week's work into somebody else's account.
 * Nothing in the flow asked a question, so nothing gave them the chance to
 * notice.
 *
 * Two things are different now.
 *
 * The token is resolved before it is trusted. The old code declined to do this
 * deliberately, reasoning that answering "is this token real" turns the route
 * into an oracle for testing tokens. That reasoning does not survive the
 * arithmetic. A token is 32 bytes from randomBytes, so there is no search to
 * accelerate and nothing an oracle would buy, while the cost of not asking was
 * the hole above. Resolving it is strictly safer than not.
 *
 * And clicking a link no longer signs anybody in. A valid token is parked in a
 * short lived, path scoped, httpOnly cookie and the creator is sent to a page
 * that names the account before anything is committed. Establishing a session
 * is a POST that a person makes on purpose, which is what stops a link, a
 * forward, or a mail client's link prefetcher from doing it on their behalf.
 *
 * The one exception is the creator who already holds this exact session and has
 * clicked their own link again. There is no question to ask them, so they are
 * sent straight through. That is the common case on a second device and on
 * every re-read of the welcome email, and putting a confirmation in front of it
 * would be friction that protects nobody.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";

  /*
   * The throttle the old comment here wanted and could not point at.
   *
   * It declined to resolve the token, reasoning that doing so would make this
   * an oracle "before any rate limit". There was no rate limit anywhere:
   * throttleKey existed with nothing behind it. There is one now. It does not
   * change the arithmetic, since a token is 32 random bytes and guessing was
   * never the threat, but the sentence is true rather than aspirational.
   *
   * Six hundred an hour, because the address is a carrier NAT, not a person:
   * one MTN IP is hundreds of creators, all opening their links in the same
   * launch-morning hour.
   */
  if (!(await allow(request, "enter", 600, 3600))) {
    return new NextResponse(null, {
      status: 307,
      headers: { Location: `${monicaRoutes.enterConfirm}?s=unavailable` },
    });
  }

  /*
   * A relative Location, because request.url is not the visitor's URL.
   *
   * On Netlify, request.url carries the deploy's own host, so
   * main--<site>.netlify.app rather than blockfestafrica.com, and building an
   * absolute Location from it sends people off the domain they typed. The
   * cookies set below are host-only for the domain they were actually on, so
   * they would not travel with them: they would land on a different host with
   * no session, having just clicked the link from their own welcome email.
   *
   * A relative Location is resolved by the browser against the URL it asked
   * for, which is the public domain by definition. It cannot be wrong the way a
   * reconstructed origin can, and it needs no environment variable to be right.
   */
  const go = (to: string) =>
    new NextResponse(null, { status: 307, headers: { Location: to } });

  /*
   * A database blip must not read as a bad link.
   *
   * Telling a creator their link is invalid sends them hunting for a new one
   * and, on launch morning, into the inbox of whoever answers support. Falling
   * back to null here would do exactly that, so the two cases are kept apart
   * and a failure says so.
   */
  let holder: Awaited<ReturnType<typeof creatorByToken>> = null;
  try {
    holder = await creatorByToken(token);
  } catch (error) {
    // Through the redactor, never raw: Postgres error text embeds offending
    // values, and this is a code path a token has just travelled.
    logWarning(
      "campaign/enter",
      `token could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
    );
    return go(`${monicaRoutes.enterConfirm}?s=unavailable`);
  }

  if (!holder) {
    /*
     * Nothing is set, and any half finished claim is cleared. Landing on the
     * confirm page with a reason is what turns "we do not know who you are" on
     * a dashboard into a sentence about the link that was actually clicked.
     */
    const response = go(`${monicaRoutes.enterConfirm}?s=unknown`);
    /*
     * With the cookie's own path, or the delete is a no-op. A clearing
     * Set-Cookie only matches the cookie it names when the Path matches too,
     * and this one was set path-scoped to the entry route. delete() without
     * options emits Path=/, which every real browser ignores for it.
     */
    response.cookies.delete({
      name: CREATOR_PENDING_COOKIE,
      path: pendingCookieOptions().path,
    });
    return response;
  }

  /*
   * Already signed in as this same person. No question worth asking.
   *
   * The __Host- cookie only, from the raw header. The pre-prefix name is the
   * one a sibling host can plant, and a planted token that matched the link
   * it was sent out with would walk its holder straight past the page below.
   * A creator still on the old cookie is asked once instead, like any link.
   */
  const existing = soleCookie(
    request.headers.get("cookie"),
    CREATOR_SESSION_COOKIE,
  );
  if (existing && existing === token) {
    /* An explicit query, because Netlify re-appends the ORIGINAL query to a
       query-less redirect Location: without this, the two success branches
       are exactly the ones that land the creator on a URL still carrying
       ?t=TOKEN, into the address bar, history, and any synced device. */
    const response = go(`${monicaRoutes.me}?s=go`);
    // Re-set so the ninety days run from this visit rather than from the first.
    response.cookies.set(CREATOR_SESSION_COOKIE, token, sessionCookieOptions());
    /*
     * With the cookie's own path, or the delete is a no-op. A clearing
     * Set-Cookie only matches the cookie it names when the Path matches too,
     * and this one was set path-scoped to the entry route. delete() without
     * options emits Path=/, which every real browser ignores for it.
     */
    response.cookies.delete({
      name: CREATOR_PENDING_COOKIE,
      path: pendingCookieOptions().path,
    });
    return response;
  }

  // Same explicit-query rule as the signed-in branch above: leave nothing
  // for Netlify to re-append the token onto.
  const response = go(`${monicaRoutes.enterConfirm}?s=go`);
  response.cookies.set(CREATOR_PENDING_COOKIE, token, pendingCookieOptions());
  return response;
}
