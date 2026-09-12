/**
 * Point this at a database and it will tell you whether the campaign can be
 * settled from it.
 *
 *   npx tsx scripts/verify-database.ts "postgres://..."
 *
 * Written for the restore drill, which is the only way to find out whether a
 * backup is a backup. Restore to a scratch branch, run this against it, and the
 * answer is a list rather than a judgement call at two in the morning.
 *
 * It reads. It never writes, and it is never pointed at production as a
 * maintenance step: a check that also fixes things is a check nobody can run
 * when they are unsure.
 */

import { neon } from "@neondatabase/serverless";
import { runIntegrityChecks } from "../lib/db/integrity";

const connectionString = process.argv[2] ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "Usage: npx tsx scripts/verify-database.ts \"postgres://...\"\n\n" +
      "Get a connection string from the database extension in the Netlify\n" +
      "project, or from the Neon console. Never from a committed file.",
  );
  process.exit(2);
}

const sql = neon(connectionString);

async function main() {
  const results = await runIntegrityChecks(async (statement: string) => {
    const rows = (await sql.query(statement)) as Record<string, unknown>[];
    return Number(Object.values(rows[0])[0]);
  });

  const failed = results.filter((r) => !r.passed);

  for (const result of results) {
    const mark = result.passed ? "  ok  " : " FAIL ";
    console.log(`${mark} ${result.name}`);
    if (!result.passed) {
      console.log(`       expected ${result.expect}, got ${result.actual}`);
      console.log(`       ${result.because}`);
    }
  }

  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed.`,
  );

  if (failed.length > 0) {
    console.log(
      "\nThis database is not safe to settle the campaign from. " +
        "docs/RECOVERY.md has what to do next.",
    );
    process.exit(1);
  }

  console.log("Every invariant holds.");
}

main().catch((error) => {
  // A connection that cannot be opened is the most common outcome of a typo in
  // the string, and it should not look like a failed check.
  console.error(
    "\nCould not run the checks at all:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
});
