import "server-only";
import { asc, eq } from "drizzle-orm";
import { campaigns, getDb, pointRules } from "@/lib/db/client";
import type { AdminIdentity } from "@/lib/admin/session";
import { MONICA_SLUG } from "@/lib/campaigns";

export interface PointRuleRow {
  id: string;
  key: string;
  defaultPoints: number;
  minPoints: number | null;
  maxPoints: number | null;
}

export async function listPointRules(admin: AdminIdentity): Promise<PointRuleRow[]> {
  void admin;
  const rows = await getDb()
    .select({
      id: pointRules.id,
      key: pointRules.key,
      defaultPoints: pointRules.defaultPoints,
      minPoints: pointRules.minPoints,
      maxPoints: pointRules.maxPoints,
    })
    .from(pointRules)
    .innerJoin(campaigns, eq(campaigns.id, pointRules.campaignId))
    .where(eq(campaigns.slug, MONICA_SLUG))
    .orderBy(asc(pointRules.key));
  return rows;
}
