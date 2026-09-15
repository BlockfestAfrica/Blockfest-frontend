"use client";

import { useState } from "react";
import { Pill } from "@/components/shared/panel";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface EntryRow {
  id: string;
  weekNo: number;
  /** Resolved on the server, so this component never reads the registry. */
  platformLabel: string;
  status: string;
  /** The shared Pill's tone and label, decided by the page's statusPill. */
  statusTone: "neutral" | "good" | "bad";
  statusLabel: string;
  url: string;
  reviewNote: string | null;
}

/**
 * Everything a creator has sent, ten entries at a time.
 *
 * Five weeks across three platforms is fifteen rows, each with a URL and
 * often a review note, and the accounts, referral and sign-out controls all
 * live below this list. Reveal keeps the newest entries, the ones still
 * being reviewed, near the form they came from.
 */
export function EntryHistory({ entries }: { entries: EntryRow[] }) {
  const [visible, setVisible] = useState(PAGE);
  const shown = entries.slice(0, visible);

  return (
    <>
      <ul className="mt-5 flex flex-col gap-px overflow-hidden rounded-xl bg-card-3">
        {shown.map((entry) => (
          <li key={entry.id} className="bg-ground p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm font-semibold text-white">
                Week {entry.weekNo}
              </span>
              <span className="text-sm text-ink-4">{entry.platformLabel}</span>
              <Pill tone={entry.statusTone}>{entry.statusLabel}</Pill>
            </div>
            {/* Tappable, because the commonest rejection reason is an
                entry that cannot be viewed at the link given, and on a
                phone there is no other way to check that. break-words
                rather than break-all: break-all shatters a URL at
                arbitrary characters. */}
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex min-h-11 items-center break-words text-sm leading-relaxed text-ink-4 underline underline-offset-2 [overflow-wrap:anywhere] hover:text-ink-2"
            >
              {entry.url}
            </a>
            {entry.reviewNote && (
              <div
                className={`mt-3 border-l-2 pl-3 ${
                  entry.status === "rejected"
                    ? "border-red-400/60"
                    : "border-line-2"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-4">
                  {entry.status === "rejected"
                    ? "What to change"
                    : "Note from the reviewer"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                  {entry.reviewNote}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
      {entries.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
        >
          Show more ({entries.length - visible} more)
        </button>
      ) : (
        <p className="mt-3 text-sm text-ink-4">
          Showing all {entries.length} entries, newest first.
        </p>
      )}
    </>
  );
}
