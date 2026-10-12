"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, Trophy, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { buttonClass, Pill } from "@/components/shared/panel";
import { Confirm } from "@/components/shared/confirm";
import { openableHref } from "@/lib/admin/openable-href";
import { canonicalEmail } from "@/lib/campaign-registration";
import { readTicketCodes } from "@/lib/rovv-codes";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export type RovvStatus = "pending" | "eligible" | "ineligible";

export interface RovvQueueItem {
  id: string;
  fullName: string;
  email: string;
  tiktokHandle: string;
  tiktokUrl: string;
  referralCode: string;
  status: RovvStatus;
  reviewNote: string | null;
  reviewerEmail: string | null;
  /** Pre-formatted Lagos times, so this component never touches timezones. */
  submittedAtLabel: string;
  reviewedAtLabel: string | null;
  winner: boolean;
  /** When the winner email left. Null until then. */
  notifiedAtLabel: string | null;
  /** 1, plus one per replacement by the entrant. Sent with a ruling. */
  revision: number;
  /** Other entries naming the same video. Only one can be eligible. */
  sameVideo: number;
  /** An admin's test entry (0074), never public, exported or counted. */
  isTest: boolean;
  /** The winner's ticket code, once an owner has given one. */
  ticketCode: string | null;
  /** Other entries under the same TikTok username. */
  sameHandle?: number;
  /** Other entries with the same referral code. */
  sameReferral?: number;
  /** When it last changed, Lagos, pre-formatted: shown on a replaced entry. */
  updatedAtLabel?: string;
  /**
   * The ruling the entrant was last emailed (0074), or null. Left out, the
   * card says nothing about it, rather than guessing.
   */
  rulingEmailed?: RovvStatus | null;
}

/** Reasons reviewers give most, one tap each; the box stays editable. */
const QUICK_REASONS = [
  "Your video is not public, so we cannot watch it.",
  "Your video does not tag @rovvafrica and @blockfestafrica.",
  "Your video does not use #ROVVMeToBlockfest.",
  "The video is not from the TikTok account you entered with.",
  "Your video is not on the prompt \u201cIf ROVV takes me to Blockfest\u2026\u201d.",
  "ROVV could not confirm your referral code.",
  "Entrants must be 18 or over.",
];

const isShortLink = (url: string) => /\/\/(vm|vt)\.tiktok\.com\/|tiktok\.com\/t\//i.test(url);

const STATUS: Record<RovvStatus, { tone: "warn" | "good" | "bad"; label: string; edge: string }> = {
  pending: { tone: "warn", label: "Waiting", edge: "border-l-amber-400" },
  eligible: { tone: "good", label: "Eligible", edge: "border-l-green-400/70" },
  ineligible: { tone: "bad", label: "Ineligible", edge: "border-l-red-400/70" },
};

type Action = RovvStatus | "pick" | "unpick";

const BUSY_LABEL: Record<Action, string> = {
  eligible: "Marking…",
  ineligible: "Ruling out…",
  pending: "Moving…",
  pick: "Picking…",
  unpick: "Unpicking…",
};

const DONE_LABEL: Record<Action, string> = {
  eligible: "Eligible",
  ineligible: "Ineligible",
  pending: "Back to waiting",
  pick: "Winner",
  unpick: "Unpicked",
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    winners?: number;
    sent?: number;
    failed?: number;
    deleted?: number;
    sentTo?: string;
    assigned?: { entryId: string; handle: string; code: string }[];
    unused?: number;
    unusedCodes?: string[];
    skipped?: string[];
    emailed?: boolean;
    /** A ruling's email was tried and did not leave. */
    emailFailed?: boolean;
    freedCode?: string | null;
  };
  // The status too, for a long press that can tell "refused" from "cut off".
  return { good: response.ok && result.ok === true, result, status: response.status };
}

/**
 * Rovv's entries, each with what a reviewer checks and the call to make.
 *
 * Every entry is open on the card rather than collapsed, unlike the Monica
 * queue: there is one link and one code to check, not a challenge brief, and
 * the owner works this on a phone. Ineligible asks for its reason in place,
 * since the reason is required and is the only thing that says why later.
 *
 * Every press waits for the server and then refreshes, refused or not, the
 * same as the review queue: two admins work this list at once, and a row
 * describing a state that has since changed must not keep its buttons live.
 *
 * Eligible can carry a judge's note, behind "Add a note" so a card stays
 * short: kept for the team, never emailed (the eligible email has no place
 * for one), unlike an ineligible reason, which is.
 */
export function RovvQueue({
  items,
  owner,
  winners,
  cap,
  announced = false,
}: {
  items: RovvQueueItem[];
  /** Owners pick winners; reviewers only rule on entries. */
  owner: boolean;
  /** How many are picked now, across the whole campaign. */
  winners: number;
  /** How many can be picked. */
  cap: number;
  /**
   * Whether any real winner has been emailed. An eligible ruling after that
   * is deliberately not emailed, so it is not flagged as "Not emailed".
   */
  announced?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);
  /** The entry whose reason box is open, if any. */
  const [ruling, setRuling] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  /** Judges' notes being written, and which cards have the note box open. */
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noting, setNoting] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  /** The winner whose unpick is waiting for a second tap (it frees their code). */
  const [unpicking, setUnpicking] = useState<string | null>(null);
  /** The entry whose username or email is being corrected. */
  const [correcting, setCorrecting] = useState<string | null>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const shown = items.slice(0, visible);

  // The reason is the next thing to type, so it takes focus (and, on a
  // phone, scrolls into view above the keyboard).
  useEffect(() => {
    if (ruling) reasonRef.current?.focus();
  }, [ruling]);

  async function act(item: RovvQueueItem, action: Action) {
    const note = (reasons[item.id] ?? "").trim();
    // Only from a box on screen, so a note typed and then put away (or
    // hidden by the reason box) is never sent without being seen.
    const judgeNote = noting[item.id] && ruling !== item.id ? (notes[item.id] ?? "").trim() : "";
    if (action === "ineligible" && !note) {
      toast.error("Ruling an entry out needs a reason. The entrant is emailed it.");
      return;
    }
    /* Unpicking a winner who holds a code frees that code (a paid ticket),
       so it takes a second tap that says so. */
    if (action === "unpick" && item.ticketCode && unpicking !== item.id) {
      setUnpicking(item.id);
      return;
    }
    setUnpicking(null);

    setBusy({ id: item.id, action });
    try {
      const { good, result } =
        action === "pick" || action === "unpick"
          ? await postJson("/api/admin/rovv/winner", { entryId: item.id, pick: action === "pick" })
          : await postJson("/api/admin/rovv/decision", {
              entryId: item.id,
              status: action,
              note: action === "ineligible" ? note : action === "eligible" && judgeNote ? judgeNote : undefined,
              revision: item.revision,
              from: item.status,
            });

      if (!good) {
        toast.error(result.message ?? "That did not work.");
        await router.refresh();
        return;
      }

      // Named, so a mis-tap can be found again by who it was. And whether
      // the entrant heard, since a ruling now emails them; a send that failed
      // gets its own red toast below rather than a line in a green one.
      const heard =
        (action === "eligible" || action === "ineligible") && !result.emailFailed
          ? result.emailed
            ? " The entrant has been emailed."
            : " No email went to the entrant (already told, or not due)."
          : "";
      const freed = action === "unpick" && result.freedCode ? ` Their code ${result.freedCode} is free again.` : "";
      toast.success(
        `${DONE_LABEL[action]}: ${item.fullName} (@${item.tiktokHandle})${
          typeof result.winners === "number" ? `. ${result.winners} of ${cap} picked.` : ""
        }${heard}${freed}`,
      );
      if (result.emailFailed) {
        toast.error("The email did not send. Move it back to waiting and rule again to retry.");
      }
      if (action === "ineligible") {
        setRuling(null);
        setReasons((r) => ({ ...r, [item.id]: "" }));
      }
      // After any ruling: a half-written judge's note must not come back on
      // the card and be saved with a later Eligible it was not written for.
      setNoting((n) => ({ ...n, [item.id]: false }));
      setNotes((n) => ({ ...n, [item.id]: "" }));
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  function copyCode(item: RovvQueueItem) {
    navigator.clipboard?.writeText(item.referralCode).then(
      () => {
        setCopied(item.id);
        toast.success(`Copied ${item.referralCode}`);
      },
      () => toast.error("Could not copy. Select the code and copy it by hand."),
    );
  }

  const isBusy = (item: RovvQueueItem, action: Action) =>
    busy?.id === item.id && busy.action === action;

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {shown.map((item) => {
          const state = STATUS[item.status];
          const href = openableHref(item.tiktokUrl);
          const locked = busy?.id === item.id;
          /* Ruled, but the entrant was never emailed that ruling: the send
             failed, or their address was corrected since. Not an eligible
             ruling made after the winners went out, which is not emailed on
             purpose. */
          const unheard =
            item.rulingEmailed !== undefined &&
            item.status !== "pending" &&
            item.rulingEmailed !== item.status &&
            !(item.status === "eligible" && announced);
          // Not beside an open reason box: a card is being ruled one way or the other.
          const noteOpen = Boolean(noting[item.id]) && ruling !== item.id;
          return (
            <li
              key={item.id}
              className={`border-l-2 p-4 ${item.winner ? "border-l-brand-gold" : state.edge}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {item.isTest && <Pill tone="neutral">Test entry</Pill>}
                <Pill tone={state.tone}>{state.label}</Pill>
                {unheard && <Pill tone="warn">Not emailed</Pill>}
                {item.winner && (
                  <Pill tone="gold">{item.notifiedAtLabel ? "Winner · emailed" : "Winner"}</Pill>
                )}
                {/* The entrant sent it again, so the video may not be the one
                    somebody watched earlier. */}
                {item.revision > 1 && (
                  <Pill tone="neutral">Replaced by entrant{item.updatedAtLabel ? ` ${item.updatedAtLabel}` : ""}</Pill>
                )}
                {/* The same person entering twice, under another email: each
                    person enters, and wins, once. */}
                {(item.sameHandle ?? 0) > 0 && (
                  <Pill tone="bad">
                    Same TikTok username as {item.sameHandle} other {item.sameHandle === 1 ? "entry" : "entries"}
                  </Pill>
                )}
                {(item.sameReferral ?? 0) > 0 && (
                  <Pill tone="bad">
                    Same referral code as {item.sameReferral} other {item.sameReferral === 1 ? "entry" : "entries"}
                  </Pill>
                )}
                {/* Somebody else entered this video too. Usernames and links
                    can be copied; check which entrant really posted it. */}
                {item.sameVideo > 0 && (
                  <Pill tone="bad">
                    Same video as {item.sameVideo} other {item.sameVideo === 1 ? "entry" : "entries"}
                  </Pill>
                )}
                <span className="ml-auto shrink-0 text-sm tabular-nums text-ink-3">
                  {item.submittedAtLabel}
                </span>
              </div>

              <p className="mt-2 text-base font-semibold text-white [overflow-wrap:anywhere]">
                {item.fullName}
              </p>
              <p className="mt-0.5 font-mono text-sm text-ink-2 [overflow-wrap:anywhere]">
                @{item.tiktokHandle}
              </p>
              <p className="mt-0.5 break-all text-sm text-ink-3">{item.email}</p>

              {/* The whole link, never truncated, and opened only where
                  openableHref can prove it is TikTok's. */}
              <div className="mt-2">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-block max-w-full break-all py-2 font-mono text-sm text-link underline underline-offset-2 hover:text-white"
                  >
                    {item.tiktokUrl}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <code className="block break-all py-2 text-sm text-ink-2">{item.tiktokUrl}</code>
                )}
              </div>

              {/* A short link hides whose video it is until it is opened. */}
              {isShortLink(item.tiktokUrl) && (
                <p className="text-sm text-ink-3">Short link: open it and check it is posted by @{item.tiktokHandle}.</p>
              )}

              {/* The code Rovv checks against its app. Monospace, so a 0 and
                  an O can be told apart when it is read out. */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm text-ink-3">Referral code</span>
                <code className="break-all font-mono text-base font-semibold text-white">
                  {item.referralCode}
                </code>
                <button
                  type="button"
                  onClick={() => copyCode(item)}
                  aria-label={`Copy ${item.fullName}'s referral code`}
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line-2 px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-card-2 hover:text-white"
                >
                  {copied === item.id ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied === item.id ? "Copied" : "Copy"}
                </button>
              </div>

              {item.status !== "pending" && (
                <p className="mt-2 text-sm text-ink-3">
                  {item.reviewerEmail ?? "reviewer no longer listed"}
                  {item.reviewedAtLabel ? ` · ${item.reviewedAtLabel}` : ""}
                </p>
              )}
              {item.reviewNote && (
                <p className="mt-2 border-l-2 border-line-2 pl-3 text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                  {/* Said, because an ineligible reason on the next card was
                      emailed word for word and this was not. */}
                  {item.status === "eligible" && <span className="text-ink-3">Judge&apos;s note, not emailed: </span>}
                  <span>{item.reviewNote}</span>
                </p>
              )}
              {unheard && (
                <p className="mt-2 text-sm text-ink-3">
                  {/* A winner cannot go back to waiting, and their winner
                      email says more than "in the running" would. */}
                  {item.winner
                    ? "The entrant has not been emailed this ruling. Their winner email will tell them."
                    : "The entrant has not been emailed this ruling. Move it back to waiting and rule again to send it."}
                </p>
              )}

              {item.status !== "eligible" && noteOpen && (
                <div className="mt-3 flex flex-col gap-1">
                  <label htmlFor={`note-${item.id}`} className="text-sm font-semibold text-white">
                    Judge&apos;s note (not emailed)
                  </label>
                  <input
                    id={`note-${item.id}`}
                    value={notes[item.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                    maxLength={500}
                    aria-describedby={`note-hint-${item.id}`}
                    placeholder="For the team: what stood out, for picking winners"
                    className="min-h-12 w-full min-w-0 rounded-lg border border-line bg-control px-4 py-3 text-base text-white placeholder:text-ink-3"
                  />
                  <p id={`note-hint-${item.id}`} className="text-sm text-ink-3">
                    Saved with Eligible and shown here. Never emailed, never sent to ROVV.
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {item.status !== "eligible" && (
                  <button
                    type="button"
                    disabled={locked}
                    aria-busy={isBusy(item, "eligible")}
                    onClick={() => act(item, "eligible")}
                    className={buttonClass("success", "px-5")}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {isBusy(item, "eligible") ? BUSY_LABEL.eligible : "Eligible"}
                  </button>
                )}
                {/* Behind a toggle, so a card without a note stays as short
                    as it was. Removing it clears it, so nothing unseen goes. */}
                {item.status !== "eligible" && ruling !== item.id && (
                  <button
                    type="button"
                    disabled={locked}
                    aria-expanded={noteOpen}
                    onClick={() => {
                      if (noteOpen) setNotes((n) => ({ ...n, [item.id]: "" }));
                      setNoting((n) => ({ ...n, [item.id]: !noteOpen }));
                    }}
                    className="inline-flex min-h-11 cursor-pointer items-center px-2 text-sm text-ink-3 underline underline-offset-2 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {noteOpen ? "Remove the note" : "Add a note"}
                  </button>
                )}
                {/* A winner stays eligible until an owner unpicks them
                    (decide_rovv_entry refuses otherwise), so neither of these
                    is offered on one. */}
                {item.status !== "ineligible" && !item.winner && ruling !== item.id && (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setRuling(item.id)}
                    className={buttonClass("danger", "px-5")}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Ineligible
                  </button>
                )}
                {item.status !== "pending" && !item.winner && (
                  <button
                    type="button"
                    disabled={locked}
                    aria-busy={isBusy(item, "pending")}
                    onClick={() => act(item, "pending")}
                    className={buttonClass("quiet", "px-4")}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    {isBusy(item, "pending") ? BUSY_LABEL.pending : "Back to waiting"}
                  </button>
                )}
                {owner && item.status === "eligible" && !item.winner && (
                  <button
                    type="button"
                    disabled={locked || (!item.isTest && winners >= cap)}
                    aria-busy={isBusy(item, "pick")}
                    onClick={() => act(item, "pick")}
                    className={buttonClass("primary", "px-5")}
                  >
                    <Trophy className="h-4 w-4" aria-hidden="true" />
                    {isBusy(item, "pick")
                      ? BUSY_LABEL.pick
                      : !item.isTest && winners >= cap
                        ? `All ${cap} picked`
                        : "Pick as winner"}
                  </button>
                )}
                {owner && item.winner && !item.notifiedAtLabel && (
                  <button
                    type="button"
                    disabled={locked}
                    aria-busy={isBusy(item, "unpick")}
                    onClick={() => act(item, "unpick")}
                    className={buttonClass("secondary", "px-5")}
                  >
                    {isBusy(item, "unpick")
                      ? BUSY_LABEL.unpick
                      : unpicking === item.id
                        ? `Tap again to unpick: ${item.ticketCode} becomes free`
                        : "Unpick winner"}
                  </button>
                )}
              </div>

              {item.winner && (
                <p className="mt-2 text-sm text-ink-3">
                  {item.notifiedAtLabel
                    ? `Emailed ${item.notifiedAtLabel}. A winner who has been told stays a winner.`
                    : owner
                      ? "Picked, not emailed yet. Unpick before emailing if this was a mistake."
                      : "Picked as a winner. Only an owner can change that."}
                </p>
              )}

              {owner && !item.notifiedAtLabel && (
                <Correction
                  key={`${item.id}:${item.tiktokHandle}:${item.email}:${correcting === item.id}`}
                  item={item}
                  open={correcting === item.id}
                  onToggle={() => setCorrecting((c) => (c === item.id ? null : item.id))}
                  onDone={() => {
                    setCorrecting(null);
                    router.refresh();
                  }}
                />
              )}

              {owner && item.winner && (
                /* Keyed on the saved code, so a refresh that changed it (here,
                   in another tab, or by a paste) starts the box afresh rather
                   than keeping a stale value a Save would write back. */
                <WinnerCode
                  key={`${item.id}:${item.ticketCode ?? ""}:${item.notifiedAtLabel ?? ""}`}
                  item={item}
                  onChanged={() => router.refresh()}
                />
              )}

              {ruling === item.id && (
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
                  onSubmit={(event) => {
                    event.preventDefault();
                    act(item, "ineligible");
                  }}
                >
                  <label htmlFor={`reason-${item.id}`} className="sr-only">
                    Why this entry is ineligible
                  </label>
                  <div className="flex w-full basis-full flex-wrap gap-2">
                    {QUICK_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setReasons((r) => ({ ...r, [item.id]: reason }))}
                        className="min-h-11 cursor-pointer rounded-full border border-line-2 px-3 py-2 text-left text-xs text-ink-2 hover:bg-card-2"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <p id={`reason-hint-${item.id}`} className="text-sm text-ink-3 sm:sr-only">
                    The entrant is emailed this reason, word for word.
                  </p>
                  <input
                    ref={reasonRef}
                    id={`reason-${item.id}`}
                    value={reasons[item.id] ?? ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                    maxLength={500}
                    required
                    aria-describedby={`reason-hint-${item.id}`}
                    placeholder="Emailed to the entrant: e.g. your video does not tag @rovvafrica"
                    className="min-h-12 w-full min-w-0 flex-1 rounded-lg border border-line bg-control px-4 py-3 text-base text-white placeholder:text-ink-3"
                  />
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="submit"
                      disabled={locked}
                      aria-busy={isBusy(item, "ineligible")}
                      className={buttonClass("dangerFill", "flex-1 px-5 sm:flex-none")}
                    >
                      {isBusy(item, "ineligible") ? BUSY_LABEL.ineligible : "Mark ineligible"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuling(null)}
                      className={buttonClass("secondary", "px-5")}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
        >
          Show more ({items.length - visible} more)
        </button>
      ) : (
        <p className="mt-3 text-sm text-ink-4">Showing all {items.length} here, newest first.</p>
      )}
    </>
  );
}

/**
 * Correct an entrant's TikTok username or email address, when they write in
 * (owners only, never once emailed as a winner). The form cannot do it: it
 * only replaces an entry under the same email and username.
 */
function Correction({
  item,
  open,
  onToggle,
  onDone,
}: {
  item: RovvQueueItem;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const [handle, setHandle] = useState(item.tiktokHandle);
  const [email, setEmail] = useState(item.email);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const change = {
      entryId: item.id,
      ...(handle.trim() !== item.tiktokHandle ? { tiktokHandle: handle } : {}),
      ...(email.trim().toLowerCase() !== item.email.toLowerCase() ? { email } : {}),
    };
    if (!("tiktokHandle" in change) && !("email" in change)) {
      onToggle();
      return;
    }
    setSaving(true);
    try {
      const { good, result } = await postJson("/api/admin/rovv/correct", change);
      if (good) {
        toast.success(`Corrected ${item.fullName}'s details.`);
        onDone();
      } else toast.error(result.message ?? "That did not work.");
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="mt-2 inline-flex min-h-11 cursor-pointer items-center text-sm text-ink-3 underline underline-offset-2 hover:text-white"
      >
        Correct username or email
      </button>
    );
  }
  return (
    <form onSubmit={save} className="mt-3 flex flex-col gap-2 rounded-lg border border-line-2 bg-card-2 p-3">
      <label htmlFor={`fix-handle-${item.id}`} className="text-sm font-semibold text-white">
        TikTok username
      </label>
      <input
        id={`fix-handle-${item.id}`}
        value={handle}
        onChange={(e) => setHandle(e.target.value.replace(/^\s*@+/, ""))}
        autoCapitalize="none"
        spellCheck={false}
        className="min-h-12 rounded-lg border border-line bg-control px-4 py-3 font-mono text-base text-white"
      />
      <label htmlFor={`fix-email-${item.id}`} className="text-sm font-semibold text-white">
        Email address
      </label>
      <input
        id={`fix-email-${item.id}`}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoCapitalize="none"
        spellCheck={false}
        className="min-h-12 rounded-lg border border-line bg-control px-4 py-3 text-base text-white"
      />
      <p className="text-sm text-ink-3">Only when the entrant asks. Emails about this entry go to the new address.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={buttonClass("primary", "px-5")}>
          {saving ? "Saving…" : "Save correction"}
        </button>
        <button type="button" onClick={onToggle} className={buttonClass("secondary", "px-5")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * A winner's ticket code: the 100%-off code they register their BUIDL PASS
 * with, which their winner email carries. Owners paste it from the ticket
 * page; it can change until the email goes, then it is shown as sent.
 *
 * A test winner with a code also gets "Send me the winner email", so the
 * real email can be seen before anyone has entered (0074).
 */
function WinnerCode({ item, onChanged }: { item: RovvQueueItem; onChanged: () => void }) {
  const [code, setCode] = useState(item.ticketCode ?? "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const fieldId = `code-${item.id}`;

  if (item.notifiedAtLabel) {
    return (
      <p className="mt-2 text-sm text-ink-3">
        Ticket code sent:{" "}
        <code className="break-all font-mono font-semibold text-white">{item.ticketCode ?? "none"}</code>
      </p>
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const { good, result } = await postJson("/api/admin/rovv/code", { entryId: item.id, code: code.trim() });
      if (good) toast.success(code.trim() ? `Code saved for ${item.fullName}.` : `Code cleared for ${item.fullName}.`);
      else toast.error(result.message ?? "That did not work.");
      onChanged();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setSending(true);
    try {
      const { good, result } = await postJson("/api/admin/rovv/test-notify", { entryId: item.id });
      if (good) toast.success(`Winner email sent to ${result.sentTo ?? item.email}.`);
      else toast.error(result.message ?? "That did not work.");
      onChanged();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setSending(false);
    }
  }

  const saved = (item.ticketCode ?? "") === code.trim();
  return (
    <div className="mt-3 rounded-lg border border-line-2 bg-card-2 p-3">
      <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={fieldId} className="text-sm font-semibold text-white">
            Ticket code
          </label>
          <input
            id={fieldId}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={64}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="The 100%-off code from the ticket page"
            className="min-h-12 w-full min-w-0 rounded-lg border border-line bg-control px-4 py-3 font-mono text-base text-white placeholder:font-sans placeholder:text-ink-3"
          />
        </div>
        <button type="submit" disabled={saving || saved} aria-busy={saving} className={buttonClass("secondary", "px-5")}>
          {saving ? "Saving…" : saved && item.ticketCode ? "Saved" : "Save code"}
        </button>
      </form>
      {!item.ticketCode && (
        <p className="mt-2 text-sm text-ink-3">No code yet, so this winner cannot be emailed.</p>
      )}
      {item.isTest && item.ticketCode && (
        <button
          type="button"
          onClick={sendTest}
          disabled={sending}
          aria-busy={sending}
          className={buttonClass("primary", "mt-3 px-5")}
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          {sending ? "Sending…" : `Send the winner email to ${item.email}`}
        </button>
      )}
    </div>
  );
}

/**
 * Paste every ticket code at once (the owner, 12 October): twenty different
 * codes, handed out one per winner in the order they were picked, to the
 * winners still without one. What was found is shown as it is pasted, and
 * nothing is saved until the owner confirms. The server reads the list again
 * and refuses it whole if anything is wrong, so no code reaches two people.
 * Nothing is emailed here; the codes appear on each winner's card.
 */
export function RovvCodePaste({
  waiting,
  test = false,
  queue = [],
  held = [],
}: {
  waiting: number;
  test?: boolean;
  /** The waiting winners' usernames, in the order the codes will reach them. */
  queue?: string[];
  /** Codes winners already hold, which the server skips: left out of the preview too. */
  held?: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const read = readTicketCodes(text);
  const heldSet = new Set(held.map((c) => c.toUpperCase()));
  const skipped = read.codes.filter((c) => heldSet.has(c.toUpperCase()));
  // What the server will hand out: the list, less codes a winner already has.
  const found = { ...read, codes: read.codes.filter((c) => !heldSet.has(c.toUpperCase())) };
  const fieldId = test ? "rovv-codes-test" : "rovv-codes";
  const who = test ? "test winners" : "winners";
  const n = Math.min(found.codes.length, waiting);
  const problem =
    found.invalid.length > 0
      ? `Not codes: ${found.invalid.slice(0, 3).join(", ")}${found.invalid.length > 3 ? "…" : ""}. Paste only the codes.`
      : found.repeated.length > 0
        ? `In the list twice: ${found.repeated.slice(0, 3).join(", ")}. Each winner needs their own.`
        : "";

  async function give() {
    setPending(true);
    try {
      const { good, result } = await postJson("/api/admin/rovv/codes", { text, test });
      if (!good) {
        toast.error(result.message ?? "That did not work.");
      } else {
        const given = result.assigned?.length ?? 0;
        const left = result.unusedCodes ?? [];
        const skipped = result.skipped ?? [];
        toast.success(
          `Gave ${given} ${given === 1 ? "code" : "codes"}${
            skipped.length > 0 ? `; skipped ${skipped.length} a winner already has` : ""
          }${left.length > 0 ? `; ${left.length} left over, kept in the box` : ""}. Check them on each card, then email the ${who}.`,
        );
        // Leftovers are paid-for tickets: they stay in the box, never thrown away.
        setText(left.join("\n"));
      }
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={fieldId} className="text-sm font-semibold text-white">
        Paste all the codes
      </label>
      <p id={`${fieldId}-hint`} className="max-w-prose text-sm leading-relaxed text-ink-3">
        One per line, or separated by commas or spaces. Each of the {waiting} {who} without a code gets the next one,
        in the order they were picked.
      </p>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        spellCheck={false}
        autoCapitalize="characters"
        aria-describedby={`${fieldId}-hint`}
        className="w-full rounded-lg border border-line bg-control px-4 py-3 font-mono text-base text-white placeholder:font-sans placeholder:text-ink-3"
        placeholder={"BUIDL-7Q2K\nBUIDL-9XW4\n…"}
      />
      {text.trim() && (
        <p role="status" className={`text-sm ${problem ? "text-red-300" : "text-ink-2"}`}>
          {problem ||
            `${skipped.length > 0 ? `${skipped.length} already given, skipped. ` : ""}${found.codes.length} ${found.codes.length === 1 ? "code" : "codes"} found for ${waiting} ${who} waiting${
              found.codes.length > waiting
                ? `: ${found.codes.length - waiting} will be left over`
                : found.codes.length < waiting
                  ? `: ${waiting - found.codes.length} will still need one`
                  : ""
            }.`}
        </p>
      )}
      {!problem && n > 0 && (
        <Confirm
          label={`Give ${n} ${n === 1 ? "code" : "codes"} to the ${who}`}
          question={`Give ${n} ${n === 1 ? "code" : "codes"} out, one per ${test ? "test winner" : "winner"}?`}
          consequence={`${
            queue.length > 0
              ? queue
                  .slice(0, n)
                  .map((h, i) => `@${h} gets ${found.codes[i]}`)
                  .join(", ") + ". "
              : `Each of the next ${n} ${who}, in the order they were picked, gets their own code from the list, starting with ${found.codes[0]}. `
          }Codes a winner already has are skipped. Nothing is emailed yet: check the codes on each card, then press Email the winners.`}
          confirmLabel={`Yes, give out ${n}`}
          pending={pending}
          onConfirm={give}
        />
      )}
    </div>
  );
}

/**
 * The addresses in pasted text, once each by canonical form, as typed (in
 * lower case); anything else skipped, so a pasted spreadsheet row reads as
 * its address. The rule-out route reads the text the same way
 * (app/api/admin/rovv/rule-out/route.ts), so this count is the one it gets.
 */
function readPastedEmails(text: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  for (const piece of text.split(/[\s,;]+/)) {
    const typed = piece
      .replace(/^[<("'[]+|[>)"'\].:]+$/g, "")
      .replace(/^mailto:/i, "")
      .toLowerCase();
    if (!/^[^\s@<>()"':]+@[^\s@<>()"':]+\.[a-z]{2,}$/.test(typed)) continue;
    const canonical = canonicalEmail(typed);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    found.push(typed);
  }
  return found;
}

/** What the rule-out route answers. */
interface RuleOutAnswer {
  ruledOut?: number;
  alreadyOut?: number;
  winners?: { handle: string; email: string }[];
  unmatched?: string[];
  notRuled?: { handle: string; email: string }[];
  unsent?: { handle: string; email: string }[];
  emailed?: number;
  emailFailed?: number;
  /** Not reached before the press ran out of time: press again for them. */
  left?: number;
}

const handles = (list: { handle: string }[]) => list.map((w) => `@${w.handle}`).join(", ");

/**
 * ROVV's answer, applied in one go (the owner, for the Monday the winners are
 * due): paste the addresses ROVV could not confirm, and each matching entry
 * is ruled out with "ROVV could not confirm your referral code." and its
 * entrant emailed, as a reviewer's ruling would. Nothing is asked of the
 * server until the owner confirms; the count is read here as it is typed.
 *
 * Picked winners are left alone, named, and kept in the box to paste again
 * once they are unpicked; addresses with no entry stay too, to check.
 */
export function RovvRuleOut() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const emails = readPastedEmails(text);
  const n = emails.length;
  const fieldId = "rovv-rule-out";

  async function ruleOut() {
    setPending(true);
    try {
      const { good, result, status } = await postJson("/api/admin/rovv/rule-out", { emails: text });
      if (!good && (status >= 500 || !result.message)) {
        /* Cut off by the platform, maybe after some were ruled out and
           emailed: "did not work" would say nothing was. Pressing again is
           safe, since anyone already out is skipped. */
        toast.error("It may have partly gone through. Reload to see the entries, then press again for the rest.");
      } else if (!good) {
        toast.error(result.message ?? "That did not work.");
      } else {
        const r = result as unknown as RuleOutAnswer;
        const ruled = r.ruledOut ?? 0;
        const winners = r.winners ?? [];
        const unmatched = r.unmatched ?? [];
        const notRuled = r.notRuled ?? [];
        const unsent = r.unsent ?? [];
        const failed = r.emailFailed ?? 0;
        const left = r.left ?? 0;
        toast.success(
          `Ruled out ${ruled} ${ruled === 1 ? "entry" : "entries"}${
            (r.alreadyOut ?? 0) > 0 ? `; ${r.alreadyOut} already out` : ""
          }. Emailed ${r.emailed ?? 0}.${left > 0 ? ` ${left} still to go: press again.` : ""}`,
        );
        const attention = [
          failed > 0
            ? `${failed} ${failed === 1 ? "email" : "emails"} did not send${unsent.length > 0 ? ` (${handles(unsent)})` : ""}: they are kept in the box, and pressing again resends them.`
            : "",
          winners.length > 0
            ? `Picked winners, not ruled out: ${handles(winners)}. Unpick them first if ROVV is sure, then paste again.`
            : "",
          notRuled.length > 0 ? `Changed while this ran, not ruled out: ${handles(notRuled)}. Paste again.` : "",
          unmatched.length > 0 ? `No entry for: ${unmatched.join(", ")}.` : "",
        ].filter(Boolean);
        // Long enough to read a list; the box keeps it anyway.
        if (attention.length > 0) toast.error(attention.join(" "), { duration: 20_000 });
        // What still needs a look stays in the box, never lost with the toast;
        // with some still to go, the whole list stays, to press again.
        if (left === 0) {
          setText(
            [...winners.map((w) => w.email), ...notRuled.map((n) => n.email), ...unsent.map((u) => u.email), ...unmatched].join("\n"),
          );
        }
      }
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={fieldId} className="text-sm font-semibold text-white">
        Paste the emails ROVV could not confirm
      </label>
      <p id={`${fieldId}-hint`} className="max-w-prose text-sm leading-relaxed text-ink-3">
        One per line, or separated by commas or spaces; a pasted spreadsheet works too. Each entry under them is ruled
        out, and its entrant emailed &ldquo;ROVV could not confirm your referral code.&rdquo; Picked winners are left
        alone and named.
      </p>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        spellCheck={false}
        autoCapitalize="none"
        aria-describedby={`${fieldId}-hint`}
        className="w-full rounded-lg border border-line bg-control px-4 py-3 font-mono text-base text-white placeholder:font-sans placeholder:text-ink-3"
        placeholder={"ada@example.com\nbola@example.com\n…"}
      />
      {text.trim() && (
        <p role="status" className="text-sm text-ink-2">
          {n === 0
            ? "No email addresses found yet."
            : `${n} email ${n === 1 ? "address" : "addresses"} found.`}
        </p>
      )}
      {n > 0 && (
        <Confirm
          label={`Rule out up to ${n} ${n === 1 ? "entry" : "entries"}`}
          question={`Rule out the entries under these ${n} email ${n === 1 ? "address" : "addresses"}?`}
          consequence={`Each one that is not already out is marked ineligible, and its entrant is emailed: “ROVV could not confirm your referral code.” Picked winners are left alone and named, so you can unpick them first. Addresses with no entry are named too. You get one copy of the email first.`}
          confirmLabel={`Yes, rule out up to ${n}`}
          intent="danger"
          pending={pending}
          onConfirm={ruleOut}
        />
      )}
    </div>
  );
}

/**
 * Test entries (0074): how to make one, and a button to delete them all.
 * Owners only; the console is the only place tests appear.
 */
export function RovvTestTools({ tests }: { tests: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function clear() {
    setPending(true);
    try {
      const { good, result } = await postJson("/api/admin/rovv/test-clear", {});
      if (good) toast.success(`Deleted ${result.deleted ?? 0} test ${result.deleted === 1 ? "entry" : "entries"}.`);
      else toast.error(result.message ?? "That did not work.");
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm leading-relaxed text-ink-2">
        Open{" "}
        <a
          href="/campaigns/rovv?test=1#enter"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-link underline underline-offset-2 hover:text-white"
        >
          the campaign page in test mode
        </a>{" "}
        while signed in here, and enter as anyone would, at any time. Test entries get the same emails, appear under
        Test below, and are kept off the public page, out of the exports and out of the winner count. Pick one as a
        winner, give it a made-up code (on its card, or several at once in the box below, the way you will paste the
        real ones), and send yourself the winner email from its card.
      </p>
      {tests > 0 && (
        <Confirm
          label={`Delete all test entries (${tests})`}
          question={`Delete ${tests} test ${tests === 1 ? "entry" : "entries"}?`}
          consequence="Only entries made in test mode are deleted. Real entries are never touched."
          confirmLabel="Yes, delete the tests"
          intent="danger"
          pending={pending}
          onConfirm={clear}
        />
      )}
    </div>
  );
}

/**
 * "The winners are announced", to everyone who entered and did not win
 * (0075). Offered once every picked winner has been emailed; asks first,
 * saying how many; a second press carries on from where one stopped.
 */
export function RovvResults({
  toSend,
  sent,
  winners = 20,
  cap = 20,
}: {
  toSend: number;
  sent: number;
  winners?: number;
  cap?: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);
    try {
      /* Its own fetch rather than postJson, which cannot say whether the
         answer was ours. A press the platform cut off at its time limit
         answers with the platform's error page, often after some of the
         mail has gone, and "that did not work" would be a reason to think
         nothing did. The counts on a reload are the truth. */
      const response = await fetch("/api/admin/rovv/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        sent?: number;
        failed?: number;
        left?: number;
      } | null;
      if (response.status >= 500 || !result || typeof result !== "object") {
        toast.error("It may have partly sent. Reload to see the counts before pressing again.");
      } else if (!response.ok || result.ok !== true) {
        toast.error(result.message ?? "That did not work.");
      } else {
        toast.success(
          `Sent the results to ${result.sent ?? 0}.${(result.failed ?? 0) > 0 ? ` ${result.failed} did not send; press again to retry them.` : ""}${(result.left ?? 0) > 0 ? ` ${result.left} still to go: press again.` : ""}`,
        );
      }
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  if (toSend === 0) {
    return sent > 0 ? <p className="text-sm text-ink-2">The results email has gone to {sent} entrants who did not win.</p> : null;
  }
  return (
    <Confirm
      label={`Email the results to ${toSend} who did not win`}
      question={`Email ${toSend} entrants that the winners are announced?`}
      consequence={`${
        winners < cap
          ? `Only ${winners} of ${cap} winners are picked. Once this goes, the people it reaches cannot be picked. `
          : ""
      }Everyone who entered, was not ruled out and did not win gets one thank-you email with a link to the winners. You get one copy first. Nobody gets it twice.`}
      confirmLabel={`Yes, email ${toSend}`}
      pending={pending}
      onConfirm={send}
    />
  );
}

/**
 * Email the winners nobody has told yet. Owners only, asked once, saying how
 * many will go: fewer than the full number is allowed, and pressing again
 * later reaches only the ones picked since or whose mail failed.
 */
export function RovvNotify({
  untold,
  sending,
  needCode,
  winners,
  cap,
  closed,
}: {
  /** Picked, with a code, not yet emailed, and not being emailed right now. */
  untold: number;
  /** Picked and not emailed, but with no ticket code yet, so not sendable. */
  needCode: number;
  /** Being emailed by a press right now. */
  sending: number;
  winners: number;
  cap: number;
  /** Whether entries have closed. The route refuses to email before. */
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);
    try {
      const { good, result } = await postJson("/api/admin/rovv/notify", {});
      if (!good) {
        toast.error(result.message ?? "That did not work.");
      } else if ((result.failed ?? 0) > 0) {
        toast.error(
          `Emailed ${result.sent ?? 0}. ${result.failed} did not send; press again to retry them.`,
        );
      } else {
        toast.success(`Emailed ${result.sent ?? 0} ${result.sent === 1 ? "winner" : "winners"}.`);
      }
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  if (!closed) {
    return (
      <p className="text-sm text-ink-2">
        Pick winners as you go. Emailing them opens here once entries close at 11:59 PM on Sunday 18 October.
      </p>
    );
  }

  const missing =
    needCode > 0
      ? `${needCode} ${needCode === 1 ? "winner has" : "winners have"} no ticket code yet: add the code on their card below before they can be emailed.`
      : "";

  if (untold === 0) {
    return (
      <p className="text-sm text-ink-2">
        {winners === 0
          ? "Nobody is picked yet. Pick winners from eligible entries below, then email them from here."
          : sending > 0
            ? `${sending} ${sending === 1 ? "winner is" : "winners are"} being emailed right now. Reload in a minute.`
            : missing || `All ${winners} picked so far have been emailed.`}
      </p>
    );
  }

  const people = `${untold} ${untold === 1 ? "winner" : "winners"}`;
  return (
    <Confirm
      label={`Email the winners (${untold})`}
      question={`Email ${people} now?`}
      consequence={[
        "Has ROVV confirmed every winner's referral code? Once emailed, a winner cannot be unpicked or ruled out, and their username goes public.",
        "Each gets the winner email with their own ticket code and the link to register their BUIDL PASS with it. You get one copy first.",
        missing,
        winners < cap ? `Only ${winners} of ${cap} are picked; the rest can be emailed once they are.` : "",
        "Once emailed, a winner cannot be unpicked, and their TikTok username shows on the campaign page.",
        "Anyone already emailed, or being emailed by another press, is skipped, so nobody is mailed twice.",
      ]
        .filter(Boolean)
        .join(" ")}
      confirmLabel={`Yes, email ${people}`}
      pending={pending}
      onConfirm={send}
    />
  );
}
