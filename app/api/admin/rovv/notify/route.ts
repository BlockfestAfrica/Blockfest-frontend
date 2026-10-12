import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { sameOrigin, throttleKey } from "@/lib/admin/request";
import {
  claimRovvNotice,
  markRovvNotified,
  rovvCounts,
  releaseRovvNotice,
  rovvWinnersToNotify,
  type RovvWinnerToNotify,
} from "@/lib/admin/rovv";
import { allowKeyStrict } from "@/lib/throttle";
import { sendEmail } from "@/lib/email/client";
import { sendBulkCopy } from "@/lib/email/copy";
import { rovvWinnerEmail } from "@/lib/email/templates";
import { ROVV, ROVV_SLUG } from "@/lib/rovv";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Twenty sends at most, a few at a time; the budget is the announce routes'. */
export const maxDuration = 300;

/**
 * Email the Rovv winners who have not been told yet.
 *
 * Owners only. notified_at is the ledger: it is stamped per winner, only
 * when that mail reports sent, so pressing again reaches the ones that
 * failed or were picked since and nobody twice. Fewer than twenty is
 * allowed; the console says how many will go before the owner confirms.
 *
 * Stamping also publishes: the campaign page lists winners who have been
 * emailed (lib/rovv-winners.ts), so nobody learns they won from a
 * screenshot.
 */

/** Sends started together, as the announce routes do. */
const BATCH = 4;

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  /*
   * Not while entries are open. Winners can be picked as the entries come
   * in, but emailing one also publishes them on the campaign page, and a
   * winners list up before the close tells everyone still entering that the
   * prizes are gone. Checked before the throttle, so a refused press spends
   * nothing.
   */
  if (Date.now() <= new Date(ROVV.closesAt).getTime()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Entries are open until 11:59 PM on Sunday 18 October. Pick winners any time; email them once entries close.",
      },
      { status: 409 },
    );
  }

  // Strict, because what is rationed is outbound mail (lib/throttle.ts).
  if (!(await allowKeyStrict(throttleKey(request), "admin-rovv-notify", 10, 3600))) {
    return NextResponse.json(
      { ok: false, message: "That has been pressed a lot. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  try {
    const untold = await rovvWinnersToNotify(admin.admin);

    if (untold.length === 0) {
      const counts = await rovvCounts(admin.admin);
      return NextResponse.json(
        {
          ok: false,
          message:
            counts.winners === 0
              ? "Nobody has been picked yet. Pick the winners first, then email them."
              : counts.sending > 0
                ? "Those winners are being emailed by another press right now. Reload in a minute to see who was told."
                : "Every winner picked so far has already been emailed.",
        },
        { status: 409 },
      );
    }

    /* Claimed before the copy and the first send, and held until each mail
       is stamped or fails, so a second press while this one is still sending
       skips them instead of mailing them again (claimRovvNotice). */
    const claimed: RovvWinnerToNotify[] = [];
    for (const winner of untold) {
      if (await claimRovvNotice(admin.admin, winner)) claimed.push(winner);
    }
    if (claimed.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Those winners are being emailed by another press right now. Reload in a minute to see who was told.",
        },
        { status: 409 },
      );
    }

    const mail = (winner: RovvWinnerToNotify) =>
      rovvWinnerEmail({ to: winner.email, fullName: winner.fullName, tiktokUrl: winner.tiktokUrl });

    // The owner's copy of what went out (lib/email/copy.ts), before the batch.
    await sendBulkCopy(mail(claimed[0]), claimed.length, "rovv winner notice");

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < claimed.length; i += BATCH) {
      const results = await Promise.allSettled(
        claimed.slice(i, i + BATCH).map(async (winner) => {
          // sendEmail, not the quiet one: only a mail that reports sent is stamped.
          const result = await sendEmail(mail(winner));
          if (!result.sent) {
            // Let them go, so the next press retries them.
            await releaseRovvNotice(admin.admin, winner.id).catch((error) =>
              logError("admin/rovv notify release", error),
            );
            return false;
          }
          /* Stamped as each one leaves, so a batch cut short keeps what it
             did. The claim stops an unpick meanwhile, so the stamp finding
             nobody to stamp should not happen; if it does, the winner was
             told and the log is where that is recorded. */
          const stamped = await markRovvNotified(admin.admin, winner.id).catch((error) => {
            logError("admin/rovv notify stamp", error);
            return true;
          });
          if (!stamped) {
            logError("admin/rovv notify stamp", new Error(`winner notice left for ${winner.id} but nothing was stamped`));
          }
          return true;
        }),
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) sent += 1;
        else failed += 1;
      }
    }

    if (failed > 0) {
      logError("admin/rovv notify", new Error(`${failed} of ${claimed.length} winner notices not sent`));
    }

    await getDb()
      .execute(
        sql`INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, after)
            VALUES ((SELECT id FROM campaigns WHERE slug = ${ROVV_SLUG}),
                    ${admin.admin.adminId}::uuid, 'rovv.winners_notified', 'campaign',
                    ${JSON.stringify({ sent, failed })}::jsonb)`,
      )
      .catch((error) => logError("admin/rovv notify audit", error));

    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    logError("admin/rovv notify", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
