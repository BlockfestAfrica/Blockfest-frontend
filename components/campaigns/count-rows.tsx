import { count } from "@/lib/format";
import type { RankedRow } from "@/lib/vote-board";

/**
 * A vote count as ranked rows: rank, name, votes and share, and a bar.
 *
 * One drawing for the live count under the ballot and for each past week's
 * final count under Weekly winners, so a number read on Tuesday looks the
 * same when it is looked up again in November.
 */
export function CountRows({ rows, className = "" }: { rows: RankedRow[]; className?: string }) {
  return (
    <ol className={`flex flex-col gap-4 ${className}`}>
      {rows.map((row) => (
        <li key={row.nomineeId}>
          <div className="flex items-baseline gap-3">
            {/* Read out as "Rank 1:", so two nominees level on votes are
                both heard as first rather than as list items one and two. */}
            <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-ink-4">
              <span className="sr-only">Rank </span>
              {row.rank}
              <span className="sr-only">:</span>
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-white">
              {row.name}
              {row.leading && <span className="sr-only">, in the lead</span>}
            </span>
            <span className="shrink-0 text-sm tabular-nums">
              <span className="font-semibold text-white">{count(row.votes)}</span>
              <span className="sr-only">{row.votes === 1 ? " vote," : " votes,"}</span>
              <span className="ml-2 text-ink-4">{row.share}%</span>
            </span>
          </div>
          {/* The bar is each nominee's share of all counted votes, the same
              figure printed beside it. Gold only for a nominee strictly
              ahead: nobody leads a tie. */}
          <div aria-hidden="true" className="ml-8 mt-2 h-1.5 overflow-hidden rounded-full bg-card-3">
            <div
              className={`h-full rounded-full ${row.leading ? "bg-brand-gold" : "bg-ink-4"}`}
              style={{ width: `${row.share}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
