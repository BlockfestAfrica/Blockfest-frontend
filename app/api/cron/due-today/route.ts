import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { DUE_TODAY_ACTION, dueItems, loadDueFacts } from "@/lib/admin/due-today";
import { MONICA_SLUG } from "@/lib/campaigns";
import { dayDate } from "@/lib/format";
import { logError } from "@/lib/log";
import { sendEmail } from "@/lib/email/client";
import { ownerDueTodayEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The morning list: called once a day by the scheduled function in
 * netlify/functions/due-today.mts, never by a browser.
 *
 * Works out what needs a person on the campaign today (lib/admin/due-today.ts)
 * and, if anything does, emails one list to DUE_TODAY_TO (comma separated)
 * when that is set, otherwise to every active owner. Nothing here goes to
 * creators: every send to them stays a button an owner presses.
 *
 * Guarded by CRON_SECRET in the Authorization header; unset, it refuses. One
 * email per Lagos day at most, held by an audit row claimed before sending,
 * so a retried schedule does not send twice. ?dry=1 returns the list without
 * sending or claiming, for checking what it would say.
 */

function authorised(request: NextRequest): boolean | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function POST(request: NextRequest) {
  const ok = authorised(request);
  if (ok === null) {
    return NextResponse.json({ ok: false, message: "Not configured." }, { status: 503 });
  }
  if (!ok) {
    return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });
  }

  try {
    const now = Date.now();
    const items = dueItems(await loadDueFacts(), now);
    if (request.nextUrl.searchParams.get("dry") === "1" || items.length === 0) {
      return NextResponse.json({ ok: true, items, sent: 0 });
    }

    const db = getDb();
    const campaign = (
      await db.execute(sql`SELECT id FROM campaigns WHERE slug = ${MONICA_SLUG}`)
    ).rows?.[0] as { id?: string } | undefined;
    if (!campaign?.id) {
      return NextResponse.json({ ok: false, message: "No campaign." }, { status: 404 });
    }

    /* One per Lagos day: the key is the date, claimed before sending. */
    const day = new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10);
    const claimed = await db.execute(sql`
      INSERT INTO audit_log (id, campaign_id, actor_admin_id, action, entity_type, entity_id, after)
      VALUES (md5(${`${DUE_TODAY_ACTION}:`} || ${day})::uuid, ${campaign.id}::uuid, NULL,
              ${DUE_TODAY_ACTION}, 'campaign', ${campaign.id}::uuid,
              ${JSON.stringify({ day, items: items.length, sent: 0, status: "started" })}::jsonb)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);
    const claimId = (claimed.rows?.[0] as { id?: string } | undefined)?.id;
    if (!claimId) {
      return NextResponse.json({ ok: true, items, sent: 0, skipped: "already sent today" });
    }

    /* Named people if the team set them (the address lives in Netlify, not
       here: the repository is public), otherwise every active owner. */
    const named = (process.env.DUE_TODAY_TO ?? "")
      .split(",")
      .map((address) => address.trim())
      .filter((address) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));
    const recipients = named.length
      ? named
      : (
          (
            await db.execute(sql`
              SELECT email FROM admin_users WHERE role = 'owner' AND is_active
            `)
          ).rows as { email?: string }[]
        )
          .map((row) => row.email)
          .filter((email): email is string => Boolean(email));
    const dayLabel = dayDate(new Date(now));
    let sent = 0;
    let failed = 0;
    for (const to of recipients) {
      const result = await sendEmail(ownerDueTodayEmail({ to, dayLabel, items }));
      if (result.sent) sent += 1;
      else failed += 1;
    }

    await db.execute(sql`
      UPDATE audit_log
         SET after = ${JSON.stringify({ day, items: items.length, sent, failed, status: "finished" })}::jsonb
       WHERE id = ${claimId}::uuid
    `);
    return NextResponse.json({ ok: true, items, sent, failed });
  } catch (error) {
    logError("cron/due-today", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
