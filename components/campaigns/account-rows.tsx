"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { buttonClass, control } from "@/components/shared/panel";
import { ConfirmPanel } from "@/components/shared/confirm";
import { returnFocus, reveal } from "@/components/shared/reveal";
import { byPlatform, MarkStill, platformLabel } from "@/components/shared/platform-marks";
import { canonicalHandle } from "@/lib/campaign-registration";
import type { HandleRequestState, RegisteredHandle } from "@/lib/creator-session";

type Open = { kind: "fix" | "add"; platform: string } | null;

/**
 * When an added account can first be sent from, by why no week is open (or
 * that one is). Worked out by the page from the same stage lookup as its
 * week card: "open", a challenge is open now; "next", none is but a stage
 * remains; "over", no stage remains; "unknown", the challenge could not be
 * read, so nothing is promised either way.
 */
export type AddReadyWhen = "open" | "next" | "over" | "unknown";

/**
 * Your accounts as one list: a row per registered account (mark, @handle, a
 * correction at the right hand) and, while the enrolment is active, a row
 * per platform not yet added (dashed mark, Add). One form open at a time.
 *
 * Two jobs that look alike and are deliberately handled differently:
 *
 * A correction files a request. Filing changes nothing: the request and the
 * reason go to the campaign team, a person reads them in the console, and
 * the registration only moves when they approve it, because swapping a
 * handle can reassign authorship of work already submitted. The form says
 * that plainly; a form that looks like it edits something and does not is
 * how trust in the rest of the page erodes.
 *
 * Adding applies at once. Every handle is optional at registration, so
 * somebody who only had X that day registered X alone, and the ladder pays
 * more for the same piece on two or three platforms. Adding takes nothing
 * from anybody, so the creator can post the same day. It asks once first,
 * showing the username exactly as it will be stored (a pasted profile link
 * already reduced to the name): once added, only an approved request can
 * change it, and a typo costs a day in a campaign with weekly deadlines.
 */
export function AccountRows({
  handles,
  requests,
  missing,
  paused = false,
  when = "unknown",
}: {
  handles: RegisteredHandle[];
  requests: HandleRequestState[];
  /** Platforms not registered yet. Empty unless the enrolment is active:
      the engine refuses an add either way, and a control that cannot work
      is its own defect, whatever the server does with it. */
  missing: string[];
  /** Submissions are paused campaign-wide, so "straight away" is not true. */
  paused?: boolean;
  /** Whether a challenge is open, and if not, why (see AddReadyWhen).
      Unset, it promises nothing. */
  when?: AddReadyWhen;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [handle, setHandle] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [back, setBack] = useState<string | null>(null);
  /* The open form's row, and its own button (Send the request, or Add). One
     form is open at a time and a request holds the rest, so the row is also
     the one any request came from. */
  const origin = useRef<HTMLElement | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  /* A request was refused. Its button is disabled while it runs, which drops
     focus to the body in Chrome, so focus goes back to it once it is live. */
  const [refused, setRefused] = useState(false);

  /*
   * A form opens under its row, and for the last of up to three it can land
   * below the fold on a phone. Bring it into view with the cursor in its
   * first field, so pressing the button visibly does something.
   */
  useEffect(() => {
    if (!open) return;
    if (open.kind === "fix") {
      reveal(
        document.getElementById(`handle-fix-${open.platform}`),
        document.getElementById(`fix-${open.platform}`),
      );
    } else {
      reveal(
        document.getElementById(`add-panel-${open.platform}`),
        document.getElementById(`add-${open.platform}`),
      );
    }
  }, [open]);

  /* When an added account can first be used. Paused wins: it is the
     reason already said at the top of the week, and it can clear mid-week.
     With no stage left, or no way to know, it says nothing about when. */
  const ready: { hint: string; toast: (label: string) => string } = paused
    ? {
        hint: "Your username or profile link; it will be ready for when submissions reopen.",
        toast: (label) => `${label} added. It is ready for when submissions reopen.`,
      }
    : when === "open"
      ? {
          hint: "Your username or profile link; you can send posts from it straight away.",
          toast: (label) => `${label} added. You can send a post from it now.`,
        }
      : when === "next"
        ? {
            hint: "Your username or profile link; it will be ready for the next challenge.",
            toast: (label) => `${label} added. It is ready for the next challenge.`,
          }
        : {
            hint: "Your username or profile link.",
            toast: (label) => `${label} added.`,
          };

  // Focus goes back to the row's action when its form is cancelled, or once
  // a request or an add succeeds, unless the creator has moved on elsewhere
  // meanwhile (returnFocus). A failure keeps the form, and focus goes back
  // to the button that was pressed.
  useEffect(() => {
    if (!back || open?.platform === back) return;
    returnFocus(document.getElementById(`account-action-${back}`), origin.current);
    setBack(null);
  }, [back, open]);

  useEffect(() => {
    if (!refused || busy) return;
    returnFocus(submitRef.current, origin.current);
    setRefused(false);
  }, [refused, busy]);

  const openRow = (event: React.MouseEvent<HTMLElement>, next: NonNullable<Open>) => {
    origin.current = event.currentTarget.closest("li");
    setOpen(next);
    setHandle("");
    setReason("");
    setConfirming(false);
  };
  const close = (platform: string) => {
    setOpen(null);
    setBack(platform);
  };
  /* A success closes its own row only, never one opened since. */
  const done = (platform: string) => {
    setOpen((o) => (o?.platform === platform ? null : o));
    setBack(platform);
  };

  async function requestFix(platform: string) {
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
        setRefused(true);
        return;
      }
      toast.success("Request sent. The team reviews it by hand, usually within a day.");
      done(platform);
      setHandle("");
      setReason("");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
      setRefused(true);
    } finally {
      setBusy(false);
    }
  }

  async function add(platform: string) {
    const value = handle.trim().replace(/^@/, "");
    if (!value) {
      toast.error("Enter your username.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/campaigns/monica/handles/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: value }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        setRefused(true);
        return;
      }
      toast.success(ready.toast(platformLabel(platform)));
      done(platform);
      setHandle("");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
      setRefused(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ul className="divide-y divide-line border-t border-line">
      {byPlatform(handles, (h) => h.platform).map((h) => {
        const label = platformLabel(h.platform);
        const request = requests.find((r) => r.platform === h.platform);
        const pending = request?.status === "pending";
        const rejected = request?.status === "rejected" && !!request.decisionNote;
        const isOpen = open?.kind === "fix" && open.platform === h.platform;
        const edge = isOpen
          ? "border-l-brand-gold bg-card-2"
          : pending
            ? "border-l-amber-400/60"
            : rejected
              ? "border-l-red-400/60"
              : "border-l-transparent";

        return (
          <li
            key={`${h.platform}-${h.handle}`}
            className={`border-l-2 px-4 py-3 transition-colors duration-150 sm:px-5 ${edge}`}
          >
            {/* The pencil is an icon and stays at the right hand; Cancel is a
                word-wide button, so below sm it drops under the handle while
                the correction is open, as the week's rows do, its label (px-6
                inside the pill, hence ml-8) in line with the handle. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
              <MarkStill platform={h.platform} />
              <div
                className={`min-w-0 flex-1 ${
                  isOpen ? "basis-[calc(100%-3.5rem)] sm:basis-0" : ""
                }`}
              >
                <p className="text-base font-semibold leading-snug text-white [overflow-wrap:anywhere]">
                  <span className="sr-only">{label}: </span>@{h.handle}
                </p>
                {pending && (
                  <p className="mt-0.5 text-sm text-ink-3 [overflow-wrap:anywhere]">
                    Change to @{request.requestedHandle} requested, waiting for
                    review
                  </p>
                )}
              </div>
              {/* One request at a time: nothing to offer while one waits. */}
              {!pending && (
                <div className={isOpen ? "ml-8 shrink-0 sm:ml-0" : "shrink-0"}>
                  {isOpen ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => close(h.platform)}
                      aria-label={`Cancel the ${label} correction`}
                      aria-expanded
                      aria-controls={`handle-fix-${h.platform}`}
                      className={buttonClass("quiet", "min-w-24")}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      id={`account-action-${h.platform}`}
                      type="button"
                      disabled={busy}
                      onClick={(event) => openRow(event, { kind: "fix", platform: h.platform })}
                      aria-label={`Wrong username? Ask for a correction to your ${label} account, @${h.handle}`}
                      aria-expanded={false}
                      aria-controls={`handle-fix-${h.platform}`}
                      title="Wrong username?"
                      className="inline-flex h-12 min-h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-card-2 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {rejected && !isOpen && (
              <p className="mt-1 pl-14 text-sm leading-relaxed text-ink-2">
                Your last request was not applied: {request.decisionNote}
              </p>
            )}

            {isOpen && (
              <div
                id={`handle-fix-${h.platform}`}
                className="mt-3 flex scroll-mb-6 flex-col gap-2"
              >
                <p className="max-w-prose text-sm leading-relaxed text-ink-2">
                  Nothing changes until the campaign team approves it, and
                  entries keep being checked against{" "}
                  <span className="[overflow-wrap:anywhere]">@{h.handle}</span>{" "}
                  until then.
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
                  className={control}
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
                  className={control}
                />
                <button
                  ref={submitRef}
                  type="button"
                  disabled={busy}
                  onClick={() => requestFix(h.platform)}
                  className={buttonClass("primary", "w-full sm:w-fit")}
                >
                  {busy ? "Sending…" : "Send the request"}
                </button>
              </div>
            )}
          </li>
        );
      })}

      {byPlatform(missing, (p) => p).map((platform) => {
        const label = platformLabel(platform);
        const isOpen = open?.kind === "add" && open.platform === platform;
        return (
          <li
            key={`add-${platform}`}
            className={`border-l-2 px-4 py-3 transition-colors duration-150 sm:px-5 ${
              isOpen ? "border-l-brand-gold bg-card-2" : "border-l-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <MarkStill platform={platform} empty />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold leading-snug text-ink-3">{label}</p>
                <p className="mt-0.5 text-sm text-ink-4">Not added</p>
              </div>
              <div className="shrink-0">
                {isOpen ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => close(platform)}
                    aria-label={`Cancel adding ${label}`}
                    aria-expanded
                    aria-controls={`add-panel-${platform}`}
                    className={buttonClass("quiet", "min-w-24")}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    id={`account-action-${platform}`}
                    type="button"
                    disabled={busy}
                    onClick={(event) => openRow(event, { kind: "add", platform })}
                    aria-label={`Add ${label}`}
                    aria-expanded={false}
                    aria-controls={`add-panel-${platform}`}
                    className={buttonClass("secondary", "min-w-24")}
                  >
                    Add
                  </button>
                )}
              </div>
            </div>

            {isOpen && (
              <div id={`add-panel-${platform}`} className="mt-3 scroll-mb-6 space-y-2">
                <label
                  htmlFor={`add-${platform}`}
                  className="block text-sm font-semibold text-white"
                >
                  Your {label} username
                </label>
                <p id={`add-${platform}-hint`} className="text-sm leading-relaxed text-ink-3">
                  {ready.hint}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id={`add-${platform}`}
                    name={`add-${platform}`}
                    autoComplete="off"
                    value={handle}
                    readOnly={confirming}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder="yourname"
                    // Room for a pasted profile link, which the route
                    // reduces to the name; 41 cut such links off mid-name.
                    maxLength={200}
                    aria-describedby={`add-${platform}-hint`}
                    className={`${control} sm:flex-1`}
                  />
                  {!confirming && (
                    <button
                      ref={submitRef}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        // Nothing to ask about an empty box; add() says so.
                        if (canonicalHandle(handle)) setConfirming(true);
                        else add(platform);
                      }}
                      className={buttonClass("primary", "w-full sm:w-auto")}
                    >
                      {busy ? "Adding…" : `Add ${label}`}
                    </button>
                  )}
                </div>
                {confirming && (
                  <ConfirmPanel
                    className="mt-1"
                    label={`Add ${label}`}
                    question={`Add @${canonicalHandle(handle)} as your ${label} account?`}
                    consequence={`Every ${label} post you send has to come from @${canonicalHandle(handle)}. Once it is added, only the campaign team can change it, and that takes a request.`}
                    confirmLabel="Yes, add it"
                    cancelLabel="Go back"
                    onCancel={() => {
                      setConfirming(false);
                      document.getElementById(`add-${platform}`)?.focus();
                    }}
                    onConfirm={() => {
                      setConfirming(false);
                      add(platform);
                    }}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
