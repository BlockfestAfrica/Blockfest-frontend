import { NextResponse, type NextRequest } from "next/server";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { sameOrigin } from "@/lib/admin/request";
import { clearRovvTestEntries } from "@/lib/admin/rovv";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delete every Rovv test entry (0074), so the flow can be walked again.
 * Owners only. Real entries are never touched: the function deletes rows
 * marked as tests and nothing else, and writes the audit row.
 */
const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  try {
    const deleted = await clearRovvTestEntries(admin.admin);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    logError("admin/rovv test-clear", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
