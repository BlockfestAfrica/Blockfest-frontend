"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JobCard, Pill } from "@/components/shared/panel";

export interface RequestRow {
  id: string;
  creatorName: string;
  creatorEmail: string;
  platform: string;
  oldHandle: string;
  requestedHandle: string;
  reason: string;
  createdAt: string;
}

/**
 * Handle change requests, waiting on a person.
 *
 * This is the owner's requirement made visible: a creator can ask, and only an
 * approval here moves anything. Each row shows what the admin judges, which is
 * the change and the creator's own words for why. Approval runs through the
 * same audited function as a direct fix; rejection requires a note because the
 * creator reads it on their page.
 */
export function HandleRequestQueue({ requests }: { requests: RequestRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function decide(id: string, approve: boolean, decisionNote = "") {
    setBusy(id);
    try {
      const response = await fetch("/api/admin/handle-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, approve, note: decisionNote }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      toast.success(
        approve
          ? `Approved: @${result.from} is now @${result.to}`
          : "Rejected. The creator sees your note on their page.",
      );
      setRejecting(null);
      setNote("");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  if (requests.length === 0) return null;

  return (
    <JobCard
      id="handle-requests"
      title="Handle corrections requested"
      state="now"
      status={<Pill tone="warn">{requests.length} waiting</Pill>}
      hint="Each of these creators is stuck: their submissions are checked against the old handle until you decide. Approving applies the change through the same audited path as a direct fix."
    >
      <ul className="flex flex-col gap-4">
        {requests.map((request) => (
          <li
            key={request.id}
            className="rounded-lg border border-line bg-card p-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold text-white">
                {request.creatorName}
              </span>
              <span className="text-sm text-ink-3">
                {request.creatorEmail}
              </span>
              <Pill>{request.platform}</Pill>
            </div>

            <p className="mt-2 font-mono text-sm text-ink-2">
              @{request.oldHandle}
              <span className="mx-2 text-ink-4">to</span>
              <span className="text-brand-gold">@{request.requestedHandle}</span>
            </p>

            {/* The creator's own words, quoted rather than paraphrased,
                because they are what is being judged. */}
            <blockquote className="mt-2 max-w-prose border-l-2 border-line-2 pl-3 text-sm leading-relaxed text-ink-2">
              {request.reason}
            </blockquote>

            {rejecting === request.id ? (
              <div className="mt-3 flex flex-col gap-2">
                <label htmlFor={`why-${request.id}`} className="sr-only">
                  Why it is rejected
                </label>
                <input
                  id={`why-${request.id}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={300}
                  placeholder="Why not, in a sentence the creator will read"
                  className="min-h-11 w-full rounded-lg border border-line-2 bg-control px-4 text-base text-white placeholder:text-ink-3 focus:border-brand-gold"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === request.id || !note.trim()}
                    onClick={() => decide(request.id, false, note.trim())}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-red-400/40 px-5 text-sm font-semibold text-red-300 transition-[background-color,transform] duration-150 hover:bg-red-400/15 active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy === request.id ? "Rejecting…" : "Reject with this note"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(null);
                      setNote("");
                    }}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold text-ink-2 transition-colors hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === request.id}
                  onClick={() => decide(request.id, true)}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-green-400/15 px-5 text-sm font-semibold text-green-300 transition-[background-color,transform] duration-150 hover:bg-green-400/25 active:scale-[0.98] disabled:opacity-60"
                >
                  {busy === request.id ? "Approving…" : "Approve the change"}
                </button>
                <button
                  type="button"
                  disabled={busy === request.id}
                  onClick={() => setRejecting(request.id)}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-2 px-5 text-sm font-semibold text-white transition-colors hover:bg-card-3 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </JobCard>
  );
}
