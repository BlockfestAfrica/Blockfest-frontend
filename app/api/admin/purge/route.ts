import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { MONICA_SLUG } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clear the campaign's test data before it opens.
 *
 * There should not normally be a button that erases a campaign, and after
 * Monday there is not one: purge_before_launch refuses once starts_at has
 * passed, so this route stops working by itself at the instant registration
 * opens, with nobody needing to remember to remove it.
 *
 * Before then it is the only way the purge actually happens. Netlify DB does
 * not expose its connection string as a readable site variable, so there is no
 * psql prompt to reach for on the Sunday night this is needed.
 *
 * Every guard is in the database rather than here: active owner, campaign
 * paused, campaign not yet open, slug typed twice. This route repeats the owner
 * check because failing early is cheaper, not because it is the one that counts.
 */

const purgeSchema = z.object({
  /** Typed by the operator, letter for letter. There is no undo. */
  confirm: z.string(),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, string> = {
  P0601: `Type the campaign slug exactly: ${MONICA_SLUG}`,
  P0602: "That campaign does not exist.",
  P0603: "Pause the campaign first. A purge should not run under live traffic.",
  P0604:
    "The campaign has opened. Everything in it now belongs to somebody who entered, so it cannot be cleared from here.",
  P0401: "Only a signed-in admin can do this.",
  P0403: "Only an owner can clear the campaign.",
};

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

  const parsed = purgeSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Check the request." },
      { status: 400 },
    );
  }

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM purge_before_launch(${MONICA_SLUG}, ${parsed.data.confirm}, ${admin.admin.adminId}::uuid)`,
    );

    const deleted = (result.rows ?? []) as {
      table_name: string;
      rows_deleted: number;
    }[];

    return NextResponse.json({
      ok: true,
      deleted: deleted.map((row) => ({
        table: row.table_name,
        rows: Number(row.rows_deleted ?? 0),
      })),
      total: deleted.reduce(
        (sum, row) => sum + Number(row.rows_deleted ?? 0),
        0,
      ),
    });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;

    if (known) {
      return NextResponse.json({ ok: false, message: known }, { status: 400 });
    }

    logError("admin/purge unmapped", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
