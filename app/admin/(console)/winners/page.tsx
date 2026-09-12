import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import {
  snapshotsTaken,
  winnerCandidates,
  winnersSoFar,
} from "@/lib/admin/winners";
import { leaderboard } from "@/lib/leaderboard";
import { WinnersPanel } from "@/components/admin/winners-panel";
import { Panel } from "@/components/shared/panel";
import { currentWeekNo } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Winners",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The Saturday and Sunday ritual, on one screen.
 *
 * Owners only, checked here as well as by the tab being hidden and by the API
 * refusing again. A hidden tab is a tidy interface, not a permission.
 */
export default async function WinnersPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  if (!isOwner(admin.admin)) {
    return (
      <>
        <h1 className="text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
          Owners only
        </h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-white/60">
          Announcing a winner commits prize money to a named person, so it is
          restricted to owners. Everything else in the console is open to you.
        </p>
      </>
    );
  }

  const weekNo = currentWeekNo();

  const [creators, favourites, picked, snapshots, board] = await Promise.all([
    winnerCandidates(admin.admin, "creator_of_week"),
    winnerCandidates(admin.admin, "community_favourite"),
    winnersSoFar(admin.admin),
    snapshotsTaken(admin.admin),
    leaderboard(500),
  ]);

  /*
   * How many names the no-repeat rule removed.
   *
   * Derived rather than counted in SQL: the candidate query already filters
   * them, and the full board is the same ordering, so the difference is exactly
   * the set that has already won. Showing the number is what turns a missing
   * name from a mystery into an answer.
   */
  const excludedCount = Math.max(0, board.length - creators.length);

  const thisWeekFrozen = snapshots.some((s) => s.weekNo === weekNo);

  return (
    <>
      <p className="eyebrow text-brand-gold">Winners</p>
      <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
        Week {weekNo}
      </h1>

      {!thisWeekFrozen && (
        <Panel tone="warn" className="mt-6">
          <p className="text-sm leading-relaxed text-white/75">
            Week {weekNo} has not been frozen yet. Do that before announcing,
            so the standings the prize was decided on are recorded.
          </p>
        </Panel>
      )}

      <div className="mt-8">
        <WinnersPanel
          weekNo={weekNo}
          creatorCandidates={creators.map((c) => ({
            enrolmentId: c.enrolmentId,
            name: c.name,
            points: c.points,
            rank: c.rank,
          }))}
          favouriteCandidates={favourites.map((c) => ({
            enrolmentId: c.enrolmentId,
            name: c.name,
            points: c.points,
            rank: c.rank,
          }))}
          excludedCount={excludedCount}
          picked={picked.map((p) => ({
            weekNo: p.weekNo,
            category: p.category,
            name: p.name,
            prizeNaira: p.prizeNaira,
            publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
          }))}
        />
      </div>

      {snapshots.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold text-white">Frozen weeks</h2>
          <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/12">
            {snapshots.map((s) => (
              <li
                key={`${s.weekNo}-${s.version}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm"
              >
                <span className="font-semibold text-white">
                  Week {s.weekNo}
                </span>
                <span className="text-white/60">version {s.version}</span>
                <span className="text-white/60">{s.rows} creators</span>
                <span className="text-white/55">
                  {s.takenAt.toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "Africa/Lagos",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
