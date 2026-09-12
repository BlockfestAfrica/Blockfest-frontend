import { NextResponse, type NextRequest } from "next/server";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { sameOrigin } from "@/lib/admin/request";
import { entriesCsv, payoutCsv, payoutLines } from "@/lib/admin/payout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The payout audit export.
 *
 * Owners only. It names who is being paid what, with the working, and is the
 * document a dispute is answered with two days before a 1,500,000 naira
 * transfer.
 *
 * A GET that returns a file, so it can be opened from a link and saved. It
 * changes nothing, so there is no origin-check exemption being made here: the
 * check still runs, because a cross-site GET that downloads this to somebody
 * else's machine is the thing worth preventing.
 */
export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, message: "Not allowed." },
      { status: 403 },
    );
  }

  const admin = await requireAdmin();
  if (!admin.ok || !isOwner(admin.admin)) {
    return NextResponse.json(
      { ok: false, message: "Not allowed." },
      { status: 403 },
    );
  }

  const which = request.nextUrl.searchParams.get("of") === "entries";
  const lines = await payoutLines(admin.admin);
  const body = which ? entriesCsv(lines) : payoutCsv(lines);

  // Dated, because two exports taken a day apart are two different answers and
  // the file that settles a dispute has to say which day it is the answer for.
  const stamp = new Date().toISOString().slice(0, 10);
  const name = which
    ? `monica-entries-${stamp}.csv`
    : `monica-payout-${stamp}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      // Never stored by a proxy or a browser: it names people and amounts.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
