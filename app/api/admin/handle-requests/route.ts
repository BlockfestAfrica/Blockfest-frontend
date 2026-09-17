import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { sendEmailQuietly } from "@/lib/email/client";
import { handleRequestDecidedEmail } from "@/lib/email/templates";
import { personalPage } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Decide a handle change request.
 *
 * Owners only, like the direct fix, because approval IS the direct fix: it
 * runs through correct_social_handle, so a request can never become a second,
 * weaker door into editing attribution. Rejection requires a note, because the
 * note is what the creator reads on their own page.
 */

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

const schema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
  /* What the console rendered. The engine refuses to apply a different
     value than the one the owner read (P0909). */
  expectedHandle: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(300).optional().default(""),
});

const KNOWN: Array<[code: string, raise: string, message: string]> = [
  ["P0906", "request_already_decided", "Somebody has already decided this request."],
  ["P0909", "request_changed", "The creator changed this request after the page loaded. Reload and read the new handle before deciding."],
  ["P0904", "request_not_found", "That request does not exist."],
  ["P0502", "note_required", "Say why. The creator reads this on their page."],
  ["P0903", "handle_invalid", "The requested username no longer passes the shape check."],
  ["P0901", "handle_not_found", "That creator no longer has an account on that platform."],
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
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the decision." },
      { status: 400 },
    );
  }

  const { requestId, approve, note, expectedHandle } = parsed.data;

  try {
    /*
     * Who to tell, read before deciding so the join still resolves whatever
     * the decision does to the row. The creator's copy of the outcome is the
     * email plus their page; without the email they learn only if they
     * happen to visit.
     */
    const who = await getDb().execute(sql`
      SELECT c.email, c.full_name, r.platform, r.old_handle, r.requested_handle
        FROM handle_change_requests r
        JOIN campaign_creators cc ON cc.id = r.campaign_creator_id
        JOIN creators c ON c.id = cc.creator_id
       WHERE r.id = ${requestId}::uuid
    `);
    const recipient = (who.rows?.[0] ?? null) as {
      email?: string;
      full_name?: string;
      platform?: string;
      old_handle?: string;
      requested_handle?: string;
    } | null;

    const result = await getDb().execute(
      sql`SELECT * FROM decide_handle_request(${requestId}::uuid, ${admin.admin.adminId}::uuid, ${approve}::boolean, ${note}::text, ${expectedHandle ?? null}::text)`,
    );
    const row = (result.rows?.[0] ?? {}) as {
      outcome?: string;
      old_handle?: string;
      new_handle?: string;
    };
    if (recipient?.email && recipient.full_name) {
      await sendEmailQuietly(
        handleRequestDecidedEmail({
          to: recipient.email,
          fullName: recipient.full_name,
          platform: String(recipient.platform),
          oldHandle: String(recipient.old_handle),
          requestedHandle: String(recipient.requested_handle),
          approved: approve,
          decisionNote: approve ? null : note,
          personalPage: personalPage(),
        }),
        `handle request ${approve ? "approval" : "rejection"}`,
      );
    }

    return NextResponse.json({
      ok: true,
      outcome: row.outcome ?? null,
      from: row.old_handle ?? null,
      to: row.new_handle ?? null,
    });
  } catch (error) {
    for (const [code, raise, message] of KNOWN) {
      if (isPgError(error, code, raise)) {
        return NextResponse.json({ ok: false, message }, { status: 400 });
      }
    }
    logError("admin/handle-requests", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
