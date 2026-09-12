import { createHash } from "node:crypto";
import "server-only";

import {
  getConnectionString,
  MissingDatabaseConnectionError,
} from "@netlify/database";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * The campaign database.
 *
 * Neon, provisioned through Netlify DB, reached over its HTTP driver. Three
 * decisions are baked in here and each one is load-bearing.
 *
 * It is server-only, enforced by the import above rather than by convention.
 * The site ships a strict Content-Security-Policy whose connect-src allows
 * 'self' and the analytics host and nothing else, applied globally at
 * next.config.ts source '/(.*)'. A browser-side database client would mean
 * adding a database origin to a header that every static marketing page also
 * carries, and shipping a key whose only guard is a row-level-security policy
 * written under deadline. Reaching the database only from route handlers and
 * server components means connect-src never has to change at all.
 *
 * The HTTP driver rather than a TCP pool, because this runs on serverless
 * functions. A pooled TCP driver on a platform that may start dozens of
 * concurrent instances exhausts Postgres connections, and the usual fix is a
 * pooler with its own configuration trap. HTTP has no connection to exhaust.
 * The cost is that multi-statement interactive transactions are not available,
 * which does not bite: the one operation that genuinely needs transactional
 * locking is scoring, and that lives in a Postgres function, so it is a single
 * round trip that locks and commits server-side.
 *
 * And every route that imports this must set `export const runtime = "nodejs"`.
 */

let cached: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Where the connection string comes from.
 *
 * Netlify DB does not expose the connection as a site environment variable you
 * can read in the dashboard. It is injected into the function environment at
 * runtime under its own name, and the supported way to reach it is the
 * package's own resolver rather than a variable name you guessed. Guessing is
 * exactly what went wrong here the first time: this module read
 * NETLIFY_DATABASE_URL, which is not the name Netlify uses, so every call to
 * the registration endpoint in production failed with a 500 while every local
 * check passed.
 *
 * DATABASE_URL still wins when it is set, so a developer can point at their own
 * database, and tests can point somewhere disposable.
 */
function connectionString(): string {
  const explicit = process.env.DATABASE_URL;
  if (explicit) return explicit;

  try {
    return getConnectionString();
  } catch (error) {
    if (error instanceof MissingDatabaseConnectionError) {
      throw new Error(
        "No database connection. Netlify DB did not provide one and DATABASE_URL is unset. " +
          "Locally, run `netlify dev` or set DATABASE_URL.",
      );
    }
    throw error;
  }
}

/**
 * Which database this deploy is pointed at, without revealing it.
 *
 * Netlify DB gives every deploy preview its own branch, seeded from production
 * at preview-creation time, so a preview cannot write to live campaign data.
 * That is the platform's behaviour rather than anything this code arranges,
 * which means the only honest way to know it is still true is to look.
 *
 * A short hash of the host, never the host and never the credential. It answers
 * the only question worth asking from outside, which is whether two deploys are
 * on the same database, and answers it without publishing an address for
 * anybody to point a client at.
 *
 * Returns null rather than throwing when there is no connection to describe,
 * because this is read by a health endpoint whose job is to keep answering.
 */
export function databaseFingerprint(): string | null {
  try {
    const url = new URL(connectionString());
    return createHash("sha256")
      .update(url.host)
      .digest("hex")
      .slice(0, 12);
  } catch {
    return null;
  }
}

/**
 * The database handle, built on first use.
 *
 * Deliberately not a module-level constant. Next evaluates every route module
 * during the build, so a client constructed at import time needs a connection
 * string at build time too, and the build fails on any environment without one:
 * a fresh clone, CI, and every preview built before the database existed.
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (cached) return cached;
  cached = drizzle(neon(connectionString()), { schema });
  return cached;
}

export * from "./schema";
