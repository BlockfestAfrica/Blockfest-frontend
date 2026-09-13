import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/admin/request";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { logError } from "@/lib/log";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  hashAdminSessionToken,
  looksLikeAdminSessionToken,
} from "@/lib/admin/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * End an admin session.
 *
 * There was no way to do this. The console had no sign-out anywhere, so an
 * Identity session could not be ended from the application at all: a reviewer
 * on a shared or borrowed laptop closed the tab and left a working session
 * behind it, and somebody who thought their session was compromised had nothing
 * to do about it but wait roughly an hour for the token to expire.
 *
 * Two cookies, because Netlify Identity uses both. nf_jwt carries the roles the
 * edge checks and the application reads; nf_refresh is what mints a new one, so
 * clearing the first without the second ends the session until the next
 * refresh and no longer.
 *
 * A POST, and same origin checked, because a GET would let any page on the
 * internet sign an admin out by embedding an image. That is only a nuisance
 * rather than a compromise, but a nuisance during a live review window is how
 * a queue stops being worked.
 *
 * One honest limit. Identity keeps its refresh token in localStorage as well,
 * which a server response cannot reach, so the browser half is cleared by the
 * button that calls this. Clearing the cookies is what stops this browser
 * authenticating, which is the part that matters here.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });
  }

  const jar = request.cookies;
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value?.trim();

  /*
   * Delete the row, not just the cookie.
   *
   * The old sign-out cleared cookies and left the session live in the
   * database, so a copy of the cookie value taken beforehand kept working. A
   * single DELETE makes the token worthless everywhere the moment it runs.
   */
  let ok = true;
  if (looksLikeAdminSessionToken(token)) {
    try {
      await getDb().execute(
        sql`DELETE FROM admin_sessions WHERE token_hash = ${hashAdminSessionToken(token)}`,
      );
    } catch (error) {
      ok = false;
      logError("admin/signout", error);
    }
  }

  const response = ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json(
        { ok: false, message: "We could not sign you out fully. Close the browser to be sure." },
        { status: 500 },
      );

  // Cookies expire either way: the server row is the authority, and clearing
  // the cookie is still worth doing when the delete failed.
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  for (const name of ["nf_jwt", "nf_refresh"]) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
