"use client";

import { useState } from "react";
import { buttonClass } from "@/components/shared/panel";

type Outcome = "stopped" | "already" | "unknown";

const SAID: Record<Outcome, string> = {
  stopped: "Done. We will not email you about future campaigns again.",
  already: "You had already stopped these. We will not email you about future campaigns.",
  unknown:
    "We do not recognise this link. If it came from a test or a forwarded copy it stops nobody. Write to the address below and we will stop them by hand.",
};

/**
 * The one button on the stop page. Posts the token from the link; the page
 * itself never acts on load (app/campaigns/monica-money-story/stop-emails).
 */
export function StopEmails({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(token ? null : "unknown");
  const [error, setError] = useState("");

  async function stop() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/campaigns/monica/stop-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        setError(result.message ?? "That did not work. Try again in a minute.");
        return;
      }
      setOutcome(result.outcome as Outcome);
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (outcome) {
    return (
      <p role="status" className="max-w-prose text-base leading-relaxed text-white">
        {SAID[outcome]}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={stop} disabled={busy} className={buttonClass("primary", "w-fit")}>
        {busy ? "Stopping…" : "Stop these emails"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
