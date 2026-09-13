import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { logError } from "@/lib/log";
import { isPgError, PG, pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { MONICA_SLUG } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pause or resume the campaign.
 *
 * Owners only. Pausing stops every creator entering, which is a bigger action
 * than approving one entry, and the admin table already distinguishes owners
 * from reviewers. This is the first place that distinction is used, and the
 * reason it exists.
 *
 * A pause needs a reason and the database refuses one without it. The reason is
 * shown to creators verbatim, because the commonest response to a silent
 * failure is to try again and then complain, and somebody has to answer them.
 */

const pauseSchema = z.object({
  paused: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  const parsed = pauseSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Check the request." },
      { status: 400 },
    );
  }

  const { paused, reason } = parsed.data;

  if (paused && !reason) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "A pause needs a reason. Creators see it, and it is the difference between being told and being stonewalled.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await db().execute(
      sql`SELECT * FROM set_campaign_pause(${MONICA_SLUG}, ${paused}, ${reason ?? null}, ${admin.admin.adminId}::uuid)`,
    );
    const row = (result.rows?.[0] ?? {}) as { paused?: boolean; reason?: string };

    return NextResponse.json({
      ok: true,
      paused: Boolean(row.paused),
      reason: row.reason ?? null,
    });
  } catch (error) {
    if (isPgError(error, PG.CAMPAIGN_NOT_FOUND, "campaign_not_found")) {
      return NextResponse.json(
        { ok: false, message: "That campaign does not exist." },
        { status: 404 },
      );
    }
    if (pgErrorMessage(error).includes("reason_required")) {
      return NextResponse.json(
        { ok: false, message: "A pause needs a reason." },
        { status: 400 },
      );
    }

    logError("admin/pause", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}

function db() {
  return getDb();
}
