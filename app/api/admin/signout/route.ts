import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/admin/request";

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
    return NextResponse.json(
      { ok: false, message: "Not allowed." },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ ok: true });

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
