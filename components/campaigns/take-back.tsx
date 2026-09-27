"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass } from "@/components/shared/panel";
import { returnFocus } from "@/components/shared/reveal";
import { monicaRoutes } from "@/lib/campaigns";

/**
 * Take a pending entry back.
 *
 * The receipt mail has always said to send the right one instead if the link
 * was wrong, and the index refused a second submission on that platform while
 * the first sat pending, so the advice was impossible to follow. It is also
 * what somebody does on finding a receipt for an entry they never sent:
 * withdraw, then, if it was not them, rotate the link so whoever sent it is
 * locked out of the session too.
 *
 * Shared by the week card and the earlier-weeks list, which both offer it,
 * so there is one copy of the request and its messages.
 *
 * canResend says whether a replacement can actually be sent: only from the
 * open week's rows, while the creator is active and submissions are not
 * paused. Everywhere else the toast promises nothing, as withdrawnEmail's
 * closed-week branch does.
 */
export function useWithdraw({
  canResend,
  onDone,
}: {
  canResend: boolean;
  /** Called with the entry's id on success only, never on a failure. */
  onDone: (id: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  /* The button a refused take back was pressed with. A button disabled
     mid-request drops focus to the body in Chrome, so once it is live again
     focus goes back to it, unless the reader has moved on elsewhere. */
  const [refused, setRefused] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!refused || busy) return;
    returnFocus(refused, refused.closest("li"));
    setRefused(null);
  }, [refused, busy]);

  async function withdraw(id: string, wasNotMe: boolean, pressed?: HTMLElement) {
    setBusy(id);
    try {
      const response = await fetch("/api/campaigns/monica/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        setRefused(pressed ?? null);
        return;
      }
      if (wasNotMe) {
        /* Straight to recovery: a link somebody else is holding has to stop
           working, and rotating it ends their session too. */
        window.location.href = monicaRoutes.recover;
        return;
      }
      toast.success(
        canResend ? "Taken back. That platform is free again this week." : "Taken back.",
      );
      onDone(id);
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
      setRefused(pressed ?? null);
    } finally {
      setBusy(null);
    }
  }

  return { busy, withdraw };
}

/**
 * The question, opened in place under the row it belongs to. The row's own
 * right hand carries Cancel, the way the ballot row does.
 */
export function TakeBackPanel({
  id,
  platformLabel,
  weekNo,
  canResend,
  weekClosed = false,
  busy,
  onWithdraw,
}: {
  id: string;
  platformLabel: string;
  weekNo: number;
  /** A replacement can be sent once it is gone (see useWithdraw). */
  canResend: boolean;
  /** The entry's week has closed, which is why it cannot be replaced. */
  weekClosed?: boolean;
  busy: boolean;
  /** With the button pressed, so a refusal can hand focus back to it. */
  onWithdraw: (wasNotMe: boolean, pressed: HTMLElement) => void;
}) {
  return (
    <div id={`take-back-${id}`} className="mt-3 space-y-3">
      <p className="max-w-prose text-sm leading-relaxed text-ink-2">
        {canResend ? (
          <>
            Taking this back frees {platformLabel} for week {weekNo}, so you can
            send the right post instead.
          </>
        ) : weekClosed ? (
          <>
            Taking this back removes it from review. Week {weekNo} is closed,
            so it cannot be replaced.
          </>
        ) : (
          "Taking this back removes it from review."
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={(event) => onWithdraw(false, event.currentTarget)}
          className={buttonClass("secondary")}
        >
          {busy ? "Working…" : "Yes, take it back"}
        </button>
        {/* The security answer, in one press: withdraw, then rotate the
            link so whoever sent this is locked out of the session as well. */}
        <button
          type="button"
          disabled={busy}
          onClick={(event) => onWithdraw(true, event.currentTarget)}
          aria-describedby={`take-back-${id}-why`}
          className={buttonClass("danger")}
        >
          I did not send this
        </button>
      </div>
      <p
        id={`take-back-${id}-why`}
        className="max-w-prose text-sm leading-relaxed text-ink-4"
      >
        &ldquo;I did not send this&rdquo; also gets you a new personal link,
        which stops the old one working for whoever used it.
      </p>
    </div>
  );
}
