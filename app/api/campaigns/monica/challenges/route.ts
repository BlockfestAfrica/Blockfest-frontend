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
 *
 * Two boundaries, both enforced here because the seeds rest every week at
 * 'active' with a future window and submit_entry gates on the window, not
 * the status. Status alone told this endpoint that all five weeks were
 * open on day one, and the landing page revealed the whole schedule.
 *
 * So: drafts never leave the database, and neither does a week whose
 * window has not started, whatever its status row says. A week past its
 * end reports closed even before the console records it. Only the week
 * number, the derived status and the title travel; the description stays
 * on the creator's own page.
 */
export async function GET() {
  try {
    const rows = await getDb()
      .select({
        weekNo: challenges.weekNo,
        status: challenges.status,
        title: challenges.title,
        startsAt: challenges.startsAt,
        endsAt: challenges.endsAt,
      })
      .from(challenges)
      .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
      .where(and(eq(campaigns.slug, MONICA_SLUG), ne(challenges.status, "draft")))
      .orderBy(asc(challenges.weekNo));

    const now = Date.now();
    const started = rows
      .filter((row) => row.startsAt.getTime() <= now)
      .map((row) => ({
        weekNo: row.weekNo,
        status:
          row.status === "closed" || row.endsAt.getTime() < now
            ? "closed"
            : "active",
        title: row.title,
      }));

    return NextResponse.json(
      { ok: true, challenges: started },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    // The landing page renders its static schedule regardless; no statuses
    // is the soft failure.
    return NextResponse.json({ ok: false, challenges: [] }, { status: 200 });
  }
}
