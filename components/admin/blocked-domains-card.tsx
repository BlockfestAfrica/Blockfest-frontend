"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass, control, Field, JobCard, Pill, SPACING } from "@/components/shared/panel";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Confirm } from "@/components/shared/confirm";
import { count, dateTime } from "@/lib/format";
import {
  blockConsequence,
  blockToast,
  isProtectedDomain,
  unblockConsequence,
  unblockToast,
} from "@/lib/vote-domain-copy";

/** One active block, as the page hands it over. */
export interface BlockedDomainView {
  domain: string;
  source: "admin" | "auto";
  reason: string;
  /** The automatic rule's evidence sentence; null for an owner's block. */
  evidence: string | null;
  createdAt: string;
  /** Whether the admin reading the page is the one who blocked it. */
  byYou: boolean;
  /** Who blocked it, when it was somebody else. */
  by: string | null;
  /** Votes held for this block in rounds not yet reviewed. */
  held: number;
}

/**
 * What a Block dialog is asked about.
 *
 * domain is the registrable domain the block lands on. counted is how many
 * of its votes count this round, or null when the console cannot know (a
 * typed domain). reviewed: the round the cluster came from is already
 * reviewed, so the block holds none of its votes. typedHost: what the owner
 * typed, when it was a subdomain of domain.
 */
export interface BlockTarget {
  domain: string;
  counted: number | null;
  protectedDomain: boolean;
  reviewed?: boolean;
  typedHost?: string;
}

/** The shape the table's CHECK takes, said before the round trip. */
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * The host in what was typed. An owner copying from the vote list pastes a
 * whole address as often as a domain, and a trailing dot is still the same
 * domain. askToBlock then folds a subdomain onto its registrable domain, as
 * the server will, so the dialog names what the block actually covers.
 */
function typedDomain(input: string): string {
  return input.slice(input.lastIndexOf("@") + 1).trim().toLowerCase().replace(/\.$/, "");
}

/** The console route, with its answer read the way every card reads it. */
async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch("/api/admin/vote-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok || !result.ok) {
      toast.error(typeof result.message === "string" ? result.message : "That did not work.");
      return null;
    }
    return result;
  } catch {
    toast.error("We could not reach the server.");
    return null;
  }
}

/**
 * Asking before a block, wherever it is started from: a cluster in the vote
 * panel, or a domain typed into this card before anybody has used it.
 *
 * counted is how many of the domain's votes count this round and will be held,
 * or null when the console cannot know (a typed domain). A school or
 * government domain gets its warning in the same sentence block, because that
 * is the block most likely to turn real people away.
 */
export function BlockDomainDialog({
  target,
  busy,
  onClose,
  onConfirm,
}: {
  target: BlockTarget | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  return (
    <ActionDialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={target ? `Block ${target.domain}` : "Block a domain"}
      tone="danger"
      busy={busy}
    >
      {/* Keyed by the domain, so every new target starts with an empty
          reason and a closed question. */}
      {target && (
        <BlockDomainForm
          key={target.domain}
          target={target}
          busy={busy}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    </ActionDialog>
  );
}

function BlockDomainForm({
  target,
  busy,
  onClose,
  onConfirm,
}: {
  target: BlockTarget;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className={SPACING.related}>
      <Field
        id="block-domain-reason"
        label="Why it is blocked"
        hint="Recorded in the audit log beside your name."
      >
        <input
          id="block-domain-reason"
          data-autofocus
          name="block-domain-reason"
          autoComplete="off"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          placeholder="Catch-all domain, random addresses, all within minutes…"
          className={control}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        {reason.trim() ? (
          <Confirm
            label={`Block ${target.domain}`}
            intent="danger"
            question={`Block ${target.domain} for the rest of the campaign?`}
            consequence={blockConsequence(
              target.domain,
              target.counted,
              target.protectedDomain,
              Boolean(target.reviewed),
              target.typedHost,
            )}
            confirmLabel="Yes, block it"
            pending={busy}
            onConfirm={() => onConfirm(reason.trim())}
          />
        ) : (
          <p className="text-sm text-ink-2">Give the reason first.</p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className={buttonClass("quiet")}
        >
          Never mind
        </button>
      </div>
    </div>
  );
}

/**
 * The domains no vote is taken from, and the way to lift one.
 *
 * One contained list under the vote it guards. Each row leads with the
 * domain; its left edge says who decided (red for an owner, amber for the
 * automatic rule, which a person should look at before the round is marked
 * reviewed), and the meta line says why and when. Unblock asks for a reason
 * and says exactly what it releases. The foot takes a domain before anybody
 * has used it, because a farm that loses one domain tries the next.
 *
 * After a block or an unblock lands, focus goes somewhere that will still be
 * there after the refresh: the next row's Unblock, or the card's heading.
 * The button that opened the dialog was disabled while the request ran, and
 * an unblocked row leaves the list, so the dialog's own return of focus had
 * nowhere to go and dropped it on the page body.
 */
export function BlockedDomainsCard({ blocks }: { blocks: BlockedDomainView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [unblocking, setUnblocking] = useState<BlockedDomainView | null>(null);
  const [unblockReason, setUnblockReason] = useState("");
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | undefined>();
  const [blocking, setBlocking] = useState<BlockTarget | null>(null);
  /**
   * Where focus goes once a block or unblock has landed: the Unblock of the
   * row named, or the heading when none is (or it is gone).
   */
  const [focusAfter, setFocusAfter] = useState<{ domain: string | null } | null>(null);
  const unblockButtons = useRef(new Map<string, HTMLButtonElement>());

  const automatic = blocks.filter((b) => b.source === "auto").length;

  /*
   * After the request, and after the dialog's own attempt to return focus
   * (Radix runs it from a timeout when the dialog unmounts), so this one
   * has the last word.
   */
  useEffect(() => {
    if (!focusAfter || busy) return;
    const timer = setTimeout(() => {
      const button = focusAfter.domain
        ? unblockButtons.current.get(focusAfter.domain)
        : undefined;
      if (button?.isConnected && !button.disabled) button.focus();
      else document.getElementById("blocked-domains-title")?.focus();
      setFocusAfter(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [focusAfter, busy]);

  async function unblock(block: BlockedDomainView, reason: string) {
    setBusy(true);
    try {
      const result = await post({ action: "unblock_domain", domain: block.domain, reason });
      if (!result) return;
      toast.success(unblockToast(block.domain, Number(result.released ?? 0), block.held));
      // The row after this one, which the refresh keeps; this one leaves.
      const at = blocks.findIndex((b) => b.domain === block.domain);
      setFocusAfter({ domain: at >= 0 ? (blocks[at + 1]?.domain ?? null) : null });
      setUnblocking(null);
      setUnblockReason("");
      await router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function block(domain: string, reason: string) {
    setBusy(true);
    try {
      const result = await post({ action: "block_domain", domain, reason });
      if (!result) return;
      toast.success(
        blockToast(
          typeof result.domain === "string" ? result.domain : domain,
          Number(result.held ?? 0),
          { already: result.already === true },
        ),
      );
      setFocusAfter({ domain: null });
      setBlocking(null);
      setTyped("");
      await router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /**
   * Fold what was typed onto the domain the block will land on, before the
   * dialog opens, so every sentence in it names that domain. The same rule
   * the route applies (tldts, private suffixes off), loaded only when asked
   * so the console does not carry the suffix list on every visit.
   */
  async function askToBlock() {
    const host = typedDomain(typed);
    if (!DOMAIN.test(host)) {
      setTypedError("That is not a domain. Type it as example.com.");
      return;
    }
    let domain: string | null;
    try {
      const { getDomain } = await import("tldts");
      domain = getDomain(host, { allowPrivateDomains: false });
    } catch {
      setTypedError("We could not check that domain. Try again.");
      return;
    }
    // A public suffix (edu.ng), an IP address or a single label.
    if (!domain) {
      setTypedError("That is a suffix many domains share, not one domain.");
      return;
    }
    const folded = domain;
    const covering = blocks.find(
      (b) => folded === b.domain || folded.endsWith(`.${b.domain}`),
    );
    if (covering) {
      setTypedError(`${covering.domain} is already blocked.`);
      return;
    }
    setTypedError(undefined);
    setBlocking({
      domain: folded,
      counted: null,
      protectedDomain: isProtectedDomain(folded),
      typedHost: host !== folded ? host : undefined,
    });
  }

  return (
    <JobCard
      collapsible
      id="blocked-domains"
      focusableHeading
      step="Any time"
      title="Blocked domains"
      state="todo"
      status={
        blocks.length > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <Pill>{count(blocks.length)} blocked</Pill>
            {automatic > 0 && <Pill tone="warn">{count(automatic)} automatic</Pill>}
          </span>
        ) : undefined
      }
      hint="New votes from these domains and their subdomains are turned away with a neutral message, and codes already sent are held when they are used. Voters are never told a domain is blocked. Look at any automatic block before marking a round reviewed."
      foot={
        <div className="flex w-full flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <Field
              id="block-domain-new"
              label="Block a domain before anyone uses it"
              hint="A farm that loses one domain tries the next. A subdomain blocks the domain it belongs to."
              error={typedError}
            >
              <input
                id="block-domain-new"
                name="block-domain-new"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="url"
                value={typed}
                onChange={(event) => {
                  setTyped(event.target.value);
                  setTypedError(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void askToBlock();
                  }
                }}
                placeholder="example.com"
                className={control}
              />
            </Field>
          </div>
          <button
            type="button"
            disabled={busy || !typed.trim()}
            onClick={() => void askToBlock()}
            aria-haspopup="dialog"
            className={buttonClass("secondary")}
          >
            Block…
          </button>
        </div>
      }
    >
      {blocks.length === 0 ? (
        <p className="max-w-prose text-sm leading-relaxed text-ink-2">
          No domain is blocked. Block one from a cluster in the vote above, or
          type one below.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {blocks.map((b) => (
            <li
              key={b.domain}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-2 py-3 pl-3 ${
                b.source === "auto" ? "border-l-amber-400/70" : "border-l-red-400/70"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white [overflow-wrap:anywhere]">
                  {b.domain}
                </p>
                <p className="text-sm text-ink-4 [overflow-wrap:anywhere]">
                  {b.source === "auto"
                    ? `Blocked automatically · ${b.evidence ?? b.reason}`
                    : `Blocked by ${b.byYou ? "you" : (b.by ?? "an owner")} · ${b.reason}`}
                  {` · ${dateTime(b.createdAt)}`}
                  {b.held > 0 && ` · ${count(b.held)} held`}
                </p>
              </div>
              <button
                type="button"
                ref={(node) => {
                  if (node) unblockButtons.current.set(b.domain, node);
                  else unblockButtons.current.delete(b.domain);
                }}
                disabled={busy}
                onClick={() => {
                  setUnblocking(b);
                  setUnblockReason("");
                }}
                aria-haspopup="dialog"
                className={buttonClass("secondary")}
              >
                Unblock…
              </button>
            </li>
          ))}
        </ul>
      )}

      <ActionDialog
        open={unblocking !== null}
        onOpenChange={(next) => {
          if (!next) setUnblocking(null);
        }}
        title={unblocking ? `Unblock ${unblocking.domain}` : "Unblock a domain"}
        busy={busy}
      >
        {unblocking && (
          <div className={SPACING.related}>
            <Field
              id="unblock-domain-reason"
              label="Why it is safe again"
              hint="Recorded in the audit log beside your name."
            >
              <input
                id="unblock-domain-reason"
                data-autofocus
                name="unblock-domain-reason"
                autoComplete="off"
                value={unblockReason}
                onChange={(event) => setUnblockReason(event.target.value)}
                maxLength={300}
                placeholder="A real school club, confirmed with the nominee…"
                className={control}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              {unblockReason.trim() ? (
                <Confirm
                  label={`Unblock ${unblocking.domain}`}
                  question={`Unblock ${unblocking.domain}?`}
                  consequence={unblockConsequence(unblocking.domain, unblocking.held)}
                  confirmLabel="Yes, unblock it"
                  pending={busy}
                  onConfirm={() => unblock(unblocking, unblockReason.trim())}
                />
              ) : (
                <p className="text-sm text-ink-2">Give the reason first.</p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setUnblocking(null)}
                className={buttonClass("quiet")}
              >
                Never mind
              </button>
            </div>
          </div>
        )}
      </ActionDialog>

      <BlockDomainDialog
        target={blocking}
        busy={busy}
        onClose={() => setBlocking(null)}
        onConfirm={(reason) => blocking && block(blocking.domain, reason)}
      />
    </JobCard>
  );
}
