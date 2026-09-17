import Link from "next/link";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import {
  snapshotsTaken,
  tiebreakPoints,
  voteVerdict as computeVoteVerdict,
  winnerCandidates,
  winnersSoFar,
} from "@/lib/admin/winners";
import {
  candidateEntries,
  currentRound,
  roundTally,
  type ClusterMember,
} from "@/lib/admin/vote-round";
import { leaderboard } from "@/lib/leaderboard";
import { WinnersPanel } from "@/components/admin/winners-panel";
import { VoteRoundPanel } from "@/components/admin/vote-round-panel";
import { PageHeader, SectionCard, SPACING } from "@/components/shared/panel";
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

/** Cluster members reach the client as plain JSON, like the held list does. */
function serialiseMember(m: ClusterMember) {
  return {
    voteId: m.voteId,
    email: m.email,
    createdAt: m.createdAt.toISOString(),
    held: m.held,
  };
}
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

  const [creators, favourites, picked, snapshots, frozenPoints, board, round, entries] =
    await Promise.all([
      winnerCandidates(admin.admin, "creator_of_week"),
      winnerCandidates(admin.admin, "community_favourite"),
      winnersSoFar(admin.admin),
      snapshotsTaken(admin.admin),
    tiebreakPoints(admin.admin, weekNo),
      leaderboard(500),
      currentRound(admin.admin, weekNo),
      candidateEntries(admin.admin, weekNo),
    ]);

  /*
   * The tally needs the round's id, so it cannot join the Promise.all above,
   * and a week with no round has no tally to fetch at all.
   */
  const tally = round ? await roundTally(admin.admin, round.roundId) : null;

  const frozen = snapshots.some((s) => s.weekNo === weekNo);

  /*
   * What the vote has settled, for the announce card. The engine is the
   * authority (P0806 and P0807 refuse anything else at publish time); this
   * mirrors its answer so the card can show the winner instead of asking
   * for one. Ties break by standings points, the same rule the SQL applies,
   * and a disagreement is harmless: the announce is refused and the tally
   * is on the same screen.
   */
  const settled =
    round !== null &&
    (round.status === "closed" || round.status === "published") &&
    round.reviewedAt !== null;
  /* The decision itself lives in lib/admin/winners.ts, with its own tests.
     It was inline here, which meant the one rule that decides who may be
     announced had no test of its own at all. */
  const voteVerdict =
    round && tally
      ? computeVoteVerdict(tally.nominees, frozenPoints, settled)
      : null;

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
        hint="Record the standings on Saturday, announce on Sunday; announcing is public the moment you confirm."
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
        frozen={frozen}
        vote={voteVerdict}
      />

      <VoteRoundPanel
        weekNo={weekNo}
        frozen={frozen}
        round={
          round
            ? {
                roundId: round.roundId,
                status: round.status,
                opensAt: round.opensAt.toISOString(),
                closesAt: round.closesAt.toISOString(),
                reviewedAt: round.reviewedAt
                  ? round.reviewedAt.toISOString()
                  : null,
              }
            : null
        }
        candidates={entries}
        tally={
          tally
            ? {
                nominees: tally.nominees.map((n) => ({
                  nomineeId: n.nomineeId,
                  name: n.name,
                  votes: n.votes,
                })),
                /* Dates cross to the client as strings, members included:
                   the cluster rows carry the vote ids the Remove control
                   needs, which the panel never used to receive. */
                domains: tally.domains.map((d) => ({
                  domain: d.domain,
                  votes: d.votes,
                  members: d.members.map(serialiseMember),
                })),
                ips: tally.ips.map((ip) => ({
                  ipHash: ip.ipHash,
                  votes: ip.votes,
                  members: ip.members.map(serialiseMember),
                })),
                held: tally.held.map((h) => ({
                  voteId: h.voteId,
                  email: h.email,
                  domain: h.domain,
                  createdAt: h.createdAt.toISOString(),
                })),
                unverified: tally.unverified,
              }
            : null
        }
      />

      {/*
       * The working, for the people being paid.
       *
       * Links rather than buttons: a GET that changes nothing, and a link can be
       * opened, saved and attached to an email, which is what somebody actually
       * does with it two days before a transfer.
       */}
      <SectionCard id="paperwork" title="Paperwork">
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">
          Every ledger row for the top five, with who awarded it and why: the
          document a dispute is answered with. No bank details; the platform
          never holds any.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/api/admin/payout"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Points, with the working
          </a>
          <a
            href="/api/admin/payout?of=entries"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            The entries they were paid for
          </a>
        </div>

        {snapshots.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-4">
              Recorded so far
            </h3>
            {/* A definition list, because every row is week then facts about
                that week. It was four spans in a flex row, which on a phone
                wrapped into a shape with no grammar. */}
            {/* Each row opens the frozen table it names: the freeze is the
                payout record, and a record nobody can open is a rumour. */}
            <dl className="mt-3 divide-y divide-line border-y border-line">
              {snapshots.map((s) => (
                <div key={`${s.weekNo}-${s.version}`}>
                  <Link
                    href={`/admin/winners/snapshots?week=${s.weekNo}&version=${s.version}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 transition-colors hover:bg-card-2"
                  >
                    <dt className="font-semibold text-link underline underline-offset-4">
                      Week {s.weekNo}
                    </dt>
                    <dd className="text-sm text-ink-3">
                      {count(s.rows)} creators
                      {s.version > 1 && ` · version ${s.version}`}
                      <span className="ml-2 text-ink-4">
                        {dateTime(s.takenAt)}
                      </span>
                    </dd>
                  </Link>
                </div>
              ))}
            </dl>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
