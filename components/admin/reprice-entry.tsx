"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass, control, Field, JobCard } from "@/components/shared/panel";
import { Confirm } from "@/components/shared/confirm";

/**
 * Bring one entry to current rates, on purpose (#68).
 *
 * The deliberate lever that keeps rate edits honest: changing a value never
 * touches history, and when history genuinely needs bringing forward, it is
 * one named entry, one reason, one audit row with the totals it moved
 * between. Never automatic, which is why this lives on Tools rather than
 * beside the rate editor: distance is part of the design.
 */
export function RepriceEntry() {
  const router = useRouter();
  const [entryId, setEntryId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const id = entryId.trim();
  // Asked only once the id and reason would pass, so a malformed paste gets
  // its own message straight away instead of a question about nothing.
  const ready = /^[0-9a-f-]{36}$/i.test(id) && reason.trim().length > 0;

  async function reprice() {
    if (!/^[0-9a-f-]{36}$/i.test(entryId.trim())) {
      toast.error("Paste the entry id, the long code on the audit row.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Say why. It is what a dispute is answered with.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/reprice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entryId.trim(), reason: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(`Repriced. The creator's total moved from ${result.before} to ${result.after}.`);
      setEntryId("");
      setReason("");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <JobCard
      id="reprice"
      title="Reprice one entry"
      state="todo"
      hint="Rate changes never touch entries that already exist. When one genuinely should be brought to the current rates, this does it: one entry, a reason, an audit row carrying the totals it moved between."
    >
      <div className="flex flex-col gap-4">
        <Field id="reprice-entry" label="Entry id">
          <input
            id="reprice-entry"
            value={entryId}
            onChange={(event) => setEntryId(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="3f2504e0-4f89-11d3-9a0c-0305e82c3301"
            className={control}
          />
        </Field>
        <Field id="reprice-why" label="Why">
          <input
            id="reprice-why"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            placeholder="The team decision on rates, applied to this entry because…"
            className={control}
          />
        </Field>
        {/* Nothing on screen says whose entry this is until the toast
            afterwards, and the only undo is a manual award that mails the
            creator again, so the id is said back before it runs. */}
        <Confirm
          label="Reprice this entry"
          when={ready}
          question={`Reprice entry ${id.slice(0, 8)}…${id.slice(-4)} to today's rates?`}
          consequence="The creator's total moves straight away and they are emailed if it changes. There is no undo; a mistake is corrected with a manual award."
          confirmLabel="Yes, reprice it"
          pending={busy}
          onConfirm={reprice}
          triggerClassName={buttonClass("secondary", "w-fit")}
        />
      </div>
    </JobCard>
  );
}
