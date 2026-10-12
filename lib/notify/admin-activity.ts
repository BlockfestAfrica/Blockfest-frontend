import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { activeAdminEmails } from "@/lib/admin/recipients";
import { sendEmail } from "@/lib/email/client";
import { adminActivityEmail, rovvEntryAlertEmail, siteUrl } from "@/lib/email/templates";
import { allowKeyStrict } from "@/lib/throttle";
import { logError } from "@/lib/log";
import { MONICA_SLUG } from "@/lib/campaigns";
import { ROVV_SLUG } from "@/lib/rovv";

/**
 * Tell the team a creator registered or submitted.
 *
 * Per event, as asked. Two guards sit around it and neither changes what
 * gets reported.
 *
 * The first is a pace, per kind. Every notified event costs one send PER
 * ADMIN, because lib/email/client.ts sends to a single address with no cc
 * and no bcc, so three admins is three API calls. On the evening a stage
 * closes, eighty entries arriving would be two hundred and forty emails
 * describing a counter the console already shows. So a send claims a token
 * first, and anything inside that window is counted and reported by the
 * next mail as "N more happened" rather than sent separately or lost.
 * Nobody learns less; they learn it in fewer messages.
 *
 * The second is a daily ceiling, because nothing in this codebase counts
 * sends. The quota is shared with the creator mail carrying the personal
 * links people sign in with, and there is no password: exhausting it does
 * not degrade notifications, it locks creators out.
 *
 * ADMIN_ACTIVITY_ALERTS must be "on". Absent, this does nothing, so the
 * feature can be turned off without a deploy if it proves to be noise.
 */

const WINDOW_SECONDS = Number(process.env.ADMIN_ACTIVITY_WINDOW_SECONDS ?? 900);
const DAILY_MAX = Number(process.env.ADMIN_ACTIVITY_MAX_PER_DAY ?? 40);

function enabled(): boolean {
  return (process.env.ADMIN_ACTIVITY_ALERTS ?? "").trim() === "on";
}

/**
 * Events swallowed by the pace since the last alert, so this one says so.
 *
 * The pace and the counter share fixed windows (take_token, 0026), and the
 * first event of a window is the one that sends. So when an alert goes, its
 * own window holds only itself; what went unsent is in the last earlier
 * window that saw anything: all of it but its first, which was that window's
 * alert. Every older window was reported by the alert after it.
 *
 * This used to read the current window, and under the key alone rather than
 * the bucket allowKeyStrict writes ("seen:" plus the key), so it found
 * nothing and the "N more" line never appeared.
 */
async function countSuppressed(pace: string): Promise<number> {
  const rows = await getDb().execute(sql`
    SELECT hits FROM request_throttle
     WHERE bucket = ${`seen:admin-activity-seen:${pace}`}
       AND window_start < to_timestamp(
             floor(extract(epoch FROM now()) / ${WINDOW_SECONDS}::int) * ${WINDOW_SECONDS}::int
           )
     ORDER BY window_start DESC LIMIT 1
  `);
  const hits = Number((rows.rows?.[0] as { hits?: number } | undefined)?.hits ?? 1);
  return Math.max(0, hits - 1);
}

export async function notifyAdminsOfActivity(params: {
  /** rovv_entry: a new entry to Rovv's campaign (lib/rovv.ts), its own pace. */
  kind: "registration" | "submission" | "rovv_entry";
  who: string;
  platformLabel?: string;
  /** An admin's test entry (Rovv, 0074): its own pace, never a real one's. */
  test?: boolean;
}): Promise<void> {
  if (!enabled()) return;

  /* The pace key: per kind, and a test apart, so an owner trying the form
     never takes the slot the next real entry's alert needs. */
  const pace = params.test ? `${params.kind}:test` : params.kind;
  /* The daily ceiling: Monica's kinds share the bucket they always had; Rovv
     has its own, because its form is public and a busy (or hostile) Rovv
     day must never silence Monica's alerts. */
  const daily = params.kind === "rovv_entry" ? "admin-activity-rovv" : "admin-activity";

  try {
    /*
     * Counted before the pace check, so "and N more" is the real number of
     * events rather than the number that happened to arrive after a send.
     */
    await allowKeyStrict(`admin-activity-seen:${pace}`, "seen", 1_000_000, WINDOW_SECONDS);

    // take_token floors a limit of 0 up to 1, so this guard is what makes a
    // ceiling of zero actually mean zero.
    if (DAILY_MAX <= 0) return;

    if (!(await allowKeyStrict(`admin-activity:${pace}`, "pace", 1, WINDOW_SECONDS))) {
      return;
    }

    /* After the pace check, so the ceiling counts alerts SENT, as its name
       says. Before it, every paced-away event spent a token too, and a busy
       hour used up the day without sending anything. */
    if (!(await allowKeyStrict(daily, "daily", DAILY_MAX, 86_400))) {
      logError(
        "notify/admin-activity",
        new Error(`daily ceiling of ${DAILY_MAX} reached; alerts paused`),
      );
      return;
    }

    const suppressed = await countSuppressed(pace);

    let waiting: number | undefined;
    if (params.kind === "submission") {
      const rows = await getDb().execute(sql`
        SELECT count(*)::int AS n
          FROM submissions s
          JOIN challenge_entries ce ON ce.id = s.entry_id
          JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
          JOIN campaigns cp         ON cp.id = cc.campaign_id
         WHERE cp.slug = ${MONICA_SLUG} AND s.status = 'pending'
      `);
      waiting = Number((rows.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
    } else if (params.kind === "rovv_entry") {
      const rows = await getDb().execute(sql`
        SELECT count(*)::int AS n
          FROM rovv_entries e
          JOIN campaigns cp ON cp.id = e.campaign_id
         WHERE cp.slug = ${ROVV_SLUG} AND e.status = 'pending'
           AND e.is_test = ${Boolean(params.test)}
      `);
      waiting = Number((rows.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
    }

    for (const admin of await activeAdminEmails()) {
      const result = await sendEmail(
        params.kind === "rovv_entry"
          ? rovvEntryAlertEmail({
              to: admin.email,
              who: params.who,
              waiting,
              alsoSince: suppressed > 0 ? suppressed : undefined,
              consoleUrl: `${siteUrl()}/admin/rovv?status=${params.test ? "test" : "pending"}`,
            })
          : adminActivityEmail({
              to: admin.email,
              kind: params.kind,
              who: params.who,
              platformLabel: params.platformLabel,
              waiting,
              alsoSince: suppressed > 0 ? suppressed : undefined,
              consoleUrl: `${siteUrl()}/admin`,
            }),
      );
      if (!result.sent) {
        logError(
          "notify/admin-activity",
          new Error(`alert to an admin not sent: ${result.reason ?? "unknown"}`),
        );
      }
    }
  } catch (error) {
    // Never throws into a caller's after(): a failed internal alert must not
    // turn a creator's successful registration into an error.
    logError("notify/admin-activity", error);
  }
}
