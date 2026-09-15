import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { currentWeekNo, MONICA_SLUG } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Freeze the standings for a week.
 *
 * Available to reviewers as well as owners. Taking a snapshot only records what
 * is already public, it destroys nothing, and the Saturday ritual should not
 * wait on one person being awake.
 *
 * Re-taking makes a new version rather than replacing the old one, so there is
 * no confirmation step here: no recorded standing is lost by pressing it twice.
 *
 * One thing a re-take used to move, and no longer does: a closed vote round
 * pins the snapshot version its tie-break reads (0059), so recording again
 * after the round closed cannot re-base a settled Community Favourite.
 */

const schema = z.object({
  weekNo: z.number().int().min(1).max(4),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Pick a week between 1 and 4." },
      { status: 400 },
    );
  }

  /*
   * The week is the server's to decide, not the caller's.
   *
   * The body used to name any week 1 to 4 and the route took it: a
   * reviewer, who cannot announce anything, could POST week 4 during week 1
   * and mint a version-1 "frozen record" of a week that had not happened,
   * which is the row the announce gate checks for and the row a dispute is
   * answered from. The number stays in the body as a confirmation that the
   * page and the server agree, and a disagreement is refused rather than
   * silently resolved in the caller's favour.
   */
  if (parsed.data.weekNo !== currentWeekNo()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "That is not the week that is running. Reload the page and record the current week.",
      },
      { status: 409 },
    );
  }

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM take_leaderboard_snapshot(${MONICA_SLUG}, ${parsed.data.weekNo}::smallint, ${admin.admin.adminId}::uuid)`,
    );
    const row = (result.rows?.[0] ?? {}) as {
      version?: number;
      rows_captured?: number;
    };

    return NextResponse.json({
      ok: true,
      version: Number(row.version ?? 0),
      rows: Number(row.rows_captured ?? 0),
    });
  } catch (error) {
    logError("admin/snapshot", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
