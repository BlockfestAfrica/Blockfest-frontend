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

/** Edit one point rule (#68). Owners: these numbers decide money. */

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

const schema = z.object({
  ruleId: z.string().uuid(),
  defaultPoints: z.number().int().min(-100_000).max(100_000).nullable().optional(),
  minPoints: z.number().int().min(-100_000).max(100_000).nullable().optional(),
  maxPoints: z.number().int().min(-100_000).max(100_000).nullable().optional(),
});

const KNOWN: Array<[string, string, string]> = [
  ["P0910", "bounds_inverted", "The floor cannot be above the ceiling."],
  ["P0909", "rule_not_found", "That rule does not exist."],
];

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;
  const admin = await requireAdmin();
  if (!admin.ok || !isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the values." },
      { status: 400 },
    );
  }
  const c = parsed.data;

  try {
    const result = await getDb().execute(sql`
      SELECT * FROM update_point_rule(
        ${c.ruleId}::uuid, ${admin.admin.adminId}::uuid,
        ${c.defaultPoints ?? null}::integer, ${c.minPoints ?? null}::integer, ${c.maxPoints ?? null}::integer
      )
    `);
    const row = (result.rows?.[0] ?? {}) as { rule_key?: string };
    return NextResponse.json({ ok: true, key: row.rule_key ?? null });
  } catch (error) {
    for (const [code, raise, message] of KNOWN) {
      if (isPgError(error, code, raise)) {
        return NextResponse.json({ ok: false, message }, { status: 400 });
      }
    }
    logError("admin/point-rule", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
