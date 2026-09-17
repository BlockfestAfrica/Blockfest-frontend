"use client";

import { useState } from "react";

/** Rows shown before the reader asks for more; a screen's worth of table. */
const PAGE = 10;

export interface SnapshotRow {
  rank: number;
  name: string;
  points: number;
  approved: number;
}

/**
 * The frozen standings, ten ranks at a time.
 *
 * A snapshot carries every ranked creator, which by the final weeks is
 * hundreds of rows; the prizes live in the top five and the long tail is
 * there for disputes, so the table opens on what matters and reveals the
 * rest on request without losing the reader's place.
 */
export function SnapshotTable({ rows }: { rows: SnapshotRow[] }) {
  const [visible, setVisible] = useState(PAGE);
  const shown = rows.slice(0, visible);

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[28rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-ink-3">
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Creator</th>
            <th className="px-4 py-3 text-right">Points</th>
            <th className="px-4 py-3 text-right">Approved</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr
              key={`${row.rank}-${row.name}`}
              className="border-b border-line last:border-0"
            >
              <td className="px-4 py-3 tabular-nums text-ink-2">{row.rank}</td>
              <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
              <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                {row.points}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                {row.approved}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > visible && (
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
          >
            Show more ({rows.length - visible} more)
          </button>
        </div>
      )}
    </div>
  );
}
