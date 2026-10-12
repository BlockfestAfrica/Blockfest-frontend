"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Trophy, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { buttonClass, Pill } from "@/components/shared/panel";
import { Confirm } from "@/components/shared/confirm";
import { openableHref } from "@/lib/admin/openable-href";

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
}

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
  };
  return { good: response.ok && result.ok === true, result };
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
 */
export function RovvQueue({
  items,
  owner,
  winners,
  cap,
}: {
  items: RovvQueueItem[];
  /** Owners pick winners; reviewers only rule on entries. */
  owner: boolean;
  /** How many are picked now, across the whole campaign. */
  winners: number;
  /** How many can be picked. */
  cap: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);
  /** The entry whose reason box is open, if any. */
  const [ruling, setRuling] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const reasonRef = useRef<HTMLInputElement>(null);
  const shown = items.slice(0, visible);

  // The reason is the next thing to type, so it takes focus (and, on a
  // phone, scrolls into view above the keyboard).
  useEffect(() => {
    if (ruling) reasonRef.current?.focus();
  }, [ruling]);

  async function act(item: RovvQueueItem, action: Action) {
    const note = (reasons[item.id] ?? "").trim();
    if (action === "ineligible" && !note) {
      toast.error("Ruling an entry out needs a reason.");
      return;
    }

    setBusy({ id: item.id, action });
    try {
      const { good, result } =
        action === "pick" || action === "unpick"
          ? await postJson("/api/admin/rovv/winner", { entryId: item.id, pick: action === "pick" })
          : await postJson("/api/admin/rovv/decision", {
              entryId: item.id,
              status: action,
              note: action === "ineligible" ? note : undefined,
              revision: item.revision,
            });

      if (!good) {
        toast.error(result.message ?? "That did not work.");
        await router.refresh();
        return;
      }

      // Named, so a mis-tap can be found again by who it was.
      toast.success(
        `${DONE_LABEL[action]}: ${item.fullName} (@${item.tiktokHandle})${
          typeof result.winners === "number" ? `. ${result.winners} of ${cap} picked.` : ""
        }`,
      );
      if (action === "ineligible") {
        setRuling(null);
        setReasons((r) => ({ ...r, [item.id]: "" }));
      }
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
          return (
            <li
              key={item.id}
              className={`border-l-2 p-4 ${item.winner ? "border-l-brand-gold" : state.edge}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Pill tone={state.tone}>{state.label}</Pill>
                {item.winner && (
                  <Pill tone="gold">{item.notifiedAtLabel ? "Winner · emailed" : "Winner"}</Pill>
                )}
                {/* The entrant sent it again, so the video may not be the one
                    somebody watched earlier. */}
                {item.revision > 1 && <Pill tone="neutral">Replaced by entrant</Pill>}
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
                  {item.reviewNote}
                </p>
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
                    disabled={locked || winners >= cap}
                    aria-busy={isBusy(item, "pick")}
                    onClick={() => act(item, "pick")}
                    className={buttonClass("primary", "px-5")}
                  >
                    <Trophy className="h-4 w-4" aria-hidden="true" />
                    {isBusy(item, "pick")
                      ? BUSY_LABEL.pick
                      : winners >= cap
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
                    {isBusy(item, "unpick") ? BUSY_LABEL.unpick : "Unpick winner"}
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

              {ruling === item.id && (
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
                  onSubmit={(event) => {
                    event.preventDefault();
                    act(item, "ineligible");
                  }}
                >
                  <label htmlFor={`reason-${item.id}`} className="sr-only">
                    Why this entry is ineligible
                  </label>
                  <input
                    ref={reasonRef}
                    id={`reason-${item.id}`}
                    value={reasons[item.id] ?? ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                    maxLength={500}
                    required
                    placeholder="Why, for example: no ROVV account with this code"
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
 * Email the winners nobody has told yet. Owners only, asked once, saying how
 * many will go: fewer than the full number is allowed, and pressing again
 * later reaches only the ones picked since or whose mail failed.
 */
export function RovvNotify({
  untold,
  sending,
  winners,
  cap,
  closed,
}: {
  /** Picked, not yet emailed, and not being emailed right now. */
  untold: number;
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

  if (untold === 0) {
    return (
      <p className="text-sm text-ink-2">
        {winners === 0
          ? "Nobody is picked yet. Pick winners from eligible entries below, then email them from here."
          : sending > 0
            ? `${sending} ${sending === 1 ? "winner is" : "winners are"} being emailed right now. Reload in a minute.`
            : `All ${winners} picked so far have been emailed.`}
      </p>
    );
  }

  const people = `${untold} ${untold === 1 ? "winner" : "winners"}`;
  return (
    <Confirm
      label={`Email the winners (${untold})`}
      question={`Email ${people} now?`}
      consequence={[
        "Each gets the winner email with their video link, asking them to reply with the name for their ticket. You get one copy first.",
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
