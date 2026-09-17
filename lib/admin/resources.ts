import "server-only";
import { asc, eq } from "drizzle-orm";
import { campaigns, getDb, resources } from "@/lib/db/client";
import type { AdminIdentity } from "@/lib/admin/session";
import { MONICA_SLUG } from "@/lib/campaigns";

export interface AdminResourceRow {
  id: string;
  section: string;
  title: string;
  body: string | null;
  url: string | null;
  displayOrder: number;
  isPublished: boolean;
}

export async function listResources(admin: AdminIdentity): Promise<AdminResourceRow[]> {
  void admin;
  return getDb()
    .select({
      id: resources.id,
      section: resources.section,
      title: resources.title,
      body: resources.body,
      url: resources.url,
      displayOrder: resources.displayOrder,
      isPublished: resources.isPublished,
    })
    .from(resources)
    .innerJoin(campaigns, eq(campaigns.id, resources.campaignId))
    .where(eq(campaigns.slug, MONICA_SLUG))
    .orderBy(asc(resources.section), asc(resources.displayOrder), asc(resources.title));
}
