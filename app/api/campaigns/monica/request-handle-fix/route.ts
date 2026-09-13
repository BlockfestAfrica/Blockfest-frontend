import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { currentCreator } from "@/lib/creator-session";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { allow } from "@/lib/throttle";
import { CAMPAIGN_PLATFORMS } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A creator asks for their registered handle to be corrected.
 *
 * Filing changes nothing. The request and the creator's reason land as a row
 * an admin reads in the console, and the handle moves only when an admin
 * approves it there, through the same audited function a direct fix uses.
 * That is the owner's requirement stated as architecture: the interface can
 * carry the request, and only a person can carry the change.
 */

const schema = z.object({
  platform: z.enum(CAMPAIGN_PLATFORMS as unknown as [string, ...string[]]),
  handle: z.string().trim().min(1, "Enter the correct username.").max(120),
  reason: z
    .string()
    .trim()
    .min(1, "Say what went wrong, so whoever reviews this can check it.")
    .max(300),
});

const KNOWN: Array<[code: string, raise: string, message: string]> = [
  ["P0903", "handle_invalid", "That does not look like a username. Letters, numbers, dots and underscores only."],
  ["P0905", "handle_unchanged", "That is already the username on your registration."],
  ["P0901", "handle_not_found", "You did not register an account on that platform."],
  ["P0212", "enrolment_not_active", "This account cannot enter the campaign, so there is nothing to correct."],
  ["P0502", "reason_required", "Say what went wrong, so whoever reviews this can check it."],
];

export async function POST(request: NextRequest) {
  const creator = await currentCreator();
  if (!creator) {
    return NextResponse.json(
      { ok: false, message: "We do not know who you are. Open your personal link again." },
      { status: 401 },
    );
  }

  // A correction is filed once or twice in a campaign; ten an hour is a
  // person, and a script gains nothing here anyway since filing changes
  // nothing. Fails open like every other limit.
  if (!(await allow(request, "handle-request", 10, 3600))) {
    return NextResponse.json(
      { ok: false, message: "That is a lot of requests. Wait a while and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  try {
    await getDb().execute(
      sql`SELECT * FROM request_handle_change(${creator.enrolmentId}::uuid, ${parsed.data.platform}::platform, ${parsed.data.handle}::text, ${parsed.data.reason}::text)`,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    for (const [code, raise, message] of KNOWN) {
      if (isPgError(error, code, raise)) {
        return NextResponse.json({ ok: false, message }, { status: 400 });
      }
    }
    logError("campaign/request-handle-fix", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end. Please try again." },
      { status: 500 },
    );
  }
}
