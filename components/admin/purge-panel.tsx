"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MONICA_SLUG } from "@/lib/campaigns";

/**
 * Clear the test data before launch.
 *
 * Production has been used for real testing, so there are creators, entries,
 * approved points and a referral in it that belong to nobody. All of it has to
 * go before the campaign opens.
 *
 * The panel only renders before the campaign starts, and the database refuses
 * the call after that regardless. Both, because a component that disappears is
 * a nicety and a function that refuses is the guarantee.
 *
 * Typing the slug is the confirmation. A yes/no dialog is answered reflexively;
 * an eighteen-character slug typed by hand is not.
 */
export function PurgePanel({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState<{ table: string; rows: number }[] | null>(
    null,
  );

  async function purge() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed.trim() }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      setDone(result.deleted ?? []);
      setTyped("");
      toast.success(`Cleared ${result.total} rows`);
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const kept = done.filter((row) => row.rows > 0);
    return (
      <div>
        <p className="eyebrow text-ink-3">Cleared</p>
        <h2 className="mt-2 text-xl font-bold text-white">
          The campaign is empty
        </h2>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
          The campaign, the weekly challenges, the point rules and every admin
          are untouched. Start the campaign again when you are ready.
        </p>
        {kept.length > 0 && (
          <dl className="mt-5 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {kept.map((row) => (
              <div key={row.table} className="flex justify-between gap-4">
                <dt className="text-ink-3">{row.table}</dt>
                <dd className="tabular-nums text-ink-2">{row.rows}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="mt-2 text-xl font-bold text-white">Clear the test data</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
        Deletes every creator, entry, submission and point in this campaign, and
        nothing else: the campaign itself, the weekly challenges, the point rules
        and every admin sign-in stay exactly as they are. There is no undo.
      </p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
        This stops working the moment the campaign opens.
      </p>

      {!paused && (
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-amber-200/80">
          Pause the campaign first. Clearing it while people can still register
          means somebody registers into a database that is being emptied.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="purge-confirm" className="sr-only">
          Type {MONICA_SLUG} to confirm
        </label>
        <input
          id="purge-confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          disabled={!paused}
          autoComplete="off"
          spellCheck={false}
          placeholder={`Type ${MONICA_SLUG} to confirm`}
          className="min-w-0 flex-1 rounded-lg border border-line bg-control px-4 py-3 text-base text-white placeholder:text-ink-3 focus:border-red-400/60 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={busy || !paused || typed.trim() !== MONICA_SLUG}
          onClick={purge}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-red-400/15 px-6 text-sm font-semibold text-red-300 transition-colors duration-150 hover:bg-red-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {busy ? "Clearing..." : "Clear everything"}
        </button>
      </div>
    </div>
  );
}
