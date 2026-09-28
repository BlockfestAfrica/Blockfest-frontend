import type { PGlite } from "@electric-sql/pglite";

/**
 * Hold a challenge open for the length of a test.
 *
 * The migrations seed the real campaign, so week 1 carries its real window:
 * 16 to 24 September 2026. submit_entry refuses an entry once now() passes
 * ends_at, which is correct, and it meant every test that submits an entry
 * passed until the campaign's own deadline went by and then failed forever
 * after. Sixteen of them broke at once on 25 September, and because the
 * Netlify build runs the suite before it builds, a dated test is a deploy
 * that stops working on a date nobody wrote down.
 *
 * So a test that needs a week open says so, rather than inheriting one from
 * the calendar. Tests that care about a CLOSED window still set their own
 * dates; this only moves the ones that were relying on the seed.
 *
 * Dates only, never status: a test that wants a draft or a closed week sets
 * that itself, and silently flipping it here would hide the thing it was
 * checking.
 */
export async function holdChallengeOpen(
  db: PGlite,
  weekNo = 1,
): Promise<void> {
  await db.query(
    `UPDATE challenges
        SET starts_at = now() - interval '1 hour',
            ends_at   = now() + interval '7 days'
      WHERE week_no = $1::smallint`,
    [weekNo],
  );
}
