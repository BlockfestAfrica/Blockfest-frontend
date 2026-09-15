import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode } from "@/lib/db/errors";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Disqualify a creator, which is the campaign's last resort.
 *
 * void_enrolment has existed since 0027 and could not be called: no route,
 * no console control, nothing. The engine has been enforcing the state all
 * along, refusing submissions and approvals and announcements for a
 * disqualified creator, while the act of disqualifying anybody was
 * reachable only by somebody with a psql prompt. A rule nobody can invoke
 * is a rule the campaign does not actually have, and the fraud the voting
 * and points engines are built to survive ends here or nowhere.
 *
 * Owners only, like announcing a winner and for the same reason: this one
 * takes money away rather than giving it. The engine clamps the ledger
 * reversal and writes its own audit row; this route validates shape,
 * forwards, and translates. The reason is mandatory in SQL, which is what
 * makes a disqualification answerable later.
 */

const schema = z.object({
  enrolmentId: z.string().uuid("That is not a creator."),
  reason: z
    .string()
    .trim()
    .min(1, "Say why. A disqualification with no reason cannot be answered.")
    .max(300, "Keep the reason under three hundred characters."),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, string> = {
  P0401: "Only a signed-in admin can do this.",
  P0502: "Say why. A disqualification with no reason cannot be answered.",
  P0201: "That creator is not in this campaign.",
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

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  try {
    const result = await getDb().execute(
      sql`SELECT void_enrolment(${parsed.data.enrolmentId}::uuid, ${admin.admin.adminId}::uuid, ${parsed.data.reason}::text) AS reversed`,
    );
    const row = (result.rows?.[0] ?? {}) as { reversed?: number };
    return NextResponse.json({
      ok: true,
      pointsReversed: Number(row.reversed ?? 0),
    });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;
    if (known) {
      return NextResponse.json({ ok: false, message: known }, { status: 400 });
    }
    logError("admin/void", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
