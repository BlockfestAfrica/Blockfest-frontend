import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { MONICA_SLUG } from "@/lib/campaigns";

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
 * no confirmation step here: nothing can be lost by pressing it twice.
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
    console.error("[admin/snapshot]", pgErrorCode(error), pgErrorMessage(error));
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
