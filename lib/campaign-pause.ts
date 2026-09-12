import "server-only";
import { eq } from "drizzle-orm";
import { campaigns, getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";

/**
 * Whether the campaign is currently paused, and why.
 *
 * Read on every write path and on the pages that offer one, so a pause takes
 * effect on the next click rather than the next deploy. That is the whole
 * point of it being a row.
 */

export interface PauseState {
  paused: boolean;
  /** Shown to creators verbatim. Null when running. */
  reason: string | null;
  /**
   * When registration opens, or null if it could not be read.
   *
   * Read from the row rather than the constant in lib/campaigns, because the
   * one destructive action in the admin screen is allowed only before this
   * moment and it is the database that enforces it. A screen deciding from a
   * hardcoded date while the function decides from the row is two answers to
   * one question, and they only have to disagree once.
   *
   * Null when unknown, and callers treat unknown as open. That is the opposite
   * of the pause default above on purpose: this one gates destruction.
   */
  startsAt: Date | null;
}

const RUNNING: PauseState = { paused: false, reason: null, startsAt: null };

/**
 * Fails open, and that is a deliberate choice rather than an oversight.
 *
 * Everything else in this codebase fails closed, because the question is
 * usually "may this person do something" and an unknown answer must not be
 * permission. This question is the opposite: it is "has somebody deliberately
 * stopped the campaign", and the default answer to that is no.
 *
 * A database blip that silently paused a live campaign would take entries away
 * from creators who did nothing wrong, and would look exactly like the outage
 * it was caused by. The gates that actually protect the campaign, the opening
 * date, the session, the admin check, all still run and all still fail closed.
 */
export async function pauseState(): Promise<PauseState> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        pausedAt: campaigns.pausedAt,
        reason: campaigns.pausedReason,
        startsAt: campaigns.startsAt,
      })
      .from(campaigns)
      .where(eq(campaigns.slug, MONICA_SLUG))
      .limit(1);

    const row = rows[0];
    if (!row) return RUNNING;

    return {
      paused: Boolean(row.pausedAt),
      reason: row.pausedAt ? row.reason?.trim() || null : null,
      startsAt: row.startsAt ?? null,
    };
  } catch (error) {
    console.warn(
      "[pause] could not be read, treating the campaign as running:",
      error instanceof Error ? error.message : String(error),
    );
    return RUNNING;
  }
}
