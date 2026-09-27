"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { buttonClass, control } from "@/components/shared/panel";
import { returnFocus, reveal } from "@/components/shared/reveal";
import { MarkLink, MarkStill, platformLabel } from "@/components/shared/platform-marks";
import { CAMPAIGN_EVENTS, track } from "@/lib/sabilytics";
import { TakeBackPanel, useWithdraw } from "@/components/campaigns/take-back";

export interface WeekRow {
  platform: string;
  /** The registered account, when the accounts could be read. */
  handle: string | null;
  entry: {
    id: string;
    status: string;
    url: string;
    reviewNote: string | null;
  } | null;
  /** Registered, not used up this week, and the page is taking entries. */
  canSubmit: boolean;
}

/**
 * Where an entry got to: its words, the colour of those words, and the row's
 * left edge, as everywhere else in the system.
 *
 * An unmapped status says so rather than presenting itself as understood;
 * the fallback used to dress an unknown status in "waiting to be reviewed"
 * while printing the raw database token as its label.
 */
const ENTRY_STATE: Record<string, { label: string; tone: string; edge: string }> = {
  pending: { label: "Waiting for review", tone: "text-ink-3", edge: "border-l-transparent" },
  approved: { label: "Approved", tone: "text-green-300", edge: "border-l-green-400/50" },
  rejected: { label: "Needs a change", tone: "text-red-300", edge: "border-l-red-400/60" },
};
const UNKNOWN_STATE = { label: "In review", tone: "text-ink-3", edge: "border-l-transparent" };

export const entryState = (status: string) => ENTRY_STATE[status] ?? UNKNOWN_STATE;

type Open = { platform: string; mode: "submit" | "take" } | null;

/**
 * The open week, one row per platform: the ballot row, for a creator.
 *
 * The mark on the left (a link to the post once there is one), the account
 * and where it stands, and one compact action at the right hand: Submit on
 * an empty slot, Send again on a rejected one, Take back on one still
 * waiting. "Have I done TikTok yet" is answered by looking. Below sm the
 * action drops under the account, at its indent, so a creator's own handle
 * keeps the width after the mark instead of breaking mid-name at 320.
 *
 * One row open at a time. Every row's form is the same underlying action,
 * and two half-filled link fields side by side invite pasting the TikTok
 * link under Instagram. While a submit or a take back is in flight, nothing
 * else opens and the open row cannot be cancelled out from under it.
 */
export function WeekRows({
  rows,
  weekNo,
  challengeTitle,
  statusKnown,
  canResend,
}: {
  rows: WeekRow[];
  weekNo: number;
  challengeTitle: string;
  /** False when the entries could not be read: never claim "Not sent". */
  statusKnown: boolean;
  /** The page is taking entries (active, not paused, accounts read): a
      taken-back entry can be replaced this week. */
  canResend: boolean;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [back, setBack] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /* The row whose panel is open. One is open at a time and a request holds
     the rest, so it is also the row any request came from. */
  const origin = useRef<HTMLElement | null>(null);
  /* A success closes its own row only, never one opened since. */
  const done = (platform: string) => {
    setOpen((o) => (o?.platform === platform ? null : o));
    setBack(platform);
  };
  const { busy, withdraw } = useWithdraw({
    canResend,
    onDone: (id) => {
      const row = rows.find((r) => r.entry?.id === id);
      if (row) done(row.platform);
    },
  });
  const locked = submitting || busy !== null;
  const openRow = (event: React.MouseEvent<HTMLElement>, next: NonNullable<Open>) => {
    origin.current = event.currentTarget.closest("li");
    setOpen(next);
  };

  /*
   * Fired the first time somebody types into a link field, not on render,
   * and once per page view. Opening a form means they pressed Submit;
   * typing into it means they went and got their link, which is the step
   * worth having in a funnel. Held here, not in the form, because the form
   * remounts every time a row opens: cancelling and reopening, or trying X
   * and then TikTok, is still one creator starting once.
   */
  const started = useRef(false);
  const onStart = () => {
    if (started.current) return;
    started.current = true;
    track(CAMPAIGN_EVENTS.submissionStarted);
  };

  /* Focus goes back to the row's action when its panel closes: on Cancel,
     and after a submit or a take back succeeds, unless the creator has
     moved on elsewhere while it was in flight (returnFocus). A failure keeps
     the panel open, and hands focus back to the button that was pressed. */
  useEffect(() => {
    if (!back || open?.platform === back) return;
    returnFocus(document.getElementById(`week-action-${back}`), origin.current);
    setBack(null);
  }, [back, open]);

  return (
    <ul className="divide-y divide-line border-t border-line">
      {rows.map((row) => {
        const label = platformLabel(row.platform);
        const state = row.entry ? entryState(row.entry.status) : null;
        const isOpen = open?.platform === row.platform;
        const edge = isOpen
          ? "border-l-brand-gold bg-card-2"
          : (state?.edge ?? "border-l-transparent");
        const pending = row.entry?.status === "pending";
        const rejected = row.entry?.status === "rejected";
        // A rejection always says why, even when nobody wrote it down.
        const note = rejected
          ? (row.entry?.reviewNote ?? "No reason was recorded.")
          : row.entry?.reviewNote;
        /* What the action opens in place, so it can say so while closed
           (aria-expanded false) and point at it once open. */
        const mode = isOpen && open ? open.mode : row.canSubmit ? "submit" : pending ? "take" : null;
        const panelId =
          mode === "submit"
            ? `submit-panel-${row.platform}`
            : mode === "take" && row.entry
              ? `take-back-${row.entry.id}`
              : undefined;

        const action = isOpen ? (
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              setOpen(null);
              setBack(row.platform);
            }}
            aria-label={`Cancel, ${label}`}
            aria-expanded
            aria-controls={panelId}
            className={buttonClass("quiet", "min-w-24")}
          >
            Cancel
          </button>
        ) : row.canSubmit ? (
          <button
            id={`week-action-${row.platform}`}
            type="button"
            disabled={locked}
            onClick={(event) => openRow(event, { platform: row.platform, mode: "submit" })}
            aria-label={
              rejected
                ? `Send again, your ${label} post`
                : `Submit your ${label} post`
            }
            aria-expanded={false}
            aria-controls={panelId}
            className={buttonClass("secondary", "min-w-24")}
          >
            {rejected ? "Send again" : "Submit"}
          </button>
        ) : pending ? (
          /* Only while nobody has ruled on it. An approved entry has
             points minted against it and a rejected one is a
             reviewer's recorded judgement; neither is a creator's to
             erase, and the engine refuses both. */
          <button
            id={`week-action-${row.platform}`}
            type="button"
            disabled={locked}
            onClick={(event) => openRow(event, { platform: row.platform, mode: "take" })}
            aria-label={`Take back your ${label} post for week ${weekNo}`}
            aria-expanded={false}
            aria-controls={panelId}
            className={buttonClass("quiet", "min-w-24")}
          >
            Take back
          </button>
        ) : null;

        return (
          <li
            key={row.platform}
            className={`border-l-2 px-4 py-3 transition-colors duration-150 sm:px-5 ${edge}`}
          >
            {/* Top-aligned, so the mark sits beside the handle even when a
                rejection note makes the text column tall; the action stays
                centred on the row from sm up. */}
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
              {row.entry ? (
                <MarkLink
                  platform={row.platform}
                  url={row.entry.url}
                  label={`Your ${label} post for week ${weekNo}`}
                />
              ) : (
                <MarkStill platform={row.platform} empty />
              )}
              {/* The whole line after the mark below sm (the mark is 2.75rem
                  and the gap 0.75rem), so the action wraps under it. */}
              <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-0">
                <p className="text-base font-semibold leading-snug text-white [overflow-wrap:anywhere]">
                  <span className="sr-only">{label}: </span>
                  {row.handle ? `@${row.handle}` : label}
                </p>
                {state ? (
                  <p className={`mt-0.5 inline-flex items-center gap-1.5 text-sm ${state.tone}`}>
                    {row.entry?.status === "approved" && (
                      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {state.label}
                  </p>
                ) : statusKnown ? (
                  <p className="mt-0.5 text-sm text-ink-4">Not sent</p>
                ) : null}
                {/* The reason under the status it explains, so below sm it
                    reads before the action that answers it, not after. */}
                {note && (
                  <p className="mt-1 text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                    {note}
                  </p>
                )}
              </div>
              {/* Only drawn with something in it: an empty slot would wrap
                  to a blank second line below sm. Under the text below sm,
                  at its indent (ml-14, the mark and the gap); a quiet
                  button's label sits px-6 inside its pill, so its pill
                  starts that much earlier and the words still line up. */}
              {action && (
                <div className={`${mode === "take" || isOpen ? "ml-8" : "ml-14"} shrink-0 sm:ml-0 sm:self-center`}>
                  {action}
                </div>
              )}
            </div>

            {isOpen && open?.mode === "submit" && (
              <SubmitPanel
                platform={row.platform}
                handle={row.handle}
                challengeTitle={challengeTitle}
                onStart={onStart}
                onBusy={setSubmitting}
                onDone={() => done(row.platform)}
              />
            )}
            {isOpen && open?.mode === "take" && row.entry && (
              <TakeBackPanel
                id={row.entry.id}
                platformLabel={label}
                weekNo={weekNo}
                canResend={canResend}
                busy={busy === row.entry.id}
                onWithdraw={(wasNotMe, pressed) => withdraw(row.entry!.id, wasNotMe, pressed)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Submitting an entry, for the platform whose row was pressed.
 *
 * The creator does not choose the challenge: the server decides which week
 * is open, because there is one answer at any moment and letting the page
 * choose only creates a way to file an entry against the wrong week. Nor is
 * there a platform select any more: the row pressed is the choice, so the
 * account named in the hint and the platform sent are the same by
 * construction, which is what the old select once got wrong after a refresh.
 */
export function SubmitPanel({
  platform,
  handle,
  challengeTitle,
  onStart,
  onBusy,
  onDone,
}: {
  platform: string;
  /** The registered account, so the form names the rule it refuses on most. */
  handle: string | null;
  challengeTitle: string;
  /** Somebody typed into the link field. The rows keep it to once per page
      view, since this form remounts every time a row opens. */
  onStart: () => void;
  /** While the request is in flight, so the rows can hold everything else. */
  onBusy: (busy: boolean) => void;
  /** Success only; a refusal keeps the form open. */
  onDone: () => void;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const label = platformLabel(platform);

  // It opens under the row, which can sit near the fold on a phone.
  useEffect(() => {
    reveal(formRef.current, urlRef.current);
  }, []);

  /* A refusal about the link puts the cursor in the link (below); any other
     failure hands focus back to the button once it is live again. Disabled
     mid-request, it dropped focus to the body in Chrome. */
  useEffect(() => {
    if (!error || error.field === "url" || submitting) return;
    returnFocus(submitRef.current, formRef.current?.closest("li"));
  }, [error, submitting]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    onBusy(true);
    try {
      const response = await fetch("/api/campaigns/monica/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, url }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const message = result.message ?? "Something went wrong.";
        setError({ field: result.field, message });
        toast.error(message);
        // Into the link it is about, but only by the same rule as every
        // other return: not from wherever the creator went meanwhile.
        if (result.field === "url") returnFocus(urlRef.current, formRef.current?.closest("li"));
        return;
      }
      track(CAMPAIGN_EVENTS.submissionCompleted);
      toast.success(`Submitted for ${challengeTitle}`);
      setUrl("");
      onDone();
      // The server owns the list of what has been submitted, so refresh
      // rather than guessing the new state here and drifting from it.
      router.refresh();
    } catch {
      const message =
        "We could not reach the server. Check your connection and try again.";
      setError({ message });
      toast.error(message);
    } finally {
      setSubmitting(false);
      onBusy(false);
    }
  }

  const id = `url-${platform}`;
  return (
    <form
      ref={formRef}
      id={`submit-panel-${platform}`}
      onSubmit={submit}
      noValidate
      className="mt-3 scroll-mb-6 space-y-2"
    >
      <label htmlFor={id} className="block text-sm font-semibold text-white">
        Public link to your post
      </label>
      {/* The rule at the moment it can still be obeyed: a friend would
          accept anybody's post, the campaign only this account's. */}
      {handle && (
        <p id={`${id}-hint`} className="text-sm leading-relaxed text-ink-3">
          It has to be a post from @{handle}, the {label} account you
          registered.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={id}
          ref={urlRef}
          value={url}
          onChange={(e) => {
            onStart();
            setUrl(e.target.value);
            setError(null);
          }}
          inputMode="url"
          placeholder="https://"
          aria-describedby={handle ? `${id}-hint` : undefined}
          aria-invalid={error?.field === "url" || undefined}
          className={`${control} sm:flex-1`}
        />
        <button
          ref={submitRef}
          type="submit"
          disabled={submitting || !url.trim()}
          className={buttonClass("primary", "w-full sm:w-auto")}
        >
          {submitting ? "Submitting…" : "Submit this entry"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error.message}
        </p>
      )}
    </form>
  );
}
