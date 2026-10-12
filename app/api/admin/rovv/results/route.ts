import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { sameOrigin, throttleKey } from "@/lib/admin/request";
import {
  claimRovvResults,
  markRovvResultsSent,
  releaseRovvResults,
  rovvCounts,
  rovvResultsRecipients,
} from "@/lib/admin/rovv";
import { allowKeyStrict } from "@/lib/throttle";
import { sendEmail } from "@/lib/email/client";
import { sendBulkCopy } from "@/lib/email/copy";
import { rovvResultsEmail } from "@/lib/email/templates";
import { ROVV_SLUG } from "@/lib/rovv";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * "The winners are announced", to every real entrant who did not win and was
 * not ruled out (0075). Owners only, and only once every picked winner has
 * been emailed: before that it would announce a list still being written.
 *
 * Each recipient is claimed before their mail and the claim kept only if it
 * left, so a second press carries on from where the first stopped and nobody
 * gets it twice. A press sends at most PER_PRESS; the console says to press
 * again for the rest. The owner's copy goes first (lib/email/copy.ts).
 */
const BATCH = 4;
const PER_PRESS = 300;

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  try {
    const counts = await rovvCounts(admin.admin);
    if (counts.notified === 0 || counts.notified < counts.winners) {
      return NextResponse.json(
        { ok: false, message: "Email every picked winner first. The results go out once the winners have all been told." },
        { status: 409 },
      );
    }

    if (!(await allowKeyStrict(throttleKey(request), "admin-rovv-results", 10, 3600))) {
      return NextResponse.json(
        { ok: false, message: "That has been pressed a lot. Wait a few minutes and try again." },
        { status: 429 },
      );
    }

    const recipients = await rovvResultsRecipients(admin.admin, PER_PRESS);
    if (recipients.length === 0) {
      return NextResponse.json({ ok: false, message: "Everybody has had the results email already." }, { status: 409 });
    }

    // The owner's copy, before anyone's.
    await sendBulkCopy(
      rovvResultsEmail({ to: recipients[0].email, fullName: recipients[0].fullName }),
      recipients.length,
      "rovv results",
    );

    /* Claimed a batch at a time, just before each batch is sent, and marked
       sent only for a mail that left: a press cut short leaves at most one
       batch claimed, and those claims lapse, so nobody is stranded. */
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const results = await Promise.allSettled(
        recipients.slice(i, i + BATCH).map(async (person) => {
          if (!(await claimRovvResults(admin.admin, person.id))) return "skipped" as const;
          const result = await sendEmail(rovvResultsEmail({ to: person.email, fullName: person.fullName }));
          if (!result.sent) {
            await releaseRovvResults(admin.admin, person.id).catch((error) => logError("admin/rovv results release", error));
            return "failed" as const;
          }
          await markRovvResultsSent(admin.admin, person.id);
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
            VALUES ((SELECT id FROM campaigns WHERE slug = ${ROVV_SLUG}),
                    ${admin.admin.adminId}::uuid, 'rovv.results_sent', 'campaign',
                    ${JSON.stringify({ sent, failed })}::jsonb)`,
      )
      .catch((error) => logError("admin/rovv results audit", error));

    const left = Math.max(0, counts.resultsToSend - sent);
    return NextResponse.json({ ok: true, sent, failed, left });
  } catch (error) {
    logError("admin/rovv results", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
