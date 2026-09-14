import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { currentCreator } from "@/lib/creator-session";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { allowKey } from "@/lib/throttle";
import {
  CAMPAIGN_PLATFORMS,
  platformLabels,
  type CampaignPlatform,
} from "@/lib/campaigns";
import { sendEmailQuietly } from "@/lib/email/client";
import {
  handleFixAckEmail,
  handleRequestFiledEmail,
  personalPage,
  siteUrl,
} from "@/lib/email/templates";
import { handlesForEnrolment } from "@/lib/creator-session";
import { CONTACT_EMAIL } from "@/lib/constants";

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
  // person. Keyed to the enrolment, not the address: Nigerian carriers put
  // very large numbers of subscribers behind one NAT IP, so a per-address
  // key both wrongly blocked co-located creators and let one of them spend
  // everybody's budget. The route has already authenticated, so the person
  // is known. Fails open like every other limit.
  if (!(await allowKey(`enrolment:${creator.enrolmentId}`, "handle-request", 10, 3600))) {
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

    /*
     * Tell the team. A request that sits unseen is a creator stuck for days,
     * since their entries keep being refused against the old handle until
     * somebody decides, and nobody camps on the People screen. Quietly: the
     * request is filed either way, and the console shows it regardless.
     */
    const current = await handlesForEnrolment(creator.enrolmentId).catch(
      () => [] as Awaited<ReturnType<typeof handlesForEnrolment>>,
    );
    const oldHandle =
      current.find((h) => h.platform === parsed.data.platform)?.handle ?? "unknown";
    await sendEmailQuietly(
      handleRequestFiledEmail({
        to: CONTACT_EMAIL,
        creatorName: creator.name,
        platform: parsed.data.platform,
        oldHandle,
        requestedHandle: parsed.data.handle.replace(/^@+/, "").toLowerCase(),
        reason: parsed.data.reason,
        /* From the configured site, not a literal: a hardcoded production
           URL in a preview's mail points the reviewer at the wrong console. */
        consoleUrl: `${siteUrl()}/admin/participants`,
      }),
      "handle request notification",
    );

    /*
     * And tell the creator it is filed. The gap between filing and deciding
     * is exactly when they retry the refused entry and conclude the site is
     * broken; the mail says hold that platform's entry instead. Fail-soft,
     * address read fresh from the enrolment.
     */
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
          handleFixAckEmail({
            to: person.email,
            fullName: person.full_name ?? creator.name,
            platformLabel:
              platformLabels[parsed.data.platform as CampaignPlatform],
            oldHandle,
            requestedHandle: parsed.data.handle.replace(/^@+/, "").toLowerCase(),
            personalPage: personalPage(),
          }),
          "handle request receipt",
        );
      }
    } catch (error) {
      logError("campaign/request-handle-fix receipt mail", error);
    }

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
