import { NextResponse, type NextRequest } from "next/server";
import { currentIdentityUser } from "@/lib/admin/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Does Netlify Identity resolve a user inside a Next.js route handler?
 *
 * Identity documents server-side getUser() for Netlify Functions, and a route
 * handler is not one of the two shapes that documentation describes. This
 * answers the question on a real deploy, because Identity does not run under
 * `netlify dev` and so cannot be answered locally.
 *
 * It is deliberately not an oracle. It reports whether a session resolved and
 * whether that address is a known active admin, and never the email address,
 * the roles, the token, or anything about accounts that are not yours. An
 * anonymous caller learns only that they are anonymous, which they knew.
 *
 * This exists to be deleted once the admin surface is built and proven.
 */
export async function GET(request: NextRequest) {
  const identity = await currentIdentityUser();

  return NextResponse.json({
    // Did the runtime give us a session at all?
    resolved: identity.ok,
    // Distinguishes "nobody is signed in" from "Identity is not reachable from
    // here", which are the same to a visitor and completely different to us.
    reason: identity.ok ? "signed-in" : identity.reason,
    detail: identity.ok ? undefined : identity.detail,
    // Presence only. Confirms the browser is sending the session cookie, which
    // is the other half of the question, without revealing its value.
    hasIdentityCookie: Boolean(request.cookies.get("nf_jwt")),
    roleCount: identity.ok ? identity.user.roles.length : 0,
  });
}
