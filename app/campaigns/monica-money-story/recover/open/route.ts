import { NextResponse, type NextRequest } from "next/server";
import { CREATOR_RECOVERY_PENDING_COOKIE } from "@/lib/creator-access";
import { recoveryPendingCookieOptions } from "@/lib/creator-session";
import { recoveryHolderByToken } from "@/lib/creator-recovery";
import { monicaRoutes } from "@/lib/campaigns";
import { allow } from "@/lib/throttle";
import { logWarning } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the mailed confirmation link points. Closes #206, successor to #78.
 *
 * The same rule #78 put on the entry link applies here, stated for a second
 * token: resolving this one does not sign anybody in and does not rotate
 * anything. It only parks the token in a short lived, path scoped, httpOnly
 * cookie and sends the visitor to a page that names the account before
 * anything is committed. A mail client's link prefetcher, or a link
 * forwarded into a group chat, can reach this route for free and nothing
 * happens as a result. Only the deliberate POST from the confirm page, in
 * ./confirm/actions.ts, calls confirmAccessRecovery and rotates the token.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";

  // Resolving a recovery token is exactly as safe to leave unthrottled as
  // resolving an access token was reasoned to be in #78: it is 32 random
  // bytes from newAccessToken, so there is nothing for an oracle to
  // accelerate. The limit exists so the sentence stays true under load, not
  // because guessing this token is a real threat.
  if (!(await allow(request, "recover-open", 600, 3600))) {
    return new NextResponse(null, {
      status: 307,
      headers: { Location: `${monicaRoutes.recoverConfirm}?s=unavailable` },
    });
  }

  // Relative, not built from request.url: see enter/route.ts for why an
  // absolute Location built from the request would send visitors off the
  // domain they typed on a Netlify deploy.
  const go = (to: string) =>
    new NextResponse(null, { status: 307, headers: { Location: to } });

  let holder: Awaited<ReturnType<typeof recoveryHolderByToken>> = null;
  try {
    holder = await recoveryHolderByToken(token);
  } catch (error) {
    logWarning(
      "campaign/recover-open",
      `token could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
    );
    return go(`${monicaRoutes.recoverConfirm}?s=unavailable`);
  }

  if (!holder) {
    const response = go(`${monicaRoutes.recoverConfirm}?s=expired`);
    response.cookies.delete({
      name: CREATOR_RECOVERY_PENDING_COOKIE,
      path: recoveryPendingCookieOptions().path,
    });
    return response;
  }

  const response = go(`${monicaRoutes.recoverConfirm}?s=go`);
  response.cookies.set(
    CREATOR_RECOVERY_PENDING_COOKIE,
    token,
    recoveryPendingCookieOptions(),
  );
  return response;
}
