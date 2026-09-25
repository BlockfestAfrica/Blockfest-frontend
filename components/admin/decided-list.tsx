"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Pill } from "@/components/shared/panel";
import { openableHref } from "@/lib/admin/openable-href";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface DecidedRow {
  id: string;
  status: string;
  creatorName: string;
  weekNo: number;
  challengeTitle: string;
  /** Resolved on the server, so this component never reads the registry. */
  platformLabel: string;
  /** The link that was decided on, exactly as it was submitted. */
  url: string;
  reviewerEmail: string | null;
  /** Pre-formatted Lagos time, so this component never touches timezones. */
  reviewedAtLabel: string | null;
  reviewNote: string | null;
}

/**
 * The decision log, ten at a time, each with the post it was about.
 *
 * The fetch is capped, but a couple of hundred rendered rows push the "can a
 * decision be changed" answer below a long scroll on a phone. Reveal keeps the
 * newest decisions, the ones a mis-tap lives in, on the first screen.
 *
 * The link is here so an approved post can be opened again later, to check it
 * is still up and still says what it said. It opens only where openableHref can
 * prove it points at a platform, the same guard the review queue applies, and
 * otherwise shows as text.
 */
export function DecidedList({ items }: { items: DecidedRow[] }) {
  const [visible, setVisible] = useState(PAGE);
  const shown = items.slice(0, visible);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  }

  return (
    <>
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {shown.map((item) => {
          const href = openableHref(item.url);
          return (
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
              <p className="mt-1 text-sm text-ink-3">{item.challengeTitle}</p>

              {/* The whole URL, never truncated: the author segment is what a
                  second look turns on, and a long handle can push it past an
                  ellipsis. */}
              <div className="mt-2 flex items-start gap-2">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="min-w-0 flex-1 break-all py-2 font-mono text-sm text-link underline underline-offset-2 hover:text-white"
                  >
                    {item.url}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <code className="min-w-0 flex-1 break-all py-2 text-sm text-ink-2">
                    {item.url}
                  </code>
                )}
                <button
                  type="button"
                  onClick={() => copyLink(item.url)}
                  aria-label={`Copy ${item.creatorName}'s link`}
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line-2 px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-card-2 hover:text-white"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy
                </button>
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
          );
        })}
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
          Showing all {items.length}, newest first.
        </p>
      )}
    </>
  );
}
