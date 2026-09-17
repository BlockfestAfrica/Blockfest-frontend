import { NextResponse } from "next/server";
import { asc, and, eq } from "drizzle-orm";
import { campaigns, getDb, resources } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";

export const runtime = "nodejs";

/**
 * The published pack resources, for the static pack page to fetch (#70).
 *
 * Public and unauthenticated on purpose: everything here renders on a public
 * page anyway, and the WHERE is the privacy boundary, published rows only.
 * Cached briefly at the edge so an edit shows within a minute without this
 * becoming a per-visitor database read.
 */
export async function GET() {
  try {
    const rows = await getDb()
      .select({
        section: resources.section,
        title: resources.title,
        body: resources.body,
        url: resources.url,
      })
      .from(resources)
      .innerJoin(campaigns, eq(campaigns.id, resources.campaignId))
      .where(and(eq(campaigns.slug, MONICA_SLUG), eq(resources.isPublished, true)))
      .orderBy(asc(resources.section), asc(resources.displayOrder), asc(resources.title));

    return NextResponse.json(
      { ok: true, resources: rows },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45" } },
    );
  } catch {
    // The pack page renders its static content regardless; an empty list is
    // the soft failure.
    return NextResponse.json({ ok: false, resources: [] }, { status: 200 });
  }
}
