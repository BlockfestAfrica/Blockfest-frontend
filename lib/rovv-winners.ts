import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { ROVV_SLUG } from "@/lib/rovv";

/**
 * The TikTok usernames shown on the campaign page as winners.
 *
 * Only winners who have been emailed: a name on the page before its owner
 * has heard is how somebody learns they won from a screenshot, and a pick
 * the team is still weighing is not a result. Usernames only, as the owner
 * decided; names and emails never leave the console.
 *
 * Fails soft to an empty list. The page is the pitch and the entry form, and
 * a database that is asleep must not take either offline.
 */
export async function publicRovvWinners(): Promise<string[]> {
  try {
    const result = await getDb().execute(sql`
      SELECT e.tiktok_handle
        FROM rovv_entries e
        JOIN campaigns c ON c.id = e.campaign_id
       WHERE c.slug = ${ROVV_SLUG}
         AND e.winner_at IS NOT NULL
         AND e.notified_at IS NOT NULL
       ORDER BY e.tiktok_handle
    `);
    return ((result.rows ?? []) as { tiktok_handle: string }[]).map((r) => r.tiktok_handle);
  } catch (error) {
    console.warn("[rovv] winners could not be read:", error instanceof Error ? error.message : String(error));
    return [];
  }
}
