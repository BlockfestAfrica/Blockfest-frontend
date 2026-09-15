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
 * the status. Status alone told this endpoint that all four stages were
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
        description: challenges.description,
        basePoints: challenges.basePoints,
        startsAt: challenges.startsAt,
        endsAt: challenges.endsAt,
      })
      .from(challenges)
      .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
      .where(and(eq(campaigns.slug, MONICA_SLUG), ne(challenges.status, "draft")))
      .orderBy(asc(challenges.weekNo));

    const now = Date.now();
    /*
     * A started week's brief is public. It was held to the creator's own
     * page at first, but the flow sends a fresh registrant here to read
     * what the week expects, and a brief only participants can read is a
     * campaign that looks empty from the outside. What stays hidden is
     * unchanged: drafts, and any week whose window has not opened.
     *
     * With one exception, learned the day the restructure moved launch two
     * days out: BEFORE the campaign's first window opens, the earliest
     * published week is revealed as "upcoming". The team publishes stage 1
     * ahead of launch on purpose; the first challenge is the campaign's own
     * advertisement, and hiding it until midnight hides the thing
     * registration is selling. The exception closes itself the moment any
     * window opens, so stages 2 to 4 still surface only on their Monday.
     */
    const visible = rows.filter((row) => row.startsAt.getTime() <= now);
    const nothingStartedYet = visible.length === 0 && rows.length > 0;
    if (nothingStartedYet) visible.push(rows[0]);

    const started = visible.map((row) => ({
      weekNo: row.weekNo,
      status:
        row.startsAt.getTime() > now
          ? "upcoming"
          : row.status === "closed" || row.endsAt.getTime() < now
            ? "closed"
            : "active",
      title: row.title,
      description: row.description,
      basePoints: row.basePoints,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    }));

    return NextResponse.json(
      { ok: true, challenges: started },
      /*
       * Fifteen seconds, down from sixty with five minutes of
       * stale-while-revalidate. The old numbers meant an admin's edit could
       * take five minutes to reach the page, which reads as the edit not
       * working; the query is one indexed select and the traffic is one
       * fetch per landing view, so the shorter window costs nothing real.
       */
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45" } },
    );
  } catch {
    // The landing page renders its static schedule regardless; no statuses
    // is the soft failure.
    return NextResponse.json({ ok: false, challenges: [] }, { status: 200 });
  }
}
