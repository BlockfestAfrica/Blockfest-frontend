import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Edit a weekly challenge from the console (#67).
 *
 * Owners only: the brief and the base points decide what everyone is chasing
 * and what an approval pays, which is the same weight class as announcing a
 * winner. The function audits every changed field, and a week whose window
 * has ended is read-only, because editing a finished week edits the record.
 */

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

const schema = z.object({
  challengeId: z.string().uuid(),
  title: z.string().trim().max(120, "The title fits in 120 characters.").optional(),
  description: z
    .string()
    .trim()
    .max(
      2000,
      "The brief fits in 2,000 characters. Trim it, and put the long version in the Creator Pack.",
    )
    .optional(),
  basePoints: z.number().int().positive().max(10_000).optional(),
  status: z.enum(["draft", "active", "closed"]).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

const KNOWN: Array<[string, string, string]> = [
  ["P0907", "challenge_readonly", "That week has ended. A finished week is the record of how its winners were decided, so it stays as it ran."],
  ["P0908", "window_inverted", "The window has to end after it starts."],
  ["P0503", "points_required", "Base points have to be a positive number."],
  ["P0202", "unknown_challenge", "That challenge does not exist."],
];

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok || !isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });
  }

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the edit." },
      { status: 400 },
    );
  }

  const c = parsed.data;

  try {
    const result = await getDb().execute(sql`
      SELECT * FROM update_challenge(
        ${c.challengeId}::uuid, ${admin.admin.adminId}::uuid,
        ${c.title ?? null}::text, ${c.description ?? null}::text,
        ${c.basePoints ?? null}::integer, ${c.status ?? null}::challenge_status,
        ${c.startsAt ?? null}::timestamptz, ${c.endsAt ?? null}::timestamptz
      )
    `);
    const row = (result.rows?.[0] ?? {}) as { week_no?: number };
    return NextResponse.json({ ok: true, weekNo: row.week_no ?? null });
  } catch (error) {
    for (const [code, raise, message] of KNOWN) {
      if (isPgError(error, code, raise)) {
        return NextResponse.json({ ok: false, message }, { status: 400 });
      }
    }
    logError("admin/challenge", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
