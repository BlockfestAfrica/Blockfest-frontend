import { NextResponse } from "next/server";
import { asc, and, ne, eq } from "drizzle-orm";
import { campaigns, challenges, getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";

export const runtime = "nodejs";

/**
 * The week statuses, for the static landing page to fetch.
 *
 * Public and unauthenticated on purpose, like the resources route: a week
 * that is open or closed is a fact the whole landing page already implies.
 * The WHERE is the privacy boundary: drafts never leave the database, so a
 * challenge the team has written for a future week is invisible here until
 * the Monday it is flipped active. Only the week number, the status and the
 * title travel; the description stays on the creator's own page.
 */
export async function GET() {
  try {
    const rows = await getDb()
      .select({
        weekNo: challenges.weekNo,
        status: challenges.status,
        title: challenges.title,
      })
      .from(challenges)
      .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
      .where(and(eq(campaigns.slug, MONICA_SLUG), ne(challenges.status, "draft")))
      .orderBy(asc(challenges.weekNo));

    return NextResponse.json(
      { ok: true, challenges: rows },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    // The landing page renders its static schedule regardless; no statuses
    // is the soft failure.
    return NextResponse.json({ ok: false, challenges: [] }, { status: 200 });
  }
}
