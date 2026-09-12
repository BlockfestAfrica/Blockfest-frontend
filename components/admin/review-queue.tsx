"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Pill } from "@/components/shared/panel";
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
  /** True when the server could compare the link's author to that handle. */
  autoChecked: boolean;
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
    /*
     * One row per submission, separated by a hairline rather than boxed.
     *
     * A queue is read down, not across: the eye should fall through name,
     * handle, whether it was checked, then the link. Boxing each one made every
     * row shout equally and slowed that to a crawl over a long sitting.
     */
    <ul className="mt-8 flex flex-col gap-px overflow-hidden rounded-xl bg-white/10">
      {items.map((item) => (
        <li key={item.id} className="bg-ground p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-base font-semibold text-white">
              {item.creatorName}
            </span>
            {item.registeredHandle ? (
              <span className="font-mono text-sm text-brand-gold">
                @{item.registeredHandle}
              </span>
            ) : (
              <Pill tone="bad">no handle recorded</Pill>
            )}
            <span className="text-xs text-white/35">
              Week {item.weekNo} · {item.platformLabel}
            </span>
          </div>

          {/* The single most important line on the row: whether the link was
              checked against that handle, or whether the reviewer has to. */}
          {item.autoChecked ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-green-300/85">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Link is from this account
            </p>
          ) : (
            <p className="mt-2 flex items-start gap-2 text-sm text-amber-300">
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This link does not name its author. Open it and confirm it is
                the account above.
              </span>
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {/* Wrapped, not truncated. The author segment is what the decision
                turns on, and overflow-x is hidden site-wide so anything too
                wide is clipped rather than scrollable. min-w-0 so a long link
                does not push the button off a narrow screen. */}
            <code className="min-w-0 flex-1 break-all rounded-lg border border-white/12 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/85">
              {item.url}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(item.url);
                setCopied(item.id);
                toast.success("Link copied. Open it in a new tab.");
              }}
              className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10"
            >
              {copied === item.id ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied === item.id ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor={`note-${item.id}`} className="sr-only">
              Reason, required to reject
            </label>
            <input
              id={`note-${item.id}`}
              value={notes[item.id] ?? ""}
              onChange={(e) =>
                setNotes((n) => ({ ...n, [item.id]: e.target.value }))
              }
              maxLength={500}
              placeholder="Reason, required to reject. The creator sees it."
              className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-brand-gold focus:outline-none"
            />
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy === item.id}
                onClick={() => decide(item.id, "approved")}
                className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-green-400/15 px-5 text-sm font-semibold text-green-300 transition-colors duration-300 hover:bg-green-400/25 disabled:opacity-60 sm:flex-none"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Approve
              </button>
              <button
                type="button"
                disabled={busy === item.id}
                onClick={() => decide(item.id, "rejected")}
                className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-red-400/15 px-5 text-sm font-semibold text-red-300 transition-colors duration-300 hover:bg-red-400/25 disabled:opacity-60 sm:flex-none"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Reject
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}