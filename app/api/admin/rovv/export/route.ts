import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { notCrossSite } from "@/lib/admin/request";
import { lagosStamp, rovvCsv, rovvEntries, rovvReferralCsv } from "@/lib/admin/rovv";
import { ROVV_SLUG } from "@/lib/rovv";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rovv's entries as a spreadsheet: for ROVV (?of=rovv), every entry with
 * every column for the team (?of=all, the default), or the winners
 * (?of=winners).
 *
 * The ROVV file carries exactly the four fields the privacy notice says ROVV
 * receives, so the file that leaves never says more than the notice does.
 * Owners only. Same shape as the payout export: a GET a link can reach,
 * refused cross-site, audited, never cached.
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
    return NextResponse.json(
      { ok: false, message: "Sign in to the console as an owner to download this." },
      { status: 403 },
    );
  }

  const asked = request.nextUrl.searchParams.get("of");
  const of = asked === "winners" || asked === "rovv" ? asked : "all";
  const rows = await rovvEntries(admin.admin, { status: of === "winners" ? "winners" : "all" });
  const body = of === "rovv" ? rovvReferralCsv(rows) : rovvCsv(rows);

  /*
   * Who took every entrant's details, and when. Fail-soft, like the payout
   * export: a lost audit row must not block the file Rovv is waiting on.
   */
  await getDb()
    .execute(
      sql`INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, after)
          VALUES ((SELECT id FROM campaigns WHERE slug = ${ROVV_SLUG}),
                  ${admin.admin.adminId}::uuid, 'rovv.exported', 'campaign',
                  ${JSON.stringify({ of, rows: rows.length })}::jsonb)`,
    )
    .catch((error) => logError("admin/rovv export audit", error));

  // Dated, so two files taken on different days say which day they answer
  // for. The Lagos day: between midnight and 1am the UTC date is yesterday's.
  const stamp = lagosStamp(new Date()).slice(0, 10);
  const name =
    of === "winners"
      ? `rovv-winners-${stamp}.csv`
      : of === "rovv"
        ? `rovv-referral-check-${stamp}.csv`
        : `rovv-entries-${stamp}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      // Never stored by a proxy or a browser: it names people and their emails.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
