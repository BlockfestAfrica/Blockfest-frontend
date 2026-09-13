import "server-only";
import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { throttleKey, SHARED_BUCKET } from "@/lib/admin/request";
import { logWarning } from "@/lib/log";

/**
 * Ask whether this request is allowed, and spend a token if it is.
 *
 * The counter lives in Postgres because the functions are serverless: a module
 * variable is per instance, resets on a cold start, and hands an attacker a
 * fresh budget for waiting. It would look like a rate limit in review and do
 * nothing in production.
 *
 * Fails OPEN, in two directions, and that is deliberate.
 *
 * A request with no client address is not throttled, rather than being put in a
 * bucket shared with everybody else. Netlify sets x-nf-client-connection-ip
 * itself and a client cannot forge it, so the absent case means the platform
 * changed, not that somebody is evading. Sharing one bucket would have the
 * campaign rate limit itself on launch morning, which is a self inflicted
 * outage in exchange for nothing.
 *
 * And a database error allows the request. These limits exist to make
 * enumeration slow, not to protect anything that would be unsafe without them:
 * every rule that actually guards points or money is enforced separately and
 * does not consult this. Turning a database blip into a registration outage on
 * the day the campaign opens is the worse failure.
 */
export async function allow(
  request: NextRequest,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = throttleKey(request);
  if (key === SHARED_BUCKET) return true;

  try {
    const result = await getDb().execute(
      sql`SELECT take_token(${`${name}:${key}`}, ${limit}, ${windowSeconds}) AS ok`,
    );
    const ok = (result.rows?.[0] as { ok?: boolean } | undefined)?.ok;
    if (ok === false) {
      // The address is not logged: it is personal data, and the bucket name is
      // what says which limit fired.
      logWarning("throttle", `${name} limit reached`);
    }
    return ok !== false;
  } catch (error) {
    logWarning(
      "throttle",
      `could not be read, allowing: ${error instanceof Error ? error.message : String(error)}`,
    );
    return true;
  }
}
