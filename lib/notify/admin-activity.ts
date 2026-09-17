import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { activeAdminEmails } from "@/lib/admin/recipients";
import { sendEmail } from "@/lib/email/client";
import { adminActivityEmail, siteUrl } from "@/lib/email/templates";
import { allowKeyStrict } from "@/lib/throttle";
import { logError } from "@/lib/log";
import { MONICA_SLUG } from "@/lib/campaigns";

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

/** Events swallowed by the pace window, per kind, so the next mail says so. */
async function countSuppressed(kind: string): Promise<number> {
  const rows = await getDb().execute(sql`
    SELECT hits FROM request_throttle
     WHERE bucket = ${`admin-activity-seen:${kind}`}
     ORDER BY window_start DESC LIMIT 1
  `);
  return Number((rows.rows?.[0] as { hits?: number } | undefined)?.hits ?? 1) - 1;
}

export async function notifyAdminsOfActivity(params: {
  kind: "registration" | "submission";
  who: string;
  platformLabel?: string;
}): Promise<void> {
  if (!enabled()) return;

  try {
    /*
     * Counted before the pace check, so "and N more" is the real number of
     * events rather than the number that happened to arrive after a send.
     */
    await allowKeyStrict(
      `admin-activity-seen:${params.kind}`,
      "seen",
      1_000_000,
      WINDOW_SECONDS,
    );

    // take_token floors a limit of 0 up to 1, so this guard is what makes a
    // ceiling of zero actually mean zero.
    if (DAILY_MAX <= 0) return;

    if (!(await allowKeyStrict("admin-activity", "daily", DAILY_MAX, 86_400))) {
      logError(
        "notify/admin-activity",
        new Error(`daily ceiling of ${DAILY_MAX} reached; alerts paused`),
      );
      return;
    }

    if (
      !(await allowKeyStrict(`admin-activity:${params.kind}`, "pace", 1, WINDOW_SECONDS))
    ) {
      return;
    }

    const suppressed = await countSuppressed(params.kind);

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
    }

    for (const admin of await activeAdminEmails()) {
      const result = await sendEmail(
        adminActivityEmail({
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
