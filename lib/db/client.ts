import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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

const url = process.env.NETLIFY_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  // Loud rather than a confusing null-reference further in. This is a
  // deployment misconfiguration, and it should read like one.
  throw new Error(
    "No database URL. Expected NETLIFY_DATABASE_URL (set by Netlify DB) or DATABASE_URL.",
  );
}

export const db = drizzle(neon(url), { schema });

export * from "./schema";
