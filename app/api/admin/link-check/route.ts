import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { campaigns, challengeEntries, challenges, getDb, submissions } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { sameOrigin } from "@/lib/admin/request";
import { MONICA_SLUG } from "@/lib/campaigns";
import { allow } from "@/lib/throttle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Re-check approved entry links and flag the ones that look gone (#71).
 *
 * A creator deleting a post after approval keeps the points for work that no
 * longer exists. This surfaces candidates; it never acts on them, because the
 * platforms lie to robots: X and Instagram answer 403 to almost anything that
 * is not a browser, so an automatic rejection wired to this would punish
 * creators for a bot filter. Three buckets instead:
 *
 *   gone          404 or 410, the platform itself says it is not there
 *   unverifiable  403, 429, or a redirect to a login wall
 *   ok            anything else that answered
 *
 * Only "gone" is worth a reviewer's click, and even then the instruction is
 * open it in a real browser before touching anything.
 *
 * Reviewer-accessible, not owner-only: it changes nothing.
 */

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

const BATCH = 40;

async function probe(url: string): Promise<{ url: string; verdict: "gone" | "unverifiable" | "ok"; status: number | null }> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        // A plain browser-ish UA. Not to evade anything: an explicitly
        // bot-shaped request gets a 403 from every platform here and the
        // report becomes all noise.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(6_000),
    });

    if (response.status === 404 || response.status === 410) {
      return { url, verdict: "gone", status: response.status };
    }
    if (response.status === 403 || response.status === 429 || response.status >= 500) {
      return { url, verdict: "unverifiable", status: response.status };
    }
    return { url, verdict: "ok", status: response.status };
  } catch {
    // Timeouts and network errors are the platform being slow to a robot far
    // more often than a deleted post.
    return { url, verdict: "unverifiable", status: null };
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;
  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;

  /*
   * Forty outbound fetches a call, reachable by any reviewer, with no
   * budget of its own. Two runs per five minutes is far above honest use
   * (the button is pressed when somebody wonders about link rot) and far
   * below a loop that turns the campaign's own function into a small
   * scanner aimed at three social hosts.
   */
  if (!(await allow(request, "admin-link-check", 2, 300))) {
    return NextResponse.json(
      { ok: false, message: "That check is already running. Give it a few minutes." },
      { status: 429 },
    );
  }

  const rows = await getDb()
    .select({ id: submissions.id, url: submissions.url, platform: submissions.platform })
    .from(submissions)
    .innerJoin(challengeEntries, eq(challengeEntries.id, submissions.entryId))
    .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .where(and(eq(campaigns.slug, MONICA_SLUG), eq(submissions.status, "approved")))
    .orderBy(asc(submissions.submittedAt))
    .limit(BATCH);

  const results = await Promise.all(rows.map((row) => probe(row.url)));

  const report = rows.map((row, index) => ({
    submissionId: row.id,
    platform: row.platform,
    url: row.url,
    verdict: results[index].verdict,
    status: results[index].status,
  }));

  return NextResponse.json({
    ok: true,
    checked: report.length,
    batchLimit: BATCH,
    gone: report.filter((r) => r.verdict === "gone"),
    unverifiable: report.filter((r) => r.verdict === "unverifiable").length,
  });
}
