"use client";

import { useState } from "react";
import { Pill } from "@/components/shared/panel";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface DecidedRow {
  id: string;
  status: string;
  creatorName: string;
  weekNo: number;
  /** Resolved on the server, so this component never reads the registry. */
  platformLabel: string;
  reviewerEmail: string | null;
  /** Pre-formatted Lagos time, so this component never touches timezones. */
  reviewedAtLabel: string | null;
  reviewNote: string | null;
}

/**
 * The decision log, ten at a time.
 *
 * The fetch already stops at the last fifty, but fifty rendered rows push
 * the "can a decision be changed" answer below a long scroll on a phone.
 * Reveal keeps the newest decisions, the ones a mis-tap lives in, on the
 * first screen.
 */
export function DecidedList({ items }: { items: DecidedRow[] }) {
  const [visible, setVisible] = useState(PAGE);
  const shown = items.slice(0, visible);

  return (
    <>
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {shown.map((item) => (
          <li
            key={item.id}
            /* The status spine: the same 2px edge the queue, the job cards
               and the rail speak. Scanned down the column it answers the
               screen's one question, which of these was a mis-tap, without
               reading a single pill. */
            className={`border-l-2 p-4 ${
              item.status === "approved"
                ? "border-l-green-400/70"
                : "border-l-red-400/70"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Pill tone={item.status === "approved" ? "good" : "bad"}>
                {item.status === "approved" ? "Approved" : "Rejected"}
              </Pill>
              <span className="text-base font-semibold text-white">
                {item.creatorName}
              </span>
              <span className="text-sm text-ink-3">
                W{item.weekNo} · {item.platformLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-3">
              {item.reviewerEmail ?? "reviewer no longer listed"}
              {item.reviewedAtLabel ? ` · ${item.reviewedAtLabel}` : ""}
            </p>
            {item.reviewNote && (
              <p className="mt-2 border-l-2 border-line-2 pl-3 text-sm leading-relaxed text-ink-2">
                {item.reviewNote}
              </p>
            )}
          </li>
        ))}
      </ul>
      {items.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
        >
          Show more ({items.length - visible} more)
        </button>
      ) : (
        <p className="mt-3 text-sm text-ink-4">
          Showing all {items.length} decisions, newest first.
        </p>
      )}
    </>
  );
}
