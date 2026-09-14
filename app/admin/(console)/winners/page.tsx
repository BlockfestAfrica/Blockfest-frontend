import { Download } from "lucide-react";
import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import {
  snapshotsTaken,
  winnerCandidates,
  winnersSoFar,
} from "@/lib/admin/winners";
import { leaderboard } from "@/lib/leaderboard";
import { WinnersPanel } from "@/components/admin/winners-panel";
import { PageHeader, SPACING } from "@/components/shared/panel";
import { currentWeekNo } from "@/lib/campaigns";
import { count, dateTime } from "@/lib/format";

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
 *
 * The page is four things in a fixed order: where you are, the two jobs, the
 * paperwork, and the record of what has been recorded. Each job carries its own
 * state, which is why the yellow warning bar that used to sit at the top is
 * gone: it announced "week 3 is not frozen yet" directly above a control headed
 * "Freeze week 3", in an alarm colour, for the ordinary condition of a Saturday
 * morning. The job now says "Not yet" on itself.
 */
export default async function WinnersPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  if (!isOwner(admin.admin)) {
    return (
      <PageHeader
        context="Winners"
        title="Owners only"
        hint="Announcing a winner commits prize money to a named person, so it is restricted to owners. Everything else in the console is open to you."
      />
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

  return (
    <div className={SPACING.page}>
      <PageHeader
        context={`Monica · Week ${weekNo}`}
        title="Winners"
        hint="Two jobs, in order. Record the standings on Saturday, announce on Sunday. Both are done by a person, and the second one is public the moment you confirm it."
      />

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
          enrolmentId: p.enrolmentId,
          name: p.name,
          prizeNaira: p.prizeNaira,
          note: p.note,
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        }))}
        frozen={snapshots.some((s) => s.weekNo === weekNo)}
      />

      {/*
       * The working, for the people being paid.
       *
       * Links rather than buttons: a GET that changes nothing, and a link can be
       * opened, saved and attached to an email, which is what somebody actually
       * does with it two days before a transfer.
       */}
      <section aria-labelledby="paperwork" className="space-y-4">
        <h2 id="paperwork" className="text-xl font-bold text-white">
          Paperwork
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-white/70">
          Every ledger row for the top five, with the date, the source, the
          amount, the admin who awarded it and what they wrote. This is the
          document a dispute is answered with. It carries no bank details,
          because the platform never holds any.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/admin/payout"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Points, with the working
          </a>
          <a
            href="/api/admin/payout?of=entries"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            The entries they were paid for
          </a>
        </div>

        {snapshots.length > 0 && (
          <div className="pt-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">
              Recorded so far
            </h3>
            {/* A definition list, because every row is week then facts about
                that week. It was four spans in a flex row, which on a phone
                wrapped into a shape with no grammar. */}
            <dl className="mt-3 divide-y divide-white/10 border-y border-white/10">
              {snapshots.map((s) => (
                <div
                  key={`${s.weekNo}-${s.version}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                >
                  <dt className="font-semibold text-white">Week {s.weekNo}</dt>
                  <dd className="text-sm text-white/60">
                    {count(s.rows)} creators
                    {s.version > 1 && ` · version ${s.version}`}
                    <span className="ml-2 text-white/45">
                      {dateTime(s.takenAt)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}
