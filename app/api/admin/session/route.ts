import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { allow } from "@/lib/throttle";
import { verifyIdentityPassword } from "@/lib/admin/exchange";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  hashAdminSessionToken,
  newAdminSessionToken,
} from "@/lib/admin/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Turn an email and password into a server-minted admin session (#138).
 *
 * The Identity password grant happens here, server side, once. The browser
 * never sees the Identity token; what it gets back is an httpOnly, Secure,
 * SameSite=Strict __Host- cookie whose only readable half is a random token,
 * and whose SHA-256 is a row. After this, no admin credential exists in
 * document.cookie or localStorage.
 *
 * Every failure returns one uniform 403 sentence, so a prober cannot tell a
 * wrong password from a valid Identity user who is not an admin from a revoked
 * one. The 429 is the single distinguishable answer, because a real admin who
 * mistypes must learn that waiting fixes it and that costs an attacker nothing.
 */

const UNIFORM_403 = NextResponse.json(
  { ok: false, message: "That did not work. Check the address and password." },
  { status: 403 },
);

const schema = z.object({
  email: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(1024),
});

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });
  }

  // Before GoTrue is dialled, so stuffing costs our throttle rather than an
  // upstream round trip. Ten per ten minutes per platform-attested client IP.
  if (!(await allow(request, "admin-exchange", 10, 600))) {
    return NextResponse.json(
      { ok: false, message: "Too many tries. Wait ten minutes, then sign in again." },
      { status: 429 },
    );
  }

  const read = await readJsonBody(request);
  if (!read.ok) return UNIFORM_403;

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return UNIFORM_403;

  const check = await verifyIdentityPassword(
    parsed.data.email.toLowerCase(),
    parsed.data.password,
  );
  if (!check.ok) return UNIFORM_403;

  const token = newAdminSessionToken();

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM create_admin_session(${check.email}, ${check.identityId}, ${hashAdminSessionToken(token)})`,
    );
    const row = result.rows?.[0] as { admin_id?: string } | undefined;
    if (!row?.admin_id) return UNIFORM_403;
  } catch (error) {
    /*
     * The error NAME only, never its message.
     *
     * This is the one request in the codebase that holds a password. Drizzle
     * wraps a failed query as "Failed query: <sql> params: <params>", and no
     * redactor can recognise a password: it is arbitrary text chosen by a
     * person. redactPii would strip the address and pass the password through.
     * The name says the insert failed without quoting anything. This route
     * never puts the password in a query, so a real Drizzle error would not
     * carry one either; logging the name is the belt that keeps that true
     * whatever the query becomes.
     */
    console.error(
      "[admin/session] could not create session:",
      error instanceof Error ? error.name : "unknown",
    );
    return UNIFORM_403;
  }

  const response = NextResponse.json({ ok: true });
  // The token rides only in Set-Cookie, never in the body, so even the page
  // that asked for sign-in cannot read it.
  response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());

  // Expire the legacy Identity pair, exactly as signout does, so the old
  // script-readable credential does not linger beside the new one.
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
