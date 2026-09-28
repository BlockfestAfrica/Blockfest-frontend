import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { campaigns, challengeEntries, challenges, getDb, submissions } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { sameOrigin } from "@/lib/admin/request";
import { hostMatchesPlatform } from "@/lib/campaign-submission";
import { MONICA_SLUG, type CampaignPlatform } from "@/lib/campaigns";
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
 *   unverifiable  403, 429, a redirect to a login wall, or a redirect off
 *                 the platform, which is never followed
 *   ok            anything else that answered
 *
 * Only "gone" is worth a reviewer's click, and even then the instruction is
 * open it in a real browser before touching anything.
 *
 * Reviewer-accessible, not owner-only: it changes nothing.
 */

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

const BATCH = 40;

/**
 * Redirects are followed by hand, and only onto the entry's own platform.
 *
 * The stored link passed the platform allowlist once, at submission, and
 * the allowlist says nothing about where that link redirects. Under
 * redirect: "follow" a 30x from any allowlisted host (an open redirect, a
 * link shim, a dangling subdomain) carried this function's GET wherever the
 * Location pointed, plain http and bare IP addresses included, and the
 * allowlist guarded the first hop and nothing after it. So every address,
 * the stored one included, must be https on the entry's platform before it
 * is requested. One that is not is left unrequested and counted as
 * unverifiable, the same as a login wall: it says nothing about the post.
 *
 * Five hops covers the real chains with room to spare (twitter.com hands
 * over to x.com; instagram.com adds the www, then the trailing slash, then
 * may bounce to its login page). A longer chain is a loop or not a post, and
 * proves nothing either way.
 */
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function onPlatform(url: URL, platform: CampaignPlatform): boolean {
  return url.protocol === "https:" && hostMatchesPlatform(url.href, platform);
}

async function probe(
  url: string,
  platform: CampaignPlatform,
): Promise<{ url: string; verdict: "gone" | "unverifiable" | "ok"; status: number | null }> {
  // One budget for the whole chain, as it was when fetch followed the hops
  // itself, so following them by hand cannot stretch a probe past the six
  // seconds maxDuration was sized around.
  const signal = AbortSignal.timeout(6_000);
  try {
    let current = new URL(url);
    if (!onPlatform(current, platform)) return { url, verdict: "unverifiable", status: null };

    let response: Response;
    for (let redirects = 0; ; redirects++) {
      response = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        headers: {
          // A plain browser-ish UA. Not to evade anything: an explicitly
          // bot-shaped request gets a 403 from every platform here and the
          // report becomes all noise.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal,
      });
      if (!REDIRECT_STATUSES.has(response.status)) break;

      const location = response.headers.get("location");
      const next = location === null ? null : new URL(location, current);
      if (next === null || redirects === MAX_REDIRECTS || !onPlatform(next, platform)) {
        return { url, verdict: "unverifiable", status: response.status };
      }
      current = next;
    }

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

  const results = await Promise.all(rows.map((row) => probe(row.url, row.platform)));

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
