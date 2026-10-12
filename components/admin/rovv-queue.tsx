"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, Trophy, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { buttonClass, Pill } from "@/components/shared/panel";
import { Confirm } from "@/components/shared/confirm";
import { openableHref } from "@/lib/admin/openable-href";
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
    deleted?: number;
    sentTo?: string;
    assigned?: { entryId: string; handle: string; code: string }[];
    unused?: number;
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
      toast.error("Ruling an entry out needs a reason. The entrant is emailed it.");
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
                {item.isTest && <Pill tone="neutral">Test entry</Pill>}
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
                  className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
                  onSubmit={(event) => {
                    event.preventDefault();
                    act(item, "ineligible");
                  }}
                >
                  <label htmlFor={`reason-${item.id}`} className="sr-only">
                    Why this entry is ineligible
                  </label>
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
export function RovvCodePaste({ waiting, test = false }: { waiting: number; test?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const found = readTicketCodes(text);
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
        const left = result.unused ?? 0;
        toast.success(
          `Gave ${given} ${given === 1 ? "code" : "codes"}${left > 0 ? `; ${left} left over, not saved` : ""}. Check them on each card, then email the ${who}.`,
        );
        setText("");
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
            `${found.codes.length} ${found.codes.length === 1 ? "code" : "codes"} found for ${waiting} ${who} waiting${
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
          consequence={`Each of the next ${n} ${who}, in the order they were picked, gets their own code from the list, starting with ${found.codes[0]}. Nothing is emailed yet: check the codes on each card, then press Email the winners.`}
          confirmLabel={`Yes, give out ${n}`}
          pending={pending}
          onConfirm={give}
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
