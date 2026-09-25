"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { Pill } from "@/components/shared/panel";
import { toast } from "sonner";

/** Rows shown before the reviewer asks for more. */
const PAGE = 10;

/*
 * A link, but only to a place we can prove it goes.
 *
 * This block used to say the link is never an anchor, because the
 * destination is chosen by whoever submitted it and the reader is somebody
 * who can mint points against a five million naira pool. That reasoning was
 * right when it was written and is only partly right now: submission
 * enforces hostMatchesPlatform, so a stored URL is on x.com, twitter.com,
 * instagram.com, tiktok.com or a subdomain of one of them. The reviewer
 * cannot be sent to an attacker's own server.
 *
 * Partly, because that check lives in the zod schema rather than in the
 * database, and this codebase's whole habit is that a guard which is not in
 * the engine is a guard somebody can route around. So the allowlist is
 * applied AGAIN here, against the rendered row: a URL that is not https and
 * on one of those hosts renders as text, exactly as every URL did before.
 * Nothing becomes clickable that cannot be shown to point at a platform.
 *
 * What is left is an open redirect on one of those platforms, which a
 * reviewer reaches identically by copying the same string into the same
 * browser. rel="noopener noreferrer" closes the tab-nabbing and referrer
 * paths that clicking adds over pasting.
 *
 * The trade this buys: every review previously began with a copy, a new
 * tab and a paste, on the one screen the team uses most.
 */
const LINKABLE_HOSTS = [
  "x.com",
  "twitter.com",
  "instagram.com",
  "instagr.am",
  "tiktok.com",
];

function openableHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const known = LINKABLE_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
    return known ? url : null;
  } catch {
    return null;
  }
}

export interface QueueItem {
  id: string;
  url: string;
  weekNo: number;
  challengeTitle: string;
  platformLabel: string;
  submittedAt: string;
  creatorName: string;
  /** The account they said they publish from. Null if none is recorded. */
  registeredHandle: string | null;
  /** Another live submission claims this same post. Only one can be paid. */
  contested: boolean;
  /** True when the server could compare the link's author to that handle. */
  autoChecked: boolean;
  /** Null until an admin has confirmed the account belongs to this creator. */
  /** What the creator must publish from the account, as the proof. */
}

/**
 * The queue.
 *
 * Rebuilt around one decision repeated many times. Every row used to be a
 * 300 to 420 pixel block containing a link, a note field and two buttons, all
 * expanded at once, so twenty pending submissions were an unreadable wall and
 * the one signal that changes how long a row takes, whether the link could be
 * checked against the registered handle, was a line of text buried in the
 * middle of it.
 *
 * Now a row is collapsed to a line, and the attribution state is a coloured
 * left edge that can be scanned straight down the column.
 *
 * Two things here are load-bearing and should not be tidied away.
 *
 * The link opens, but only after openableHref proves where it goes. See the
 * note on that function: it is the same allowlist submission enforces,
 * applied a second time at the point of rendering, because a guard that
 * lives only in a zod schema is a guard somebody can route around. A URL
 * that cannot be proved to point at a platform still renders as text.
 *
 * And the refresh after a decision is awaited rather than made optimistic.
 * review() has no pending guard, so two reviewers working at once can overwrite
 * each other, and a refresh per decision is what catches that. Making it
 * optimistic would trade a visible pause for a silent conflict.
 */
export function ReviewQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /*
   * Ten rows at a time, revealed rather than paged. The server loads up to
   * fifty, and fifty coloured edges on a phone are a wall again. Reveal
   * keeps the reviewer's place in a queue they work oldest first.
   */
  const [visible, setVisible] = useState(PAGE);
  const shown = items.slice(0, visible);

  async function decide(id: string, decision: "approved" | "rejected") {
    const note = notes[id]?.trim() ?? "";
    const item = items.find((i) => i.id === id);

    if (decision === "rejected" && note.length === 0) {
      toast.error("A rejection needs a reason. The creator sees it.");
      return;
    }

    setBusy(id);
    try {
      const response = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          decision,
          note: note || undefined,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      /*
       * Named, not bare.
       *
       * "Approved" tells you something happened. "Approved Ada Obi, week 2"
       * tells you which one, which is the difference between a mis-tap you can
       * go and correct by name and one you cannot find at all.
       */
      toast.success(
        `${decision === "approved" ? "Approved" : "Rejected"} ${
          item?.creatorName ?? ""
        }, week ${item?.weekNo ?? ""}`.trim(),
      );

      // Awaited before the row is released, so the list cannot reflow under a
      // thumb that is still travelling and cannot be double-tapped.
      await router.refresh();
      setOpen(null);
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  /*
   * Expanding and copying are now two different actions, because they were
   * one function wired to two buttons that mean opposite things.
   *
   * start() toggled the row AND copied, and the Copy button inside an
   * expanded row called it: pressing Copy on the row you were reviewing
   * collapsed it. It also fired a "Link copied" toast every time anybody
   * merely opened a row to look, which is most of what this screen is for.
   *
   * The link is clickable now, so copying is the secondary path rather
   * than the way in, and it no longer has to be bundled into expanding.
   */
  function toggle(item: QueueItem) {
    setOpen((current) => (current === item.id ? null : item.id));
  }

  function copyLink(item: QueueItem) {
    navigator.clipboard?.writeText(item.url).then(
      () => {
        setCopied(item.id);
        toast.success("Link copied.");
      },
      () => toast.error("Could not copy. Select the link and copy it by hand."),
    );
  }

  return (
    <>
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {shown.map((item) => {
          const isOpen = open === item.id;
          return (
            <li
              key={item.id}
              /*
               * The attribution state as a left edge.
               *
               * Green means the server could match the link's author to the
               * registered handle. Amber means it could not and a human has to.
               * As an edge it can be scanned down the column at a glance, which
               * a sentence in the middle of a row cannot be.
               */
              className={`border-l-2 ${
                item.autoChecked ? "border-l-green-400/70" : "border-l-amber-400"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-expanded={isOpen}
                className="flex min-h-16 w-full cursor-pointer items-center gap-3 py-3 pl-4 pr-3 text-left transition-colors hover:bg-card"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-white">
                    {item.creatorName}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
                    {item.registeredHandle ? (
                      /* Ink, not gold. Gold is the accent and an accent on
                         every row of the busiest screen is no accent; the
                         handle is metadata the eye compares, not a status. */
                      <span className="truncate font-mono text-ink-2">
                        @{item.registeredHandle}
                      </span>
                    ) : (
                      <Pill tone="bad">no handle</Pill>
                    )}
                    {item.contested && (
                      /*
                       * Two creators claim this exact post; approving pays only
                       * the first. On the meta row rather than inside the
                       * truncating name span, where a long name swallowed the
                       * one flag a reviewer must not miss.
                       */
                      <Pill tone="warn">Contested</Pill>
                    )}
                    <span>
                      W{item.weekNo} · {item.platformLabel}
                    </span>
                  </span>
                </span>
                <WaitedFor since={item.submittedAt} />
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-ink-3 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {isOpen && (
                <div className="border-t border-line bg-card p-4">
                  {item.autoChecked ? (
                    <p className="flex items-center gap-2 text-sm text-green-300">
                      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                      The link names this account. Still open it and check it
                      answers the challenge.
                    </p>
                  ) : (
                    <p className="flex items-start gap-2 text-sm text-amber-300">
                      <ShieldAlert
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        This link does not name its author. Open it and confirm it
                        is the account above.
                      </span>
                    </p>
                  )}

                  <p className="mt-1 text-sm text-ink-3">{item.challengeTitle}</p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    {/* The link opens. Reviewing an entry means looking at
                        the post, and this was a block of text with a Copy
                        button beside it: every review started with a copy,
                        a new tab and a paste. Copy stays, because a phone
                        reviewer may want the link elsewhere, but the
                        default action is now the one the job actually
                        needs. noreferrer as well as noopener: the console
                        URL is nobody else's business. */}
                    {openableHref(item.url) ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="min-w-0 flex-1 break-all rounded-lg border border-line bg-ground px-4 py-3 font-mono text-sm leading-relaxed text-link underline decoration-line-2 underline-offset-4 transition-colors hover:bg-card-2 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
                      >
                        {item.url}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-ground px-4 py-3 text-sm leading-relaxed text-ink-2">
                        {item.url}
                      </code>
                    )}
                    <button
                      type="button"
                      onClick={() => copyLink(item)}
                      className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-line-2 px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-card-3"
                    >
                      {copied === item.id ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                      {copied === item.id ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label htmlFor={`note-${item.id}`} className="sr-only">
                      Reason, required to reject
                    </label>
                    <input
                      id={`note-${item.id}`}
                      value={notes[item.id] ?? ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [item.id]: e.target.value }))
                      }
                      maxLength={500}
                      placeholder="Reason, required to reject. The creator sees it."
                      className="min-w-0 flex-1 rounded-lg border border-line bg-control px-4 py-3 text-base text-white placeholder:text-ink-3"
                    />
                    {/* Separated, and reject sits on the far side. They were
                        adjacent, the same size and the same shape, each flex-1
                        under one thumb, with approve firing immediately and
                        irreversibly. */}
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => decide(item.id, "approved")}
                        className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-green-400/15 px-5 text-sm font-semibold text-green-300 transition-[background-color,transform] duration-150 hover:bg-green-400/25 active:scale-[0.98] disabled:opacity-60 sm:flex-none"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {busy === item.id ? "Approving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => decide(item.id, "rejected")}
                        className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-red-400/40 px-5 text-sm font-semibold text-red-300 transition-[background-color,transform] duration-150 hover:bg-red-400/15 active:scale-[0.98] disabled:opacity-60"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
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
        <p className="mt-3 text-sm text-ink-4">
          Showing all {items.length} submissions loaded here.
        </p>
      )}
    </>
  );
}

/**
 * How long something has been waiting.
 *
 * submittedAt was already queried, serialised and typed, and rendered nowhere,
 * so a reviewer could not tell a submission from ten minutes ago from one that
 * had been sitting since Tuesday.
 *
 * Rendered as nothing on the server and filled in after mount. A relative time
 * computed during the first client render disagrees with the server HTML and
 * logs a hydration mismatch on every single row.
 */
function WaitedFor({ since }: { since: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(waitedLabel(since));
    const timer = setInterval(() => setLabel(waitedLabel(since)), 60_000);
    return () => clearInterval(timer);
  }, [since]);

  return (
    <span className="shrink-0 text-sm tabular-nums text-ink-3">
      {label ?? ""}
    </span>
  );
}

export function waitedLabel(since: string): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(since).getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
