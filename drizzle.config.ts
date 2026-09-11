import type { Config } from "drizzle-kit";

/**
 * drizzle-kit configuration.
 *
 * Migrations are checked in rather than pushed. `drizzle-kit push` is quicker
 * while a schema is still moving, but the moment real creator registrations
 * exist, a diff applied straight to production is a change nobody reviewed
 * against data nobody can restore.
 *
 * Note that 0001_points_engine.sql is handwritten. drizzle-kit models tables,
 * not functions, and the scoring engine is a plpgsql function on purpose: it
 * needs SELECT ... FOR UPDATE so two admins reviewing two platforms of the same
 * entry at the same moment serialise instead of both awarding in full.
 */
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NETLIFY_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
