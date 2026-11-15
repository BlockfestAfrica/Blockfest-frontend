import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin, throttleKey } from "@/lib/admin/request";
import {
  CREATOR_CHALLENGE,
  broadcastCounts,
  broadcastRecipients,
  claimBroadcast,
  markBroadcastSent,
  releaseBroadcast,
} from "@/lib/admin/broadcast";
import { allowKeyStrict } from "@/lib/throttle";
import { sendEmail } from "@/lib/email/client";
import { sendBulkCopy } from "@/lib/email/copy";
import { creatorChallengeEmail } from "@/lib/email/templates";
import { newStopToken, SAMPLE_STOP_TOKEN, stopEmailsUrl } from "@/lib/email-stop";
import { MONICA_SLUG } from "@/lib/campaigns";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Monica's Creator Challenge email (lib/admin/broadcast.ts, 0076). Owners
 * only.
 *
 * "test" sends it to the signed-in owner and nobody else, so the real mail
 * can be read in a real inbox before anybody gets it. Its stop link is the
 * sample one, so pressing it changes nothing.
 *
 * "send" sends it to the creators who said yes to future campaigns, the
 * ROVV results email's way: each recipient claimed just before their mail
 * and the claim kept only if it left, so a second press carries on from
 * where the first stopped and nobody gets it twice. A press sends at most
 * PER_PRESS and starts no batch after BUDGET_MS; the console presses again
 * for the rest. The owner's copy goes once, on the press that starts it.
 */
const schema = z.object({ mode: z.enum(["test", "send"]) });

const BATCH = 4;
const PER_PRESS = 300;

/* Netlify ends a function at the plan's own limit, which may be far under
   maxDuration (assume about 60 seconds). See app/api/admin/rovv/results. */
const BUDGET_MS = 35_000;

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;
  // From the request's start: the platform's clock does not wait for ours.
  const stopAt = Date.now() + BUDGET_MS;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });
  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Check the request." }, { status: 400 });

  try {
    if (parsed.data.mode === "test") {
      if (!(await allowKeyStrict(throttleKey(request), "admin-broadcast-test", 10, 3600))) {
        return NextResponse.json(
          { ok: false, message: "That has been pressed a lot. Wait a few minutes and try again." },
          { status: 429 },
        );
      }
      const mail = creatorChallengeEmail({
        to: admin.admin.email,
        fullName: "",
        stopUrl: stopEmailsUrl(SAMPLE_STOP_TOKEN),
      });
      const result = await sendEmail({ ...mail, toName: undefined, subject: `[Test] ${mail.subject}` });
      if (!result.sent) {
        return NextResponse.json(
          { ok: false, message: `The test did not send (${result.reason ?? "unknown"}).` },
          { status: 502 },
        );
      }
      return NextResponse.json({ ok: true, sentTo: admin.admin.email });
    }

    if (!(await allowKeyStrict(throttleKey(request), "admin-broadcast-send", 40, 3600))) {
      return NextResponse.json(
        { ok: false, message: "That has been pressed a lot. Wait a few minutes and try again." },
        { status: 429 },
      );
    }

    const counts = await broadcastCounts(admin.admin, CREATOR_CHALLENGE);
    const recipients = await broadcastRecipients(admin.admin, CREATOR_CHALLENGE, PER_PRESS);
    if (recipients.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            counts.left > 0
              ? "Another press is sending the rest right now. Wait a few minutes, then reload."
              : "Everybody it is for has had it already.",
        },
        { status: 409 },
      );
    }

    // The owner's copy, once, before the first creator's.
    if (counts.sent === 0) {
      await sendBulkCopy(
        creatorChallengeEmail({
          to: recipients[0].email,
          fullName: recipients[0].fullName,
          stopUrl: stopEmailsUrl(SAMPLE_STOP_TOKEN),
        }),
        counts.left,
        "creator challenge",
      );
    }

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < recipients.length; i += BATCH) {
      // Out of time: the rest are unclaimed, so the next press finds them.
      if (Date.now() >= stopAt) break;
      const results = await Promise.allSettled(
        recipients.slice(i, i + BATCH).map(async (person) => {
          const stop = newStopToken();
          if (!(await claimBroadcast(admin.admin, CREATOR_CHALLENGE, person.id, stop.hash))) {
            return "skipped" as const;
          }
          const result = await sendEmail(
            creatorChallengeEmail({ to: person.email, fullName: person.fullName, stopUrl: stopEmailsUrl(stop.token) }),
          );
          if (!result.sent) {
            await releaseBroadcast(admin.admin, CREATOR_CHALLENGE, person.id).catch((error) =>
              logError("admin/broadcast release", error),
            );
            return "failed" as const;
          }
          await markBroadcastSent(admin.admin, CREATOR_CHALLENGE, person.id);
          return "sent" as const;
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value === "sent") sent += 1;
        else if (r.status === "rejected" || r.value === "failed") failed += 1;
      }
    }

    await getDb()
      .execute(
        sql`INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, after)
            VALUES ((SELECT id FROM campaigns WHERE slug = ${MONICA_SLUG}),
                    ${admin.admin.adminId}::uuid, 'broadcast.sent', 'campaign',
                    ${JSON.stringify({ broadcast: CREATOR_CHALLENGE, sent, failed })}::jsonb)`,
      )
      .catch((error) => logError("admin/broadcast audit", error));

    const left = Math.max(0, counts.left - sent);
    return NextResponse.json({ ok: true, sent, failed, left });
  } catch (error) {
    logError("admin/broadcast", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
