import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { currentCreator } from "@/lib/creator-session";
import { sameOrigin } from "@/lib/admin/request";
import { allowKey } from "@/lib/throttle";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** An id. Anything larger is not a withdrawal. */
const MAX_BODY_BYTES = 4 * 1024;

const schema = z.object({
  submissionId: z.string().uuid("That is not a submission."),
});

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * Take back a submission nobody has reviewed yet.
 *
 * The receipt mail has told creators for weeks to "submit the right one"
 * if the link was wrong, and the partial unique index made that
 * impossible while the first submission sat pending. This is the missing
 * half of that sentence.
 *
 * It is also the creator's own response to a stolen link. The engine
 * already refuses a post that does not come from their registered handle,
 * and every entry is reviewed before it scores, but until now the person
 * who received a receipt for something they did not send could only write
 * to support and wait. Identity comes from the session cookie and the
 * enrolment is passed into the WHERE clause, so there is no version of
 * this where somebody withdraws another creator's work.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail("Not allowed.", 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return fail("We could not read that. Please try again.", 415);
  }

  const creator = await currentCreator();
  if (!creator) {
    return fail(
      "We do not know who you are. Open your personal link and try again.",
      401,
    );
  }

  // Keyed to the enrolment, like the submit route: carrier NAT means an
  // address is a crowd, and the person is already known here.
  if (!(await allowKey(`enrolment:${creator.enrolmentId}`, "withdraw", 30, 3600))) {
    return fail("That is a lot of changes at once. Wait a moment.", 429);
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail("That request is too large.", 413);

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail("That request is too large.", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("We could not read that. Please try again.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the request.");
  }

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM withdraw_submission(${creator.enrolmentId}::uuid, ${parsed.data.submissionId}::uuid)`,
    );
    const row = (result.rows?.[0] ?? {}) as { platform?: string };
    return NextResponse.json({ ok: true, platform: row.platform ?? null });
  } catch (error) {
    if (isPgError(error, "P0912", "already_reviewed")) {
      return fail(
        "That entry has already been reviewed, so it cannot be taken back. Write to us if it is wrong and a person will sort it out.",
        409,
      );
    }
    if (isPgError(error, "P0002", "submission_not_found")) {
      return fail("That entry is not there any more. Reload the page.", 404);
    }
    logError("campaigns/monica/withdraw", error);
    return fail("Something went wrong at our end. Please try again.", 500);
  }
}
