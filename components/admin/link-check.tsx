"use client";

import { useState } from "react";
import { toast } from "sonner";
import { buttonClass, JobCard, Pill } from "@/components/shared/panel";

interface GoneRow {
  submissionId: string;
  platform: string;
  url: string;
  status: number | null;
}

/**
 * The link-rot check, as a flagging queue and nothing more (#71).
 *
 * A creator deleting a post after approval keeps points for work that no
 * longer exists, and the "100+ UGC pieces" number reported to the sponsor
 * evaporates if a third of the links are dead at reporting time. But the
 * platforms lie to robots, so nothing here acts: it names candidates, and a
 * person opens each in a real browser before touching anything. The rules
 * clause requiring content to stay up to 31 October is what makes any
 * consequence enforceable; this is only how the conversation starts.
 */
export function LinkCheck() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{
    checked: number;
    unverifiable: number;
    gone: GoneRow[];
  } | null>(null);

  async function run() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/link-check", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      setReport({ checked: result.checked, unverifiable: result.unverifiable, gone: result.gone });
      toast.success(`Checked ${result.checked} approved links.`);
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <JobCard
      id="link-check"
      title="Check the approved links"
      state="todo"
      hint="Fetches each approved entry and flags what the platform itself says is gone (404 or 410). It never touches points: X and Instagram answer 403 to robots for posts that are perfectly live, so a link listed here means open it in a real browser first, then decide as a person."
      foot={
        <button type="button" disabled={busy} onClick={run} className={buttonClass("secondary")}>
          {busy ? "Checking…" : "Run the check"}
        </button>
      }
    >
      {report && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">
            {report.checked} checked. {report.unverifiable} answered like a bot
            wall and prove nothing either way.
          </p>

          {report.gone.length === 0 ? (
            <p className="text-sm font-semibold text-green-300">
              Nothing the platforms call gone.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.gone.map((row) => (
                <li key={row.submissionId} className="rounded-lg border border-amber-400/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="bad">{row.status ?? "gone"}</Pill>
                    <Pill>{row.platform}</Pill>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="min-w-0 break-all font-mono text-sm text-ink-2 underline-offset-2 hover:underline"
                    >
                      {row.url}
                    </a>
                  </div>
                  <p className="mt-1 text-sm text-ink-3">
                    Open it in a normal browser. If it is really gone, the
                    Decided screen is where the entry is re-opened.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </JobCard>
  );
}
