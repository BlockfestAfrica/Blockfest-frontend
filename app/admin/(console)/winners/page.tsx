import Link from "next/link";
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
  unfinishedVoteWeek,
  type ClusterMember,
} from "@/lib/admin/vote-round";
import { WinnersPanel } from "@/components/admin/winners-panel";
import { VoteRoundPanel } from "@/components/admin/vote-round-panel";
import { PageHeader, SPACING } from "@/components/shared/panel";
import { currentWeekNo } from "@/lib/campaigns";
import { voteOpening } from "@/lib/vote-open-rule";

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
 * The page is the week and its jobs, in order: record, announce, and the
 * Community Favourite vote. The paperwork, the winners so far and the blocked
 * vote domains are about every week, and have their own screens (Payouts,
 * Blocked vote domains). Each job carries its own
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
export default async function WinnersPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
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

  /*
   * Which week this screen works on.
   *
   * The calendar's week, unless an earlier week's vote is still unfinished:
   * a vote can now run past the start of the next stage, and its close,
   * review and announce must stay reachable after the calendar moves on.
   * ?week= picks any week up to the current one.
   */
  const now = new Date();
  const current = currentWeekNo(now);
  const asked = Number((await searchParams).week);
  const weekNo =
    Number.isInteger(asked) && asked >= 1 && asked <= current
      ? asked
      : ((await unfinishedVoteWeek(admin.admin, current)) ?? current);

  const [creators, favourites, picked, snapshots, frozenPoints, round, entries] =
    await Promise.all([
      winnerCandidates(admin.admin, "creator_of_week"),
      winnerCandidates(admin.admin, "community_favourite"),
      winnersSoFar(admin.admin),
      snapshotsTaken(admin.admin),
      tiebreakPoints(admin.admin, weekNo),
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
   * Whether this week's vote can still be opened, for a week with no round:
   * on its Sunday, or late for the week that has just ended (stage 2's was
   * missed on its Sunday). The route asks the same question before it opens
   * anything (lib/vote-open-rule.ts).
   */
  const opening = round
    ? null
    : voteOpening({
        weekNo,
        now,
        recorded: frozen,
        favouriteAnnounced: picked.some(
          (p) =>
            p.weekNo === weekNo &&
            p.category === "community_favourite" &&
            p.publishedAt !== null,
        ),
      });

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

  return (
    <div className={SPACING.page}>
      <PageHeader
        context={`Monica · Week ${weekNo}`}
        title="Winners"
        hint="Record the standings on Saturday and announce Creator of the Week on Sunday; announce Community Favourite once its vote has closed. Announcing is public the moment you confirm."
      />

      {current > 1 && (
        <nav aria-label="Week" className="flex flex-wrap items-center gap-2">
          {Array.from({ length: current }, (_, i) => i + 1).map((week) => (
            <Link
              key={week}
              href={`/admin/winners?week=${week}`}
              aria-current={week === weekNo ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                week === weekNo
                  ? "bg-card-3 text-white"
                  : "text-ink-3 hover:bg-card-2 hover:text-white"
              }`}
            >
              Week {week}
              {week === current ? " (current)" : ""}
            </Link>
          ))}
          {weekNo < current && (
            <p className="basis-full text-sm text-ink-3">
              {round && (round.status === "open" || round.status === "closed")
                ? `Showing week ${weekNo}: its vote is not finished yet. Stage ${current} is live; switch to week ${current} once the Community Favourite is announced.`
                : `Showing week ${weekNo}. Stage ${current} is the current week.`}
            </p>
          )}
        </nav>
      )}

      {/* Keyed by week, both of them: the week tabs only change the search
          params, which keeps client state, so without a key one week's form
          (its picked creator, its vote window) was still there on the next
          week's tab. A late week 2 vote kept week 3's Sunday dates and could
          not be opened until they were retyped. */}
      <WinnersPanel
        key={`winners-${weekNo}`}
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
        canRecord={weekNo === current}
        vote={voteVerdict}
      />

      <VoteRoundPanel
        key={`vote-${weekNo}`}
        weekNo={weekNo}
        frozen={frozen}
        isPast={weekNo < current}
        lateCloseBy={opening?.open && opening.closeBy ? opening.closeBy : undefined}
        pastNote={opening && !opening.open ? opening.reason : undefined}
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
                announced: round.announced
                  ? {
                      at: round.announced.at.toISOString(),
                      finished: round.announced.finished,
                      sent: round.announced.sent,
                      failed: round.announced.failed,
                    }
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
                  hosts: d.hosts,
                  machineMade: d.machineMade,
                  block: d.block,
                  blockable: d.blockable,
                  protectedDomain: d.protectedDomain,
                  mxKind: d.mxKind,
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
                  reason: h.reason,
                })),
                unverified: tally.unverified,
              }
            : null
        }
      />
    </div>
  );
}
