import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

/**
 * The migration directory Netlify applies on deploy.
 *
 * Tests read this directory rather than a hardcoded list of filenames. A list
 * is a second place to remember: adding a migration and forgetting to name it
 * there leaves the suite passing against a schema production no longer has,
 * which is the one failure a schema test exists to prevent.
 */
export const MIGRATIONS_DIR = join(
  process.cwd(),
  "netlify/database/migrations",
);

/** Sorted the way Netlify sorts them, so tests run the production order. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Apply the migrations, optionally only part of the run.
 *
 * The range exists so a migration can be tested against data the schema before
 * it permitted. A migration that adds a constraint has two jobs: enforce the
 * rule from now on, and survive the rows that broke it already. The second is
 * the one that fails a deploy, and it cannot be exercised at all if the only
 * way to set up is to apply every migration first.
 *
 * Bounds are inclusive and match on the numeric prefix, so "0022" means up to
 * and including 0022_handle_verification.sql.
 */
export async function applyMigrations(
  db: PGlite,
  range: { upTo?: string; from?: string } = {},
): Promise<void> {
  const prefix = (file: string) => file.split("_")[0];

  for (const file of migrationFiles()) {
    if (range.upTo && prefix(file) > range.upTo) continue;
    if (range.from && prefix(file) < range.from) continue;
    await applyMigration(db, file);
  }
}

/**
 * Apply one migration by name.
 *
 * Netlify records what it has applied and never repeats a file, so the set as a
 * whole is not replayable and is not meant to be: the schema migrations create
 * tables unconditionally. A seed is the exception, because it can meet rows
 * that already exist, and that case is worth exercising on its own.
 */
export async function applyMigration(
  db: PGlite,
  file: string,
): Promise<void> {
  await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
}
