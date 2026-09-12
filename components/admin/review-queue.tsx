"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";

export interface QueueItem {
  id: string;
  url: string;
  weekNo: number;
  challengeTitle: string;
  platformLabel: string;
  submittedAt: string;
  creatorName: string;
  /** The account they said they publish from. Null if none is recorded. */
  registeredHandle: string | null;
}

/**
 * The queue.
 *
 * The submitted link is shown as text with a copy button rather than as a
 * clickable anchor. The destination is chosen entirely by whoever submitted it,
 * registration is open to anybody, and this page is read by the small number of
 * people who can mint points. A one-click path from an attacker-controlled
 * string to a reviewer's browser, on the origin that holds their session, is
 * the cheapest way to attack this whole system. Copying and pasting deliberately
 * is one extra second and removes that path.
 *
 * A rejection requires a reason, because the creator sees it and it is the only
 * thing that tells them what to change.
 */
export function ReviewQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  async function decide(id: string, decision: "approved" | "rejected") {
    const note = notes[id]?.trim() ?? "";

    if (decision === "rejected" && note.length === 0) {
      toast.error("A rejection needs a reason. The creator sees it.");
      return;
    }

    setBusy(id);
    try {
      const response = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          decision,
          note: note || undefined,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      toast.success(decision === "approved" ? "Approved" : "Rejected");
      // The server owns the queue. Refreshing is how this page learns what it
      // now contains, rather than guessing and drifting from it.
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="mt-10 flex flex-col gap-4">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-semibold text-white">
              Week {item.weekNo}
            </span>
            <span className="text-sm text-white/50">{item.challengeTitle}</span>
            <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-xs font-semibold text-white/70">
              {item.platformLabel}
            </span>
          </div>

          {/* Who is claiming this post, and the account they registered.
              Without both, the queue is a list of bare links and there is no
              way to notice that a link does not belong to the person claiming
              it. On Instagram the author is not in the URL at all, so this
              comparison is the only check that exists. */}
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base font-semibold text-white">
              {item.creatorName}
            </span>
            {item.registeredHandle ? (
              <span className="font-mono text-sm text-brand-gold">
                @{item.registeredHandle}
              </span>
            ) : (
              <span className="text-sm text-red-300">
                no handle recorded for this platform
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/40">
            Check the post was published by that account before approving.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {/* Text, not a link. See the note at the top of this file. */}
            <code className="flex-1 truncate rounded-lg border border-white/20 bg-ground px-4 py-3 text-sm text-white">
              {item.url}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(item.url);
                setCopied(item.id);
                toast.success("Link copied. Open it in a new tab.");
              }}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10"
            >
              {copied === item.id ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied === item.id ? "Copied" : "Copy"}
            </button>
          </div>

          <label
            htmlFor={`note-${item.id}`}
            className="mt-4 block text-sm font-semibold text-white"
          >
            Reason, required to reject
          </label>
          <input
            id={`note-${item.id}`}
            value={notes[item.id] ?? ""}
            onChange={(e) =>
              setNotes((n) => ({ ...n, [item.id]: e.target.value }))
            }
            maxLength={500}
            placeholder="Shown to the creator"
            className="mt-2 w-full rounded-lg border border-white/15 bg-ground px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-brand-gold focus:outline-none"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy === item.id}
              onClick={() => decide(item.id, "approved")}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-green-400/15 px-5 text-sm font-semibold text-green-300 transition-colors duration-300 hover:bg-green-400/25 disabled:opacity-60"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Approve
            </button>
            <button
              type="button"
              disabled={busy === item.id}
              onClick={() => decide(item.id, "rejected")}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-red-400/15 px-5 text-sm font-semibold text-red-300 transition-colors duration-300 hover:bg-red-400/25 disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
