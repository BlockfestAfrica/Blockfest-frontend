import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { isPgError, PG } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { CAMPAIGN_PLATFORMS } from "@/lib/campaigns";
import { sendEmailQuietly } from "@/lib/email/client";
import { handleCorrectedEmail, personalPage } from "@/lib/email/templates";
import { campaignCreators, creators } from "@/lib/db/client";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Correct a creator's registered handle.
 *
 * The creator-facing half of this fix names the mismatch and says to write in;
 * this is what the person answering that mail uses. It replaces a manual
 * database edit, which is the kind of step that gets done wrong at speed: the
 * handle changed and handle_normalized forgotten, after which the automatic
 * author check refuses the RIGHT account forever.
 *
 * Owners only, unlike the reviewer-open award and reissue routes. With
 * verification gone (0034), the registered handle IS the attribution, so an
 * interface that edits it can point a creator's identity at somebody else's
 * account. That power belongs with the role that also answers for prize money.
 */

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const schema = z.object({
  enrolmentId: z.string().uuid("That is not a creator."),
  platform: z.enum(CAMPAIGN_PLATFORMS as unknown as [string, ...string[]]),
  handle: z.string().trim().min(1, "Enter the corrected username.").max(120),
  reason: z
    .string()
    .trim()
    .min(1, "Say why. It is what a dispute is answered with.")
    .max(300),
});

/** SQLSTATE, the raise name it travels as on PGlite, and the sentence. */
const KNOWN: Array<[code: string, raise: string, message: string]> = [
  ["P0903", "handle_invalid", "That does not look like a username. Letters, numbers, dots and underscores only."],
  ["P0901", "handle_not_found", "That creator has no account registered on that platform."],
  ["P0201", "unknown_creator", "That creator does not exist."],
  ["P0502", "reason_required", "Say why. It is what a dispute is answered with."],
  ["P0401", "admin_required", "Only a signed-in admin can correct a handle."],
];

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok || !isOwner(admin.admin)) return FORBIDDEN;

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
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Check the correction.",
      },
      { status: 400 },
    );
  }

  const { enrolmentId, platform, handle, reason } = parsed.data;

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM correct_social_handle(${enrolmentId}::uuid, ${platform}::platform, ${handle}::text, ${admin.admin.adminId}::uuid, ${reason}::text)`,
    );
    const row = (result.rows?.[0] ?? {}) as {
      old_handle?: string;
      new_handle?: string;
    };

    /*
     * Tell the creator. Their registration changed under them, and what their
     * entries are checked against is a thing they must be able to dispute;
     * silence is how a wrong correction goes unnoticed until an entry is
     * refused for reasons they cannot see.
     */
    if (row.old_handle && row.new_handle) {
      const who = await getDb()
        .select({ email: creators.email, fullName: creators.fullName })
        .from(campaignCreators)
        .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
        .where(eq(campaignCreators.id, enrolmentId))
        .limit(1)
        .catch(() => []);
      const recipient = who[0];
      if (recipient) {
        await sendEmailQuietly(
          handleCorrectedEmail({
            to: recipient.email,
            fullName: recipient.fullName,
            platform,
            oldHandle: row.old_handle,
            newHandle: row.new_handle,
            personalPage: personalPage(),
          }),
          "handle correction notice",
        );
      }
    }

    return NextResponse.json({
      ok: true,
      from: row.old_handle ?? null,
      to: row.new_handle ?? null,
    });
  } catch (error) {
    for (const [code, raise, message] of KNOWN) {
      if (isPgError(error, code, raise)) {
        return NextResponse.json({ ok: false, message }, { status: 400 });
      }
    }

    logError("admin/correct-handle", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
