import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { activeAdminEmails } from "@/lib/admin/recipients";
import { sendEmailQuietly } from "@/lib/email/client";
import { siteUrl, voteDomainBlockedEmail } from "@/lib/email/templates";
import { dateTime } from "@/lib/format";
import { logError } from "@/lib/log";
import { MONICA_SLUG } from "@/lib/campaigns";
import { autoEvidenceSentence } from "@/lib/vote-domain-copy";

/**
 * Tell the owners a voting domain was just blocked automatically.
 *
 * The verify route calls this from after(), on the one verify whose vote made
 * the engine block the domain (verify_vote reports auto_blocked), so each
 * block is mailed once. The voter's answer was already sent and is the same
 * bytes either way.
 *
 * The block is found by the voter's host, not by the key the route computed:
 * a block covers its domain and every subdomain, so this finds the block the
 * engine made even if it fell back from the key to the host. Nothing read
 * here is an address. The evidence is counts and the mail host, the count is
 * a count, and the times are two timestamps.
 *
 * Owners only. Reviewers can see the card, but a block is an owner's decision
 * to keep or lift, and every alert is one send per recipient on a mail quota
 * the creators' sign-in links share.
 *
 * Never throws: a failed alert must not turn a verified vote into an error.
 */
export async function notifyOwnersOfAutoBlock(params: {
  roundId: string;
  host: string;
}): Promise<void> {
  try {
    const found = await getDb().execute(sql`
      SELECT b.domain, b.reason, b.evidence,
             (SELECT count(*)::int
                FROM votes v
               WHERE v.round_id = ${params.roundId}::uuid
                 AND v.status = 'counted'
                 AND v.held_at IS NOT NULL
                 AND v.held_reason IN ('blocked', 'forwarder')
                 AND vote_domain_matches(split_part(v.voter_email_canonical, '@', 2), b.domain)
             ) AS held
        FROM vote_blocked_domains b
        JOIN campaigns c ON c.id = b.campaign_id
       WHERE c.slug = ${MONICA_SLUG}
         AND b.source = 'auto'
         AND b.lifted_at IS NULL
         AND vote_domain_matches(${params.host}::text, b.domain)
       ORDER BY b.created_at DESC
       LIMIT 1
    `);
    const row = found.rows?.[0] as
      | { domain?: string; reason?: string; evidence?: unknown; held?: number }
      | undefined;
    if (!row?.domain) return;

    let evidence: unknown = row.evidence;
    if (typeof evidence === "string") {
      try {
        evidence = JSON.parse(evidence);
      } catch {
        evidence = null;
      }
    }
    const e = (evidence ?? {}) as Record<string, unknown>;
    const at = (value: unknown) => {
      const when = new Date(String(value ?? ""));
      return Number.isNaN(when.getTime()) ? undefined : dateTime(when);
    };

    for (const owner of await activeAdminEmails("owner")) {
      await sendEmailQuietly(
        voteDomainBlockedEmail({
          to: owner.email,
          domain: row.domain,
          evidence: autoEvidenceSentence(evidence) ?? String(row.reason ?? ""),
          held: Number(row.held ?? 0),
          firstAtLagos: at(e.first_at),
          lastAtLagos: at(e.last_at),
          consoleUrl: `${siteUrl()}/admin/winners#blocked-domains`,
        }),
        "domain auto-block alert",
      );
    }
  } catch (error) {
    logError("notify/domain-auto-block", error);
  }
}
