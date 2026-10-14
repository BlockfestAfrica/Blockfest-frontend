import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { pgErrorMessage } from "@/lib/db/errors";
import { logWarning } from "@/lib/log";
import { ROVV_SLUG } from "@/lib/rovv";

/** What the campaign page shows of the result. */
export type RovvWinnersOnPage = {
  /** TikTok usernames of the winners who have been emailed. */
  handles: string[];
  /**
   * Real winners picked but not emailed yet. Only how many: the page says
   * more are on their way while this is above 0, and nothing when it is 0,
   * so "more winners are being told now" is never up for good after the
   * owner decides fewer than twenty win.
   */
  untold: number;
};

/**
 * The TikTok usernames shown on the campaign page as winners.
 *
 * Only winners who have been emailed: a name on the page before its owner
 * has heard is how somebody learns they won from a screenshot, and a pick
 * the team is still weighing is not a result. Usernames only, as the owner
 * decided; names and emails never leave the console. Test entries (0074)
 * never appear, whatever happened to them, and are not counted.
 *
 * Fails soft to an empty list and a zero. The page is the pitch and the
 * entry form, and a database that is asleep must not take either offline.
 */
export async function publicRovvWinners(): Promise<RovvWinnersOnPage> {
  try {
    // One round trip for both: at most twenty rows, split here.
    const result = await getDb().execute(sql`
      SELECT e.tiktok_handle, e.notified_at IS NOT NULL AS told
        FROM rovv_entries e
        JOIN campaigns c ON c.id = e.campaign_id
       WHERE c.slug = ${ROVV_SLUG}
         AND NOT e.is_test
         AND e.winner_at IS NOT NULL
       ORDER BY e.tiktok_handle
    `);
    const rows = (result.rows ?? []) as { tiktok_handle: string; told: boolean }[];
    return {
      handles: rows.filter((r) => r.told).map((r) => r.tiktok_handle),
      untold: rows.filter((r) => !r.told).length,
    };
  } catch (error) {
    // Through the redactor, and never Drizzle's message, which is the params.
    logWarning("rovv winners", `could not be read: ${pgErrorMessage(error)}`);
    return { handles: [], untold: 0 };
  }
}
