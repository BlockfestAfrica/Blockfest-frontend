"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Confirm } from "@/components/shared/confirm";
import { buttonClass } from "@/components/shared/panel";

type Answer = { ok?: boolean; message?: string; sent?: number; failed?: number; left?: number; sentTo?: string };

async function press(mode: "test" | "send"): Promise<{ status: number; result: Answer | null }> {
  const response = await fetch("/api/admin/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const result = (await response.json().catch(() => null)) as Answer | null;
  return { status: response.status, result: result && typeof result === "object" ? result : null };
}

/**
 * Test, then send, for the Creator Challenge email (app/api/admin/broadcast).
 *
 * Send asks once, then keeps pressing on its own until everybody has it,
 * saying how far it has got. One press sends what fits in the platform's
 * time limit, so a few hundred creators is several presses, and asking the
 * owner to press each one is asking them to babysit a progress bar. It
 * stops the moment a press sends nobody or answers with something that is
 * not ours, and the counts on a reload are the truth either way.
 */
export function BroadcastPanel({ left, sent }: { left: number; sent: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [progress, setProgress] = useState("");

  async function test() {
    setBusy("test");
    try {
      const { result } = await press("test");
      if (result?.ok) toast.success(`Test sent to ${result.sentTo}. Check that inbox, and its spam folder.`);
      else toast.error(result?.message ?? "That did not work.");
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send");
    let total = 0;
    let failed = 0;
    try {
      for (;;) {
        const { status, result } = await press("send");
        if (status >= 500 || !result) {
          toast.error("It may have partly sent. Reload to see the counts before pressing again.");
          break;
        }
        if (!result.ok) {
          // A press that found nobody left after earlier presses is the finish.
          if (total > 0 && status === 409) break;
          toast.error(result.message ?? "That did not work.");
          break;
        }
        total += result.sent ?? 0;
        failed = result.failed ?? 0;
        const remaining = result.left ?? 0;
        setProgress(`Sent ${total}. ${remaining} to go…`);
        if (remaining === 0 || (result.sent ?? 0) === 0) break;
      }
      if (total > 0) {
        toast.success(
          `Sent to ${total} creators.${failed > 0 ? ` ${failed} did not send; press Send again to retry them.` : ""}`,
        );
      }
    } catch {
      toast.error("We could not reach the server. Reload to see the counts before pressing again.");
    } finally {
      setProgress("");
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={test}
          disabled={busy !== null}
          className={buttonClass("secondary", "w-fit")}
        >
          {busy === "test" ? "Sending the test…" : "Email me a test"}
        </button>
        {left > 0 && (
          <Confirm
            label={sent > 0 ? `Send the rest (${left})` : `Send to ${left} creators`}
            question={sent > 0 ? `Send it to the ${left} who have not had it?` : `Email ${left} creators about Monica's Creator Challenge?`}
            consequence={`One email each, exactly as the preview shows, with their own first name and their own stop link.${sent === 0 ? " You get one copy first." : ""} It keeps going until everybody has it, and nobody gets it twice. Keep this tab open until it says it is done.`}
            confirmLabel={sent > 0 ? `Yes, send ${left}` : `Yes, email ${left}`}
            pending={busy === "send"}
            disabled={busy !== null && busy !== "send"}
            onConfirm={send}
          />
        )}
      </div>
      {progress && (
        <p role="status" className="text-sm text-ink-2">
          {progress}
        </p>
      )}
    </div>
  );
}
