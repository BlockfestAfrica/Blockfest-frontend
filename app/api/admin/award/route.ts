import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { allow } from "@/lib/throttle";
import { pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Award or take back points by hand.
 *
 * Available to reviewers as well as owners, deliberately. Rewarding standout
 * work is the ordinary business of reviewing, and the controls that matter are
 * the ceiling, the note and the attribution rather than the role. Every one of
 * those is enforced in the database, so this route cannot weaken them by
 * forgetting something.
 *
 * Taking points back is the same call with a negative number. The ledger is
 * append-only, so a reversal is a signed row rather than an edit and the
 * original decision stays visible.
 */

/** Only the sources a person may write. The engine owns the other two. */
const MANUAL_SOURCES = [
  "quality_bonus",
  "engagement_milestone",
  "featured_blockfest",
  "featured_monica",
  "collab",
  "wildcard_win",
  "manual_adjustment",
] as const;

const awardSchema = z.object({
  enrolmentId: z.string().uuid("That is not a creator."),
  source: z.enum(MANUAL_SOURCES),
  points: z
    .number()
    .int("Points have to be a whole number.")
    .refine((n) => n !== 0, "Zero points is not an award."),
  note: z
    .string()
    .trim()
    .min(1, "Say why. It is what a dispute is answered with.")
    .max(300),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

/** The database raises these deliberately, so each gets its own sentence. */
const MESSAGES: Record<string, string> = {
  P0505: "That is below the floor for this kind of award.",
  P0506: "That is above the ceiling for this kind of award.",
  P0504: "No limits are configured for that kind of award, so it is refused.",
  P0501: "That kind of points is awarded by the system, not by hand.",
  P0502: "Say why. It is what a dispute is answered with.",
  P0503: "Zero points is not an award.",
  /*
   * Carries the figure, because the admin's next move is the same award with a
   * smaller number and guessing it is the slow way to find out.
   */
  P0507: "That would take them below zero.",
  /*
   * Carries both figures for the same reason P0507 does: the admin's next move
   * is a smaller award, and the remaining headroom is the thing they need.
   */
  P0508: "That would take them past the manual award ceiling for this campaign.",
  P0509: "Manual awards cannot take back more than manual awards gave. Removing engine points is a disqualification, which the void does with a reason and a clawback.",
  P0201: "That creator does not exist.",
  P0401: "Only a signed-in admin can award points.",
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;

  /*
   * Twenty a minute. A person reviewing generously awards a few an hour, so
   * this never touches a human, and a runaway script or replayed session is
   * slowed to a pace the audit trail and the aggregate cap contain. Defence in
   * depth: the cap and the floor are the controls, this is the brake.
   */
  if (!(await allow(request, "admin_award", 20, 60))) {
    return NextResponse.json(
      { ok: false, message: "That is a lot of awards at once. Wait a minute." },
      { status: 429 },
    );
  }

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  const parsed = awardSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Check the award.",
      },
      { status: 400 },
    );
  }

  const { enrolmentId, source, points, note } = parsed.data;

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM award_points(${enrolmentId}::uuid, ${source}::ledger_source, ${points}::integer, ${note}::text, ${admin.admin.adminId}::uuid)`,
    );
    const row = (result.rows?.[0] ?? {}) as { points_total?: number };

    return NextResponse.json({
      ok: true,
      points,
      pointsTotal: Number(row.points_total ?? 0),
    });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;

    if (known) {
      /*
       * P0507 puts the creator's current total in the message text, since the
       * function is the only thing that read it under the lock. Surfacing it
       * turns "that did not work" into "they hold 50".
       */
      const held =
        code === "P0507" || code === "P0508" || code === "P0509"
          ? pgErrorMessage(error).match(/holds (-?\d+)/)?.[1]
          : undefined;

      return NextResponse.json(
        {
          ok: false,
          message: held ? `${known} They hold ${held}.` : known,
        },
        { status: 400 },
      );
    }

    logError("admin/award unmapped", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
