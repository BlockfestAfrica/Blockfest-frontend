import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { notCrossSite } from "@/lib/admin/request";
import { entriesCsv, payoutCsv, payoutLines } from "@/lib/admin/payout";
import { logError } from "@/lib/log";

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
  if (!notCrossSite(request)) {
    return NextResponse.json(
      { ok: false, message: "Not allowed." },
      { status: 403 },
    );
  }

  const admin = await requireAdmin();
  if (!admin.ok || !isOwner(admin.admin)) {
    // Distinct from the cross-site refusal above: both used to say
    // "Not allowed.", which made a screenshot of a failure undiagnosable.
    return NextResponse.json(
      { ok: false, message: "Sign in to the console as an owner to download this." },
      { status: 403 },
    );
  }

  const which = request.nextUrl.searchParams.get("of") === "entries";
  const lines = await payoutLines(admin.admin);
  const body = which ? entriesCsv(lines) : payoutCsv(lines);

  /*
   * An export is a read with consequences: every payee's name, points and
   * working just left for a laptop. The CSV incident's first question was
   * "who exported this, and when", and until now nothing could answer it.
   * Fail-soft: a lost audit row must not block the document a dispute is
   * answered with.
   */
  await getDb()
    .execute(
      sql`INSERT INTO audit_log (actor_admin_id, action, entity_type, after)
          VALUES (${admin.admin.adminId}::uuid, 'payout.exported', 'campaign',
                  ${JSON.stringify({ kind: which ? "entries" : "payout", rows: lines.length })}::jsonb)`,
    )
    .catch((error) => logError("admin/payout audit", error));

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
