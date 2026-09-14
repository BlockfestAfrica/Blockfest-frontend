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
  return allowKey(throttleKey(request), name, limit, windowSeconds);
}

/**
 * The same question, answered the opposite way when the database cannot be
 * asked.
 *
 * allowKey's fail-open is correct for the routes that use it: none of them
 * would become unsafe if the limiter vanished, only slower to enumerate. An
 * endpoint that sends mail is a different shape of risk. A throttle that
 * cannot be read must refuse the request rather than quietly become an
 * unmetered mailer, since the failure mode of failing open here is not
 * "enumeration got a little faster", it is "somebody's inbox, or ZeptoMail's
 * whole sending reputation, absorbs whatever a script sends at this route
 * while the database is down."
 *
 * A request with no client address still passes, exactly as allowKey does:
 * the platform sets that header itself, and its absence means the platform
 * changed, not that anybody is evading anything.
 */
export async function allowKeyStrict(
  key: string,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!key || key === SHARED_BUCKET) return true;

  try {
    const result = await getDb().execute(
      sql`SELECT take_token(${`${name}:${key}`}, ${limit}, ${windowSeconds}) AS ok`,
    );
    const ok = (result.rows?.[0] as { ok?: boolean } | undefined)?.ok;
    if (ok === false) {
      logWarning("throttle", `${name} limit reached`);
    }
    return ok !== false;
  } catch (error) {
    // The one line that differs from allowKey: refuse rather than allow.
    logWarning(
      "throttle",
      `could not be read, refusing (fail-closed): ${error instanceof Error ? error.name : "unknown"}`,
    );
    return false;
  }
}

/**
 * The same, keyed directly, for server actions where there is no NextRequest.
 * Callers read x-nf-client-connection-ip from headers() themselves.
 */
export async function allowKey(
  key: string,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!key || key === SHARED_BUCKET) return true;

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
    /*
     * The error NAME only, never its message.
     *
     * Drizzle wraps a failed query in a DrizzleQueryError whose message is
     * "Failed query: <sql> params: <params>", and the params here are the
     * bucket, which is name:<client-ip>. Passing that message to the log would
     * write the address into the very place this function's own comment
     * promises it does not. redactPii has no IP rule, so the message would
     * pass through intact. The name answers "the throttle read failed" without
     * naming anybody.
     */
    logWarning(
      "throttle",
      `could not be read, allowing: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return true;
  }
}
