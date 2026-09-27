import { Clock } from "lucide-react";
import { BallotRow } from "@/components/campaigns/ballot-row";
import { TimeLeftLabel } from "@/components/campaigns/time-left-label";
import { formatTimeLeft } from "@/lib/countdown";
import { closingAt } from "@/lib/format";
import type { ShortlistEntry, VoteWindowState } from "@/lib/winners";

/**
 * The Community Favourite ballot: one contained card, the round's state in
 * its header, one row per nominee.
 *
 * The owner called the card-per-nominee layout it replaces ugly: four mostly
 * empty boxes with "Week 1" printed on each, a wall of underlined links and
 * a Vote pill as wide as the card. Each fact is said once here: the clock in
 * this header, the week and the rule in the section's hint, nothing repeated
 * per row. Rows stay in ballot order and carry no counts, so a half-typed
 * vote never moves; the count lives in the block under the ballot.
 *
 * One row per ENTRY, never per submission. A creator who published the same
 * piece on three platforms has one entry and three links, and listing them
 * three times would split their own vote against themselves. Same grouping
 * rule the leaderboard uses.
 *
 * Takes the page's state rather than working it out, so this header, the
 * section eyebrow above it and the rows' buttons can never disagree.
 */
export function Ballot({
  entries,
  state,
}: {
  entries: ShortlistEntry[];
  state: VoteWindowState;
}) {
  const round = entries[0];
  if (!round) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-line-2 bg-card">
      {/* Where the round stands, said once: the clock while it runs, the
          open time before, and closed after. Gold only on the live clock,
          which is status. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        {state === "open" ? (
          <>
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-gold">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <TimeLeftLabel
                endsAt={round.closesAt}
                initial={formatTimeLeft(round.closesAt)}
              />
            </p>
            <p className="text-sm text-balance text-ink-3">
              Closes{" "}
              <time dateTime={round.closesAt}>{closingAt(round.closesAt)}</time>
              , Lagos time
            </p>
          </>
        ) : state === "before" ? (
          <p className="text-sm text-ink-3">
            Voting opens{" "}
            <time dateTime={round.opensAt}>{closingAt(round.opensAt)}</time>,
            Lagos time. Here is who is on it.
          </p>
        ) : (
          <p className="text-sm text-ink-3">
            Voting for week {round.weekNo} has closed.
          </p>
        )}
      </div>
      <ul className="divide-y divide-line">
        {entries.map((entry, index) => (
          <BallotRow
            key={entry.nomineeId || `${entry.name}-${index}`}
            roundId={entry.roundId}
            nomineeId={entry.nomineeId}
            name={entry.name}
            links={entry.links}
            votingOpen={state === "open"}
          />
        ))}
      </ul>
    </div>
  );
}
