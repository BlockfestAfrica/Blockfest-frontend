import "server-only";

/**
 * Verify an admin's Identity password, server side, without keeping anything.
 *
 * The whole point of the session exchange (#138) is that the Netlify Identity
 * credential is spent exactly once, here, and never reaches the browser. This
 * performs the GoTrue password grant itself, reads the user id out of the
 * returned token, and lets both GoTrue tokens fall out of scope. Nothing is
 * stored, set as a cookie, returned, or logged.
 *
 * It accepts a password, never a JWT. A JWT-accepting exchange could not tell a
 * password sign-in from a session a recovery or confirmation link established
 * (GoTrue JWTs carry no auth-method claim), which would reopen exactly the hole
 * the recovery gate closes. Accepting only email plus password keeps the
 * invariant that the only thing which opens the console is the password.
 */

/**
 * Where the grant is sent. From the environment Netlify sets, never from a
 * request header: Host is fine for comparing origins but must never choose
 * where a password is POSTed. GoTrue is site-level, so the production URL
 * answers for deploy previews too, against the same user pool.
 */
const IDENTITY_ORIGIN = (process.env.URL || "https://blockfestafrica.com").replace(
  /\/+$/,
  "",
);
const TOKEN_ENDPOINT = `${IDENTITY_ORIGIN}/.netlify/identity/token`;
const LOGOUT_ENDPOINT = `${IDENTITY_ORIGIN}/.netlify/identity/logout`;

export type PasswordCheck =
  | { ok: true; identityId: string; email: string }
  | { ok: false };

/** Decode a JWT payload without verifying: it arrived seconds ago over TLS
 * from its own issuer in response to our own request, and we never read exp. */
function decodePayload(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function verifyIdentityPassword(
  email: string,
  password: string,
): Promise<PasswordCheck> {
  let accessToken: string | undefined;
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        username: email,
        password,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { ok: false };

    const body = (await response.json()) as {
      access_token?: string;
      email?: string;
    };
    accessToken = body.access_token;
    if (!accessToken) return { ok: false };

    const payload = decodePayload(accessToken);
    const identityId = String(payload?.sub ?? "");
    if (!identityId) return { ok: false };

    const claimedEmail =
      (typeof payload?.email === "string" && payload.email) ||
      body.email ||
      email;

    return { ok: true, identityId, email: String(claimedEmail).trim().toLowerCase() };
  } catch {
    // Network, timeout, non-JSON: fail closed, one shape, nothing logged that
    // could carry the address or password.
    return { ok: false };
  } finally {
    // Best effort: ask GoTrue to revoke the refresh tokens for this user,
    // which also kills any legacy refresh token still in an old browser's
    // localStorage. Whatever its exact scope, revoking is the safe direction
    // and nothing here depends on it.
    if (accessToken) {
      try {
        await fetch(LOGOUT_ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        // ignored
      }
    }
  }
}
