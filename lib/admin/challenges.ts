import "server-only";
import { asc, eq } from "drizzle-orm";
import { campaigns, challenges, getDb } from "@/lib/db/client";
import type { AdminIdentity } from "@/lib/admin/session";
import { MONICA_SLUG } from "@/lib/campaigns";

export interface ChallengeRow {
  id: string;
  weekNo: number;
  title: string;
  description: string;
  basePoints: number;
  status: "draft" | "active" | "closed";
  startsAt: Date;
  endsAt: Date;
}

/** Every stage, in order, for the editor. */
export async function listChallenges(admin: AdminIdentity): Promise<ChallengeRow[]> {
  void admin; // Reading is admin-only; the type is the proof.

  const rows = await getDb()
    .select({
      id: challenges.id,
      weekNo: challenges.weekNo,
      title: challenges.title,
      description: challenges.description,
      basePoints: challenges.basePoints,
      status: challenges.status,
      startsAt: challenges.startsAt,
      endsAt: challenges.endsAt,
    })
    .from(challenges)
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .where(eq(campaigns.slug, MONICA_SLUG))
    .orderBy(asc(challenges.weekNo));

  return rows.map((row) => ({
    ...row,
    weekNo: Number(row.weekNo),
    status: row.status as ChallengeRow["status"],
  }));
}
