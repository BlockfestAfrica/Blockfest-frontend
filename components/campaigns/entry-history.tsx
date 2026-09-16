"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pill } from "@/components/shared/panel";
import { monicaRoutes } from "@/lib/campaigns";

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
  const router = useRouter();
  const [visible, setVisible] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  /** Which row is asking, and whether the reader said it was not them. */
  const [asking, setAsking] = useState<string | null>(null);
  const shown = entries.slice(0, visible);

  /**
   * Take a pending entry back.
   *
   * The receipt mail has always said to send the right one instead if the
   * link was wrong, and the index refused a second submission on that
   * platform while the first sat pending, so the advice was impossible to
   * follow. It is also what somebody does on finding a receipt for an
   * entry they never sent: withdraw, then, if it was not them, rotate the
   * link so whoever sent it is locked out of the session too.
   */
  async function withdraw(id: string, wasNotMe: boolean) {
    setBusy(id);
    try {
      const response = await fetch("/api/campaigns/monica/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      if (wasNotMe) {
        /* Straight to recovery: a link somebody else is holding has to
           stop working, and rotating it ends their session too. */
        window.location.href = monicaRoutes.recover;
        return;
      }
      toast.success("Taken back. That platform is free again this week.");
      setAsking(null);
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

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
              rel="noopener noreferrer nofollow"
              className="mt-2 flex min-h-11 items-center break-words text-sm leading-relaxed text-ink-4 underline underline-offset-2 [overflow-wrap:anywhere] hover:text-ink-2"
            >
              {entry.url}
            </a>
            {/* Only while nobody has ruled on it. An approved entry has
                points minted against it and a rejected one is a
                reviewer's recorded judgement; neither is a creator's to
                erase, and the engine refuses both. */}
            {entry.status === "pending" &&
              (asking === entry.id ? (
                <div className="mt-3 rounded-lg border border-line-2 bg-card p-4">
                  <p className="max-w-prose text-sm leading-relaxed text-ink-2">
                    Taking this back frees {entry.platformLabel} for week{" "}
                    {entry.weekNo}, so you can send the right post instead.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={busy === entry.id}
                      onClick={() => withdraw(entry.id, false)}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-card-2"
                    >
                      {busy === entry.id ? "Working…" : "Yes, take it back"}
                    </button>
                    {/* The security answer, in one press: withdraw, then
                        rotate the link so whoever sent this is locked
                        out of the session as well. */}
                    <button
                      type="button"
                      disabled={busy === entry.id}
                      onClick={() => withdraw(entry.id, true)}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-red-400/40 px-4 text-sm font-semibold text-red-200 transition-colors hover:bg-red-400/10"
                    >
                      I did not send this
                    </button>
                    <button
                      type="button"
                      onClick={() => setAsking(null)}
                      className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-3 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-4">
                    &ldquo;I did not send this&rdquo; also gets you a new
                    personal link, which stops the old one working for
                    whoever used it.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAsking(entry.id)}
                  className="mt-3 inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
                >
                  Take this back
                </button>
              ))}
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
