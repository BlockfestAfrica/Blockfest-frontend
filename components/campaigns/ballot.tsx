import { Clock } from "lucide-react";
import { BallotRows } from "@/components/campaigns/ballot-rows";
import { TimeLeftLabel } from "@/components/campaigns/time-left-label";
import { formatTimeLeft } from "@/lib/countdown";
import { closingAt } from "@/lib/format";
import type { ShortlistEntry, VoteWindowState } from "@/lib/winners";

/**
 * The Community Favourite ballot, as the Community Favourite row of its own
 * week on the winners page.
 *
 * It was a card of its own in a section of its own, under the weekly
 * winners, and the week it belonged to was said only in that section's hint.
 * Now it sits where the week's award will be announced, so the week is said
 * once, by the card around it, and the page never shows the vote apart from
 * the week it decides.
 *
 * The owner called the card-per-nominee layout before that ugly: four mostly
 * empty boxes with "Week 1" printed on each, a wall of underlined links and
 * a Vote pill as wide as the card. Each fact is said once here: the award and
 * the clock in this row's head, the rule and the close under it, nothing
 * repeated per nominee. Rows stay in ballot order and carry no counts, so a
 * half-typed vote never moves; the count lives in the block under the week.
 *
 * One row per ENTRY, never per submission. A creator who published the same
 * piece on three platforms has one entry and three links, and listing them
 * three times would split their own vote against themselves. Same grouping
 * rule the leaderboard uses.
 *
 * Takes the page's state rather than working it out, so this head and the
 * rows' buttons agree at render. The page is rebuilt at most once a minute,
 * so a tab left open past the close keeps its buttons until reloaded; the
 * engine refuses a late cast either way, and the clock here says Closed.
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
  const open = state === "open";

  return (
    <div>
      {/* Gold on the edge and the clock only while it runs: that is status. */}
      <div
        className={`border-l-2 px-4 py-4 sm:px-5 ${open ? "border-l-brand-gold" : "border-l-transparent"}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-base font-semibold text-ink-2">Community Favourite</p>
          {open && (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-gold">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <TimeLeftLabel
                endsAt={round.closesAt}
                initial={formatTimeLeft(round.closesAt)}
              />
            </p>
          )}
        </div>
        <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-ink-3">
          {open ? (
            <>
              Vote for your favourite: one vote per email address, confirmed
              by a six digit code. Closes{" "}
              <time dateTime={round.closesAt}>{closingAt(round.closesAt)}</time>,
              Lagos time.
            </>
          ) : state === "before" ? (
            // Both ends of the window: the FAQ sends people to "the time
            // shown with the shortlist" for the close.
            <>
              Voting opens{" "}
              <time dateTime={round.opensAt}>{closingAt(round.opensAt)}</time>{" "}
              and closes{" "}
              <time dateTime={round.closesAt}>{closingAt(round.closesAt)}</time>,
              Lagos time. One vote per email address, confirmed by a six digit
              code.
            </>
          ) : state === "closed" ? (
            "Voting has closed. The Community Favourite is confirmed after review."
          ) : (
            // An unreadable close time: say nothing rather than guess. Not
            // open (no buttons), and not closed either.
            "The shortlist."
          )}
        </p>
      </div>
      <div className="border-t border-line">
        <BallotRows
          entries={entries.map(({ name, links, roundId, nomineeId }) => ({
            name,
            links,
            roundId,
            nomineeId,
          }))}
          votingOpen={open}
        />
      </div>
    </div>
  );
}
