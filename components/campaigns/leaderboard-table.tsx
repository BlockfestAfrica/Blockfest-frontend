"use client";

import { useMemo, useState } from "react";

export interface BoardRow {
  rank: number;
  name: string;
  points: number;
  approvedEntries: number;
}

type SortKey = "rank" | "name" | "points" | "approvedEntries";

/**
 * The standings, sortable.
 *
 * The rank column always shows the rank the rules produce: total points, then
 * who reached that total first, then approved entries. Sorting reorders the
 * rows on screen and never renumbers them, because the number is the result and
 * the order is just a way of looking at it. Sorting by name and seeing somebody
 * become rank 1 would be a lie about who is winning.
 *
 * Done in the browser. The whole board arrives at once, it is capped at a
 * hundred rows, and a round trip per column click on a page people share would
 * make it feel broken.
 */
/** Rows shown before the reader asks for more. */
const PAGE = 10;

export function LeaderboardTable({ rows }: { rows: BoardRow[] }) {
  const [sort, setSort] = useState<SortKey>("rank");
  const [ascending, setAscending] = useState(true);
  /*
   * Ten at a time, revealed rather than paged. The board holds up to a
   * hundred rows, and on the phones this campaign lives on that is a long
   * scroll past everything below the table. Reveal keeps the reader's
   * place; a page swap would lose it. Re-sorting resets the window because
   * the question changed.
   */
  const [visible, setVisible] = useState(PAGE);

  const sorted = useMemo(() => {
    const direction = ascending ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name) * direction;
      return (a[sort] - b[sort]) * direction;
    });
  }, [rows, sort, ascending]);
  const shown = sorted.slice(0, visible);

  function sortBy(key: SortKey) {
    setVisible(PAGE);
    if (key === sort) {
      setAscending((a) => !a);
      return;
    }
    setSort(key);
    // Rank and name read best ascending; points and entries best highest first.
    setAscending(key === "rank" || key === "name");
  }

  return (
    /*
     * Scrolls inside its own container.
     *
     * html and body set overflow-x: hidden site-wide, so a table wider than a
     * phone would be clipped with no scrollbar and no sign anything was
     * missing. Keeping the overflow local means it can actually be scrolled.
     */
    <div className="mt-10 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[30rem] border-collapse text-left">
        <caption className="sr-only">
          Campaign standings, sortable by rank, name, points or approved entries
        </caption>
        <thead>
          <tr className="border-b border-line">
            <Th onClick={() => sortBy("rank")} active={sort === "rank"} ascending={ascending} numeric>
              #
            </Th>
            <Th onClick={() => sortBy("name")} active={sort === "name"} ascending={ascending}>
              Creator
            </Th>
            <Th onClick={() => sortBy("approvedEntries")} active={sort === "approvedEntries"} ascending={ascending} numeric>
              Entries
            </Th>
            <Th onClick={() => sortBy("points")} active={sort === "points"} ascending={ascending} numeric>
              Points
            </Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr
              key={`${row.rank}-${row.name}`}
              className="border-b border-line last:border-0"
            >
              <td
                className={`w-14 px-4 py-4 text-right text-lg font-bold tabular-nums ${
                  row.rank <= 3 ? "text-brand-gold" : "text-ink-2"
                }`}
              >
                {row.rank}
              </td>
              <td className="px-4 py-4 font-medium text-ink-2">{row.name}</td>
              <td className="px-4 py-4 text-right tabular-nums text-ink-3">
                {row.approvedEntries}
              </td>
              <td className="px-4 py-4 text-right text-lg font-bold tabular-nums text-white">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length > visible && (
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
          >
            Show more ({sorted.length - visible} more)
          </button>
        </div>
      )}
    </div>
  );
}

/** A sortable heading. aria-sort so the state is not carried by colour alone. */
function Th({
  children,
  onClick,
  active,
  ascending,
  numeric = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  ascending: boolean;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
      className={numeric ? "text-right" : "text-left"}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-h-11 w-full cursor-pointer items-center gap-1 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
          numeric ? "justify-end" : "justify-start"
        } ${active ? "text-brand-gold" : "text-ink-4 hover:text-white"}`}
      >
        {children}
        <span aria-hidden="true" className="text-[0.65rem]">
          {active ? (ascending ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
