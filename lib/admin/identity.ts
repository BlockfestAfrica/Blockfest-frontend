import "server-only";

/**
 * Reading the signed-in Netlify Identity user from server code.
 *
 * Identity documents server-side getUser() for Netlify Functions. A Next.js App
 * Router route handler is neither a v1 nor a v2 function: it is
 * `export async function GET(request)`, compiled into a function by the Next
 * runtime. Whether Identity's request context reaches that far is not something
 * the documentation answers, and guessing at Netlify's runtime shape has
 * already cost this project one production outage.
 *
 * So every call is wrapped. If Identity cannot resolve a user here, this
 * returns a reason instead of throwing into a route handler, and the caller
 * refuses the request. Failing closed on an unknown runtime is the only
 * acceptable direction for the surface that mints prize money.
 *
 * Identity does not run under `netlify dev`, so this is exercised on deploy
 * previews rather than locally.
 */

export interface IdentityUser {
  id: string;
  email: string;
  roles: string[];
}

export type IdentityResult =
  | { ok: true; user: IdentityUser }
  | { ok: false; reason: "anonymous" | "unavailable"; detail?: string };

export async function currentIdentityUser(): Promise<IdentityResult> {
  try {
    const { getUser } = await import("@netlify/identity");
    const user = await getUser();

    if (!user?.email) return { ok: false, reason: "anonymous" };

    return {
      ok: true,
      user: {
        id: String(user.id ?? ""),
        email: String(user.email).trim().toLowerCase(),
        roles: Array.isArray(user.roles) ? user.roles.map(String) : [],
      },
    };
  } catch (error) {
    // Anything at all: Identity not reachable, no request context, a shape we
    // did not expect. The caller treats this as "not signed in".
    return {
      ok: false,
      reason: "unavailable",
      detail: error instanceof Error ? error.name : String(error),
    };
  }
}
