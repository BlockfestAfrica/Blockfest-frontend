"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { HandleRequestState, RegisteredHandle } from "@/lib/creator-session";

/**
 * Your accounts, with the way to get a typo fixed.
 *
 * Filing here changes nothing. The request and the reason go to the campaign
 * team, a person reads them in the console, and the registration only moves
 * when they approve it. The section says that plainly, because a form that
 * looks like it edits something and does not is how trust in the rest of the
 * page erodes.
 */
export function HandleFix({
  handles,
  requests,
  platformLabels,
}: {
  handles: RegisteredHandle[];
  requests: HandleRequestState[];
  platformLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const requestFor = (platform: string) =>
    requests.find((r) => r.platform === platform);

  async function submit(platform: string) {
    if (!handle.trim()) {
      toast.error("Enter the correct username.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Say what went wrong, so the team can check it.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/campaigns/monica/request-handle-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: handle.trim(), reason: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      toast.success("Request sent. The team reviews it by hand, usually within a day.");
      setOpen(null);
      setHandle("");
      setReason("");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ul className="mt-4 flex flex-col gap-3">
      {handles.map((h) => {
        const request = requestFor(h.platform);
        const pending = request?.status === "pending";
        const rejected = request?.status === "rejected";
        const isOpen = open === h.platform;

        return (
          <li
            key={`${h.platform}-${h.handle}`}
            className="rounded-lg border border-white/12 p-4"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-white">
                {platformLabels[h.platform] ?? h.platform}
              </span>
              <span className="font-mono text-white/80">@{h.handle}</span>

              {pending ? (
                <span className="text-sm text-amber-300">
                  Change to @{request.requestedHandle} requested, waiting for
                  review
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(isOpen ? null : h.platform);
                    setHandle("");
                    setReason("");
                  }}
                  aria-expanded={isOpen}
                  className="ml-auto inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-white/60 transition-colors hover:text-white"
                >
                  {isOpen ? "Cancel" : "Wrong username?"}
                </button>
              )}
            </div>

            {rejected && request.decisionNote && !isOpen && (
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/70">
                Your last request was not applied: {request.decisionNote}
              </p>
            )}

            {isOpen && !pending && (
              <div className="mt-3 flex flex-col gap-2">
                <p className="max-w-prose text-sm leading-relaxed text-white/70">
                  Nothing changes until the campaign team reads this and
                  approves it. Entries you submit keep being checked against
                  @{h.handle} in the meantime.
                </p>
                <label htmlFor={`fix-${h.platform}`} className="sr-only">
                  The correct username
                </label>
                <input
                  id={`fix-${h.platform}`}
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="the-right-username"
                  className="min-h-12 w-full rounded-lg border border-white/15 bg-white/[0.03] px-4 text-base text-white placeholder:text-white/55 focus:border-brand-gold"
                />
                <label htmlFor={`fix-why-${h.platform}`} className="sr-only">
                  What went wrong
                </label>
                <input
                  id={`fix-why-${h.platform}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={300}
                  placeholder="What went wrong, in a sentence"
                  className="min-h-12 w-full rounded-lg border border-white/15 bg-white/[0.03] px-4 text-base text-white placeholder:text-white/55 focus:border-brand-gold"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit(h.platform)}
                  className="inline-flex min-h-12 w-fit cursor-pointer items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-black transition-colors hover:bg-brand-gold-hover disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send the request"}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
