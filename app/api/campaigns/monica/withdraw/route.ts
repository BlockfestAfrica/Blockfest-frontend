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
import { personalPage, siteUrl, withdrawnEmail } from "@/lib/email/templates";
import { closingAt } from "@/lib/format";
import {
  MONICA_SLUG,
  monicaRoutes,
  platformLabels,
  type CampaignPlatform,
} from "@/lib/campaigns";

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
  /* Ten an hour, not thirty. Taking an entry back is something that
     happens once or twice in a campaign, and every withdrawal now mails
     the creator, so a submit-withdraw loop would otherwise be a way to
     make the campaign mail somebody repeatedly. */
  if (!(await allowKey(`enrolment:${creator.enrolmentId}`, "withdraw", 10, 3600))) {
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
    /*
     * The week this entry belongs to, read before the row goes.
     *
     * The mail used to take its week from whichever challenge was open at
     * the time, which is not the same question. Stage 1 closes 24 September
     * and stage 2 opens on the 28th, so across the whole results-night
     * weekend nothing is open and every withdrawal announced itself as
     * "your week 0 entry" - to creators whose real week 1 entries are
     * sitting in the review queue, which is exactly who withdraws then.
     *
     * Scoped to the enrolment like the withdrawal itself, so this cannot
     * read the week of somebody else's submission, and only used when the
     * withdrawal actually succeeded.
     */
    const belongsTo = await getDb().execute(sql`
      SELECT ch.week_no
        FROM submissions sub
        JOIN challenge_entries ce ON ce.id = sub.entry_id
        JOIN challenges ch        ON ch.id = ce.challenge_id
       WHERE sub.id = ${parsed.data.submissionId}::uuid
         AND ce.campaign_creator_id = ${creator.enrolmentId}::uuid
    `);
    const entryWeek = Number(
      (belongsTo.rows?.[0] as { week_no?: number } | undefined)?.week_no ?? 0,
    );

    const result = await getDb().execute(
      sql`SELECT * FROM withdraw_submission(${creator.enrolmentId}::uuid, ${parsed.data.submissionId}::uuid)`,
    );
    const row = (result.rows?.[0] ?? {}) as { platform?: string; url?: string };

    /*
     * Announced, always, including when the creator did it themselves.
     *
     * This feature hands out a new power: before it, somebody holding a
     * stolen link could only add a submission, and the engine refuses a
     * post that is not from the registered handle. Removing a pending
     * entry is a quieter and more damaging thing, so it cannot be
     * silent. A receipt nobody needed costs a glance; a silent deletion
     * costs a week. After the response and fail-soft, like every other
     * creator mail.
     */
    after(async () => {
      try {
        /*
         * Two reads, not one join. Joining the open challenge to the
         * creator meant no open week produced no row at all, so a
         * withdrawal outside a live window would have sent nothing:
         * silence in exactly the case this mail exists to prevent.
         */
        const who = await getDb().execute(sql`
          SELECT c.email, c.full_name
            FROM campaign_creators cc
            JOIN creators c ON c.id = cc.creator_id
           WHERE cc.id = ${creator.enrolmentId}::uuid
        `);
        /* Only for the deadline. Which week the entry belonged to is
           answered above, by the entry, not by the calendar. */
        const open = await getDb().execute(sql`
          SELECT ch.ends_at
            FROM challenges ch
            JOIN campaigns cp ON cp.id = ch.campaign_id
           WHERE cp.slug = ${MONICA_SLUG}
             AND ch.status = 'active'
             AND ch.starts_at <= now() AND ch.ends_at > now()
           LIMIT 1
        `);
        const person = (who.rows?.[0] ?? null) as {
          email?: string;
          full_name?: string;
        } | null;
        const week = (open.rows?.[0] ?? null) as {
          ends_at?: string;
        } | null;
        if (person?.email && row.url) {
          await sendEmailQuietly(
            withdrawnEmail({
              to: person.email,
              fullName: person.full_name ?? creator.name,
              platformLabel:
                platformLabels[row.platform as CampaignPlatform] ??
                String(row.platform ?? ""),
              weekNo: entryWeek,
              url: row.url,
              closesAtLagos: week?.ends_at ? closingAt(String(week.ends_at)) : null,
              personalPage: personalPage(),
              recoverUrl: `${siteUrl()}${monicaRoutes.recover}`,
            }),
            "withdrawal notice",
          );
        }
      } catch (error) {
        logError("campaigns/monica/withdraw notice", error);
      }
    });

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
