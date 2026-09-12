"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";

/**
 * Stop the campaign, without a deploy.
 *
 * The only ways to stop people entering used to be a code change and a build,
 * or editing the database by hand with a connection string that is not readable
 * from the dashboard. On a launch morning with something going wrong, neither
 * is a plan.
 *
 * Pausing asks for a reason and will not proceed without one. It is shown to
 * creators verbatim, so the cost is one sentence at the moment of pausing and
 * the saving is every person who would otherwise hit a silent refusal, try
 * again, and write in.
 *
 * Resuming needs no reason and no confirmation. Getting the campaign back is
 * the thing that should be easiest.
 */
export function PauseSwitch({
  paused,
  reason,
}: {
  paused: boolean;
  reason: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");

  async function flip(next: boolean) {
    if (next && !draft.trim()) {
      toast.error("A pause needs a reason. Creators see it.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paused: next,
          reason: next ? draft.trim() : undefined,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      toast.success(next ? "Campaign paused" : "Campaign running again");
      setDraft("");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (paused) {
    return (
      <Panel tone="danger" className="mt-16">
        <p className="eyebrow text-red-300">Paused</p>
        <h2 className="mt-2 text-xl font-bold text-white">
          Nobody can register or submit
        </h2>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/70">
          Creators are being told: {reason ?? "no reason recorded"}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => flip(false)}
          className="mt-5 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-brand-gold px-6 text-sm font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover disabled:opacity-60"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          {busy ? "Working..." : "Start the campaign again"}
        </button>
      </Panel>
    );
  }

  return (
    <div className="mt-16 max-w-2xl border-t border-white/12 pt-8">
      <p className="eyebrow text-white/45">Emergency</p>
      <h2 className="mt-2 text-xl font-bold text-white">Pause the campaign</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/50">
        Stops registration and submissions at once. Every page stays readable,
        so creators can still see the rules and the leaderboard. Takes effect on
        their next click, not on the next deploy.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="pause-reason" className="sr-only">
          Why, shown to creators
        </label>
        <input
          id="pause-reason"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          placeholder="Why. Creators see this exactly as written."
          className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-red-400/60 focus:outline-none"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => flip(true)}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-red-400/15 px-6 text-sm font-semibold text-red-300 transition-colors duration-300 hover:bg-red-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Pause className="h-4 w-4" aria-hidden="true" />
          Pause
        </button>
      </div>
    </div>
  );
}
