"use client";

import { useState } from "react";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface PointMovement {
  id: string;
  /** Pre-formatted on the server: source label plus the week suffix. */
  label: string;
  points: number;
  /** Pre-formatted Lagos date, so this component never touches timezones. */
  dateLabel: string;
  note: string | null;
}

/**
 * The ledger, ten movements at a time.
 *
 * Five weeks of approvals, bonuses and corrections make this the fastest
 * growing list a creator owns, and it used to render every fetched row in
 * one block. Reveal keeps their place on a phone; the count line keeps the
 * promise honest, since the page's whole reason for showing the ledger is
 * that the arithmetic visibly adds up.
 */
export function PointsHistory({ movements }: { movements: PointMovement[] }) {
  const [visible, setVisible] = useState(PAGE);
  const shown = movements.slice(0, visible);

  return (
    <>
      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {shown.map((movement) => (
          <li
            key={movement.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4"
          >
            <span className="text-sm font-semibold text-white">
              {movement.label}
            </span>
            {/* Signed, because a correction is a negative row and showing it
                as a bare number would read as an award. */}
            <span
              className={`ml-auto shrink-0 text-base font-bold tabular-nums ${
                movement.points < 0 ? "text-red-300" : "text-white"
              }`}
            >
              {movement.points > 0 ? "+" : ""}
              {movement.points}
            </span>
            <span className="w-full text-sm text-ink-3">
              {movement.dateLabel}
            </span>
            {movement.note && (
              <p className="w-full text-sm leading-relaxed text-ink-2">
                {movement.note}
              </p>
            )}
          </li>
        ))}
      </ul>
      {movements.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
        >
          Show more ({movements.length - visible} more)
        </button>
      ) : (
        <p className="mt-3 text-sm text-ink-4">
          Showing all {movements.length} movements. The total above is their
          sum.
        </p>
      )}
    </>
  );
}
