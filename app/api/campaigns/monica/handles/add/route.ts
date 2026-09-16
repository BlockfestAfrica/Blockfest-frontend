import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { currentCreator } from "@/lib/creator-session";
import { sameOrigin } from "@/lib/admin/request";
import { allowKey } from "@/lib/throttle";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { sendEmailQuietly } from "@/lib/email/client";
import { handleAddedEmail, personalPage } from "@/lib/email/templates";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A platform and a handle. Anything larger is not this request. */
const MAX_BODY_BYTES = 4 * 1024;

const schema = z.object({
  platform: z.enum(["x", "instagram", "tiktok"]),
  handle: z
    .string()
    .trim()
    .min(1, "Type your handle.")
    .max(41, "That is longer than any handle."),
});

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * Add a platform the creator did not register with.
 *
 * Every handle is optional at registration, so somebody who only had X that
 * day registered X alone. The ladder pays more for the same piece posted on
 * two or three platforms, and until now there was no way back: submitting
 * raised platform_not_registered, and the change flow raised
 * handle_not_found because there was nothing to change.
 *
 * Immediate rather than reviewed, unlike a handle change. Adding a platform
 * takes nothing from the creator's own record, the handle lands unverified
 * exactly as a registration handle does, and submitting still has to clear
 * wrong_account. Making them wait for a reviewer would cost them the week
 * the feature exists to let them enter.
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

  /* Three platforms exist, so a creator can do this at most twice in a
     campaign. Ten an hour leaves room for typos and none for a script. */
  if (!(await allowKey(`enrolment:${creator.enrolmentId}`, "handle-add", 10, 3600))) {
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

  const label =
    platformLabels[parsed.data.platform as CampaignPlatform] ??
    parsed.data.platform;

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM add_social_handle(${creator.enrolmentId}::uuid, ${parsed.data.platform}::platform, ${parsed.data.handle}::text)`,
    );
    const row = (result.rows?.[0] ?? {}) as { handle?: string };

    after(async () => {
      try {
        const who = await getDb().execute(sql`
          SELECT c.email, c.full_name
            FROM campaign_creators cc
            JOIN creators c ON c.id = cc.creator_id
           WHERE cc.id = ${creator.enrolmentId}::uuid
        `);
        const person = (who.rows?.[0] ?? null) as {
          email?: string;
          full_name?: string;
        } | null;
        if (person?.email) {
          await sendEmailQuietly(
            handleAddedEmail({
              to: person.email,
              fullName: person.full_name ?? creator.name,
              platformLabel: label,
              handle: String(row.handle ?? parsed.data.handle),
              personalPage: personalPage(),
            }),
            "handle added notice",
          );
        }
      } catch (error) {
        logError("campaigns/monica/handles/add notice", error);
      }
    });

    return NextResponse.json({ ok: true, handle: row.handle ?? null });
  } catch (error) {
    if (isPgError(error, "P0917", "handle_already_set")) {
      return fail(
        `You already have a ${label} handle on file. To correct it, use the change request instead.`,
        409,
      );
    }
    if (isPgError(error, "P0911", "handle_taken")) {
      return fail(
        `Another creator is already registered with that ${label} handle. If it is genuinely yours, write to us and a person will sort it out.`,
        409,
      );
    }
    if (isPgError(error, "P0903", "handle_invalid")) {
      return fail(
        "That does not look like a handle. Letters, numbers, dots and underscores only.",
      );
    }
    if (isPgError(error, "P0212", "enrolment_not_active")) {
      return fail("Your place in the campaign is not active.", 403);
    }
    logError("campaigns/monica/handles/add", error);
    return fail("Something went wrong at our end. Please try again.", 500);
  }
}
