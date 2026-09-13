import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirm that a social account belongs to the creator claiming it.
 *
 * Available to reviewers as well as owners. Checking a code on a public profile
 * is the ordinary business of reviewing, it is the same person already looking
 * at the post, and the controls that matter are the attribution and the audit
 * row rather than the role.
 *
 * The database is where the rule lives: it refuses a handle another creator has
 * already verified, and refuses an approval through an unverified one. This
 * route exists to turn those into sentences.
 */

const schema = z.object({
  handleId: z.string().uuid("That is not a handle."),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, string> = {
  P0901: "That handle no longer exists.",
  P0902:
    "Another creator has already verified that handle on this platform. If this one is the real owner, void the other enrolment first, which releases it.",
  P0401: "Only a signed-in admin can verify a handle.",
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;

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
      { ok: false, message: "Check the request." },
      { status: 400 },
    );
  }

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM verify_social_handle(${parsed.data.handleId}::uuid, ${admin.admin.adminId}::uuid)`,
    );
    const row = (result.rows?.[0] ?? {}) as {
      handle?: string;
      platform_name?: string;
    };

    return NextResponse.json({
      ok: true,
      handle: row.handle ?? null,
      platform: row.platform_name ?? null,
    });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;

    if (known) {
      return NextResponse.json({ ok: false, message: known }, { status: 400 });
    }

    logError("admin/verify-handle", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
