"use client";

import { useState } from "react";
import { buttonClass } from "@/components/shared/panel";

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
 * The ledger, ten movements at a time, as the points card's own rows.
 *
 * Five weeks of approvals, bonuses and corrections make this the fastest
 * growing list a creator owns. Reveal keeps their place on a phone. The
 * line that restated the total is gone: the total sits in this card's
 * header, directly above the rows it adds up.
 */
export function PointsHistory({ movements }: { movements: PointMovement[] }) {
  const [visible, setVisible] = useState(PAGE);
  const shown = movements.slice(0, visible);

  return (
    <>
      <ul className="divide-y divide-line border-t border-line">
        {shown.map((movement) => (
          <li key={movement.id} className="px-4 py-3 sm:px-5">
            <div className="flex items-baseline gap-3">
              <p className="min-w-0 flex-1 text-sm font-semibold text-white">
                {movement.label}
              </p>
              {/* Signed, because a correction is a negative row and showing
                  it as a bare number would read as an award. */}
              <p
                className={`shrink-0 text-base font-bold tabular-nums ${
                  movement.points < 0 ? "text-red-300" : "text-white"
                }`}
              >
                {movement.points > 0 ? "+" : ""}
                {movement.points}
              </p>
            </div>
            <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-ink-3 [overflow-wrap:anywhere]">
              <span className="text-ink-4">{movement.dateLabel}</span>
              {movement.note ? ` · ${movement.note}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {movements.length > visible && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className={buttonClass("quiet", "w-full")}
          >
            Show more ({movements.length - visible} more)
          </button>
        </div>
      )}
    </>
  );
}
