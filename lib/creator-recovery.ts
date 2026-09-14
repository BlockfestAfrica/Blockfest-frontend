import "server-only";
import { and, eq, gt } from "drizzle-orm";
import {
  auditLog,
  campaignCreators,
  campaigns,
  creators,
  getDb,
} from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import { canonicalEmail } from "@/lib/campaign-registration";
import {
  hashAccessToken,
  looksLikeAccessToken,
  newAccessToken,
  RECOVERY_TOKEN_MAX_AGE_SECONDS,
} from "@/lib/creator-access";

/**
 * Self-service link recovery. Successor to #78, closes #206.
 *
 * #78 made clicking the registration link a two-step affair so a link opened
 * by a mail client's prefetcher, or forwarded into a group chat, could not
 * sign anybody in on its own. The gap it left standing: a creator who lost
 * that link entirely, address and all, had no way back except writing to
 * support and waiting for an admin to run the reissue tool.
 *
 * The rule these functions exist to hold: REQUESTING recovery must never be
 * enough to change anything. It mints a second, separate, short-lived token
 * and mails a confirmation link. The working access link is untouched by
 * this. Only a click on that confirmation link, turned into a deliberate
 * POST the same way #78 requires for the entry link itself, rotates the
 * access token and signs the creator in. If typing an address were enough on
 * its own, a stranger could lock any creator out of a live campaign by
 * typing their address into this form.
 */

interface RecoveryTarget {
  enrolmentId: string;
  campaignId: string;
  name: string;
  /** As registered, not as typed: sent to only this address, never a
      variation the requester typed. */
  email: string;
}

/**
 * Look a creator up by the address they registered with, and mint them a
 * pending recovery token if one is found.
 *
 * Returns null for "not registered" and for "registered but the database
 * could not be written to" alike: the caller answers both the same way, so
 * the two failure shapes do not need to be told apart here.
 */
export async function requestAccessRecovery(
  email: string,
): Promise<{ target: RecoveryTarget; token: string } | null> {
  const emailCanonical = canonicalEmail(email);
  const db = getDb();

  const found = await db
    .select({
      enrolmentId: campaignCreators.id,
      campaignId: campaigns.id,
      name: creators.fullName,
      email: creators.email,
    })
    .from(campaignCreators)
    .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
    .innerJoin(campaigns, eq(campaigns.id, campaignCreators.campaignId))
    .where(
      and(
        eq(creators.emailCanonical, emailCanonical),
        eq(campaigns.slug, MONICA_SLUG),
      ),
    )
    .limit(1);

  const target = found[0];
  if (!target) return null;

  const token = newAccessToken();

  await db
    .update(campaignCreators)
    .set({
      recoveryTokenHash: hashAccessToken(token),
      recoveryTokenExpiresAt: new Date(
        Date.now() + RECOVERY_TOKEN_MAX_AGE_SECONDS * 1000,
      ),
    })
    .where(eq(campaignCreators.id, target.enrolmentId));

  return { target, token };
}

export interface RecoveryHolder {
  enrolmentId: string;
  name: string;
}

/**
 * Resolve a pending recovery token to the account it names, without acting
 * on it. This is what the confirmation link's GET calls: it only names the
 * account, the same as #78's creatorByToken does for the entry link, so that
 * naming the account before anything is committed applies here too.
 */
export async function recoveryHolderByToken(
  token: string,
): Promise<RecoveryHolder | null> {
  if (!looksLikeAccessToken(token)) return null;

  const rows = await getDb()
    .select({ enrolmentId: campaignCreators.id, name: creators.fullName })
    .from(campaignCreators)
    .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
    .innerJoin(campaigns, eq(campaigns.id, campaignCreators.campaignId))
    .where(
      and(
        eq(campaignCreators.recoveryTokenHash, hashAccessToken(token)),
        gt(campaignCreators.recoveryTokenExpiresAt, new Date()),
        eq(campaigns.slug, MONICA_SLUG),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export interface ConfirmedRecovery {
  enrolmentId: string;
  campaignId: string;
  accessToken: string;
}

/**
 * Turn a confirmed recovery click into a rotated access token.
 *
 * One UPDATE, matched on the hash and the expiry and clearing both recovery
 * columns in the same statement, so this is also what makes the token
 * single use: a second attempt with the same token matches no row, because
 * the first attempt already cleared recovery_token_hash. There is no
 * separate "mark consumed" step for a race to land between.
 *
 * Returns null on anything that is not a live, unexpired, matching token:
 * already used, expired, or never existed. The caller does not need to and
 * must not tell those apart, for the same reason the request side does not
 * distinguish "not registered" from "could not write".
 */
export async function confirmAccessRecovery(
  token: string,
): Promise<ConfirmedRecovery | null> {
  if (!looksLikeAccessToken(token)) return null;

  const newToken = newAccessToken();
  const db = getDb();

  const rows = await db
    .update(campaignCreators)
    .set({
      accessTokenHash: hashAccessToken(newToken),
      accessTokenIssuedAt: new Date(),
      recoveryTokenHash: null,
      recoveryTokenExpiresAt: null,
    })
    .where(
      and(
        eq(campaignCreators.recoveryTokenHash, hashAccessToken(token)),
        gt(campaignCreators.recoveryTokenExpiresAt, new Date()),
      ),
    )
    .returning({
      enrolmentId: campaignCreators.id,
      campaignId: campaignCreators.campaignId,
    });

  const row = rows[0];
  if (!row) return null;

  /*
   * Recorded in audit_log for the same reason the admin reissue tool is: this
   * rotates a creator's working credential, and a stdout line is not a record
   * a dispute gets answered from. No actor admin id, since nobody on the team
   * did this; the note says so.
   */
  await db.insert(auditLog).values({
    campaignId: row.campaignId,
    action: "creator.link_recovered",
    entityType: "campaign_creator",
    entityId: row.enrolmentId,
    note: "Self-service recovery: the creator confirmed a mailed link. The previous link stopped working.",
  });

  return {
    enrolmentId: row.enrolmentId,
    campaignId: row.campaignId,
    accessToken: newToken,
  };
}
