import "server-only";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { campaignCreators, campaigns, creators, getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import {
  CREATOR_SESSION_COOKIE,
  hashAccessToken,
  looksLikeAccessToken,
} from "@/lib/creator-access";

/**
 * Who is reading their own page.
 *
 * The token arrives only as an httpOnly cookie, so it is never in a URL a
 * creator could paste into a group chat by accident, and never readable by
 * script on the page.
 *
 * The lookup is by hash, in one indexed query. There is no read-then-compare
 * step, so there is nothing here that leaks whether a prefix was right.
 */
export interface CreatorSession {
  enrolmentId: string;
  name: string;
  referralCode: string;
  pointsTotal: number;
  approvedEntries: number;
  joinedAt: Date;
}

export async function currentCreator(): Promise<CreatorSession | null> {
  const jar = await cookies();
  const token = jar.get(CREATOR_SESSION_COOKIE)?.value?.trim();

  // Shape checked before the database is touched. A malformed cookie is a
  // malformed cookie, not a query.
  if (!looksLikeAccessToken(token)) return null;

  const db = getDb();

  const rows = await db
    .select({
      enrolmentId: campaignCreators.id,
      name: creators.fullName,
      referralCode: campaignCreators.referralCode,
      pointsTotal: campaignCreators.pointsTotal,
      approvedEntries: campaignCreators.approvedEntriesCount,
      joinedAt: campaignCreators.joinedAt,
    })
    .from(campaignCreators)
    .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
    .innerJoin(campaigns, eq(campaigns.id, campaignCreators.campaignId))
    .where(
      and(
        eq(campaignCreators.accessTokenHash, hashAccessToken(token)),
        eq(campaigns.slug, MONICA_SLUG),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
