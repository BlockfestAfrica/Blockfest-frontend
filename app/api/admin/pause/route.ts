import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { logError } from "@/lib/log";
import { isPgError, PG, pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { MONICA_SLUG } from "@/lib/campaigns";
import { closingAt } from "@/lib/format";
import { sendEmailQuietly } from "@/lib/email/client";
import { personalPage, resumedEmail } from "@/lib/email/templates";
import { sendBulkCopy } from "@/lib/email/copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pause or resume the campaign.
 *
 * Owners only. Pausing stops every creator entering, which is a bigger action
 * than approving one entry, and the admin table already distinguishes owners
 * from reviewers. This is the first place that distinction is used, and the
 * reason it exists.
 *
 * A pause needs a reason and the database refuses one without it. The reason is
 * shown to creators verbatim, because the commonest response to a silent
 * failure is to try again and then complain, and somebody has to answer them.
 */

const pauseSchema = z.object({
  paused: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  const parsed = pauseSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Check the request." },
      { status: 400 },
    );
  }

  const { paused, reason } = parsed.data;

  if (paused && !reason) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "A pause needs a reason. Creators see it, and it is the difference between being told and being stonewalled.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await db().execute(
      sql`SELECT * FROM set_campaign_pause(${MONICA_SLUG}, ${paused}, ${reason ?? null}, ${admin.admin.adminId}::uuid)`,
    );
    const row = (result.rows?.[0] ?? {}) as { paused?: boolean; reason?: string };

    /*
     * Resuming is the campaign moving, so the campaign says so.
     *
     * The pause panel tells creators to come back and paste their link
     * when this clears, which is an instruction to poll a page that gives
     * no signal, and the people most harmed by it are the ones who obeyed
     * and waited. Only on resume, and to every active creator in the
     * campaign, because a pause stops everyone and nothing here records who
     * was waiting. The console asks before resuming for that reason. After
     * the response, fail-soft.
     */
    if (!paused && Boolean(row.paused) === false) {
      after(async () => {
        try {
          const open = await db().execute(sql`
            SELECT ch.ends_at
              FROM challenges ch
              JOIN campaigns c ON c.id = ch.campaign_id
             WHERE c.slug = ${MONICA_SLUG}
               AND ch.status = 'active'
               AND ch.starts_at <= now() AND ch.ends_at > now()
             LIMIT 1
          `);
          const closesAt = (open.rows?.[0] as { ends_at?: string } | undefined)
            ?.ends_at;

          const waiting = await db().execute(sql`
            SELECT c.email, c.full_name
              FROM campaign_creators cc
              JOIN creators c ON c.id = cc.creator_id
              JOIN campaigns cm ON cm.id = cc.campaign_id
             WHERE cm.slug = ${MONICA_SLUG}
               AND COALESCE(cc.status, 'active') = 'active'
          `);

          const people = (waiting.rows ?? [])
            .map((person) => person as { email?: string; full_name?: string })
            .filter((person): person is { email: string; full_name?: string } =>
              Boolean(person.email),
            );
          const mail = (person: { email: string; full_name?: string }) =>
            resumedEmail({
              to: person.email,
              fullName: person.full_name ?? "",
              closesAtLagos: closesAt ? closingAt(String(closesAt)) : null,
              personalPage: personalPage(),
            });
          // The owner's copy of what went out (lib/email/copy.ts).
          await sendBulkCopy(people[0] ? mail(people[0]) : null, people.length, "resume notice");
          for (const person of people) {
            await sendEmailQuietly(mail(person), "resume notice");
          }
        } catch (error) {
          logError("admin/pause resume notice", error);
        }
      });
    }

    return NextResponse.json({
      ok: true,
      paused: Boolean(row.paused),
      reason: row.reason ?? null,
    });
  } catch (error) {
    if (isPgError(error, PG.CAMPAIGN_NOT_FOUND, "campaign_not_found")) {
      return NextResponse.json(
        { ok: false, message: "That campaign does not exist." },
        { status: 404 },
      );
    }
    if (pgErrorMessage(error).includes("reason_required")) {
      return NextResponse.json(
        { ok: false, message: "A pause needs a reason." },
        { status: 400 },
      );
    }

    logError("admin/pause", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}

function db() {
  return getDb();
}
