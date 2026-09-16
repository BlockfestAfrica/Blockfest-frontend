"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  buttonClass,
  control,
  Field,
  JobCard,
  Panel,
  Pill,
  Segmented,
  SPACING,
} from "@/components/shared/panel";
import { Confirm } from "@/components/shared/confirm";
import { count, dateTime } from "@/lib/format";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface RoundView {
  roundId: string;
  status: "draft" | "open" | "closed" | "published";
  opensAt: string;
  closesAt: string;
  reviewedAt: string | null;
}

export interface EntryCandidateRow {
  entryId: string;
  name: string;
  points: number;
  approvedPlatforms: number;
}

/** A vote inside a signal cluster, carrying the id Remove needs. */
export interface ClusterVote {
  voteId: string;
  email: string;
  createdAt: string;
  held: boolean;
}

export interface TallyView {
  nominees: { nomineeId: string; name: string; votes: number }[];
  domains: { domain: string; votes: number; members: ClusterVote[] }[];
  ips: { ipHash: string; votes: number; members: ClusterVote[] }[];
  held: { voteId: string; email: string; domain: string; createdAt: string }[];
  unverified: number;
}

type RemoveMode = "fraud" | "unsweep";

/*
 * The vote runs on Lagos time and Lagos sits at UTC+1 all year, so the Lagos
 * calendar date is simply the UTC date of the clock moved forward one hour,
 * with no daylight rule to get wrong. Next Sunday, or today when today is one,
 * because the rhythm of the campaign is a Sunday vote.
 */
function defaultVoteDay(): string {
  const lagos = new Date(Date.now() + 3_600_000);
  lagos.setUTCDate(lagos.getUTCDate() + ((7 - lagos.getUTCDay()) % 7));
  return lagos.toISOString().slice(0, 10);
}

/**
 * The Sunday vote, as one job with four states: nominate, run, review, done.
 *
 * Every rule the buttons appear to enforce is enforced again in SQL, and the
 * SQL is the rule. The three-to-five check here exists so a tired owner is
 * told before the round trip, not instead of it, and the override reason box
 * appears exactly when the engine would demand one.
 */
export function VoteRoundPanel({
  weekNo,
  round,
  candidates,
  tally,
  frozen,
}: {
  weekNo: number;
  round: RoundView | null;
  candidates: EntryCandidateRow[];
  tally: TallyView | null;
  /** Whether this week's standings have been recorded yet. */
  frozen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [voteDay, setVoteDay] = useState(defaultVoteDay);
  const [opensTime, setOpensTime] = useState("08:00");
  const [closesTime, setClosesTime] = useState("18:00");
  const [fewReason, setFewReason] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<ClusterVote[] | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeMode, setRemoveMode] = useState<RemoveMode>("fraud");
  /*
   * Each list reveals ten rows at a time and keeps its own window, so
   * opening the long IP list never scrolls the ballot. Ticked nominees are
   * keyed by entry id, never by position, so a tick out of sight survives
   * the reveal; the held window only ever grows, so an open reason form
   * keeps its row.
   */
  const [visibleCandidates, setVisibleCandidates] = useState(PAGE);
  const [visibleDomains, setVisibleDomains] = useState(PAGE);
  const [visibleIps, setVisibleIps] = useState(PAGE);
  const [visibleHeld, setVisibleHeld] = useState(PAGE);

  const reviewed = Boolean(
    round && (round.reviewedAt || round.status === "published"),
  );
  const heldCount = tally?.held.length ?? 0;

  const needsOverride = selected.length > 0 && selected.length < 3;
  const openReady =
    selected.length > 0 &&
    selected.length <= 5 &&
    (!needsOverride || fewReason.trim().length > 0);

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/vote-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(success);
      setRemoving(null);
      setRemoveReason("");
      setRemoveMode("fraud");
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(entryId: string) {
    setSelected((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : prev.length >= 5
          ? prev
          : [...prev, entryId],
    );
  }

  async function openRound() {
    if (!openReady) {
      toast.error(
        needsOverride
          ? "Fewer than three nominees needs the reason recorded."
          : "Pick three to five nominees first.",
      );
      return;
    }
    await act(
      {
        action: "open",
        weekNo,
        entryIds: selected,
        opensAt: `${voteDay}T${opensTime}:00+01:00`,
        closesAt: `${voteDay}T${closesTime}:00+01:00`,
        ...(needsOverride
          ? { allowFew: true, fewReason: fewReason.trim() }
          : {}),
      },
      `The week ${weekNo} vote is open.`,
    );
  }

  /* -------------------------------------------------------------------- */

  const state = reviewed ? "done" : round ? "now" : frozen ? "now" : "todo";

  const status = (
    <>
      {!round && <Pill>No round yet</Pill>}
      {round && round.status === "published" && (
        <Pill tone="good">Published</Pill>
      )}
      {round && round.status !== "published" && reviewed && (
        <Pill tone="good">Reviewed</Pill>
      )}
      {round && !reviewed && round.status === "open" && (
        <Pill tone="gold">Open</Pill>
      )}
      {round && !reviewed && round.status !== "open" && (
        <Pill>{round.status === "closed" ? "Closed" : "Draft"}</Pill>
      )}
      {heldCount > 0 && !reviewed && (
        <Pill tone="warn">{heldCount} held</Pill>
      )}
    </>
  );

  const hint = !round
    ? "Nominate three to five of this week's approved entries and open the window. One counted vote per verified inbox; the engine holds the rest."
    : reviewed
      ? "The sweep is done and the tally is final."
      : round.status === "closed"
        ? "Casting is over. Look at what is held or clustered, then mark the review complete. Announcing stays locked until you do."
        : "Verified votes only. A held vote counts nothing until a person releases it.";

  const tallyBlock = tally && tally.nominees.length > 0 && (
    <div>
      <h3 className="eyebrow text-ink-4">The tally, verified votes</h3>
      <dl className="mt-3 divide-y divide-line border-y border-line">
        {tally.nominees.map((n) => (
          <div
            key={n.nomineeId}
            className="flex items-baseline justify-between gap-4 py-3"
          >
            <dt className="text-sm font-semibold text-white">{n.name}</dt>
            <dd className="tabular-nums text-sm font-semibold text-white">
              {count(n.votes)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );

  /*
   * The votes behind a cluster, each with the control the panel previously
   * withheld. Held ones are marked: they also appear in the list below, and
   * a reviewer should know they are looking at the same vote twice rather
   * than two votes from one address.
   */
  const renderMembers = (members: ClusterVote[]) => (
    <div className="border-t border-line bg-card-2/40 px-3">
      {members.map((m) => (
        <div key={m.voteId} className="border-b border-line py-3 last:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {m.email}
              </p>
              <p className="text-sm text-ink-4">
                {dateTime(m.createdAt)}
                {m.held ? " · already held below" : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRemoving(m.voteId);
                setRemoveReason("");
                setRemoveMode("fraud");
              }}
              className={buttonClass("danger")}
            >
              Remove…
            </button>
          </div>
          {removing === m.voteId && renderRemoveForm(m.voteId, m.email)}
        </div>
      ))}
    </div>
  );

  const renderRemoveForm = (voteId: string, email: string) => (
    <div className={`mt-4 ${SPACING.related}`}>
                <Field
                  id={`remove-reason-${voteId}`}
                  label="Why it goes"
                  hint="Recorded in the audit log beside your name."
                >
                  <input
                    id={`remove-reason-${voteId}`}
                    name="remove-reason"
                    autoComplete="off"
                    value={removeReason}
                    onChange={(event) =>
                      setRemoveReason(event.target.value)
                    }
                    maxLength={300}
                    placeholder="Forty votes from one catch-all domain…"
                    className={control}
                  />
                </Field>
                <Segmented<RemoveMode>
                  legend="How it was meant"
                  value={removeMode}
                  onChange={setRemoveMode}
                  options={[
                    { value: "fraud", label: "Fraud, bar this email" },
                    {
                      value: "unsweep",
                      label: "Unsweep, they may vote again",
                    },
                  ]}
                />
                <div className="flex flex-wrap items-center gap-3">
                  {removeReason.trim() ? (
                    <Confirm
                      label="Remove this vote"
                      intent="danger"
                      question={
                        removeMode === "fraud"
                          ? `Remove the vote from ${email} as fraud?`
                          : `Remove the vote from ${email} and free them to vote again?`
                      }
                      consequence={
                        removeMode === "fraud"
                          ? "It stops counting and the email is barred from this round. The voter is not told; the public answer never changes."
                          : "It stops counting and the email may cast a fresh vote while the round is open."
                      }
                      confirmLabel="Yes, remove it"
                      pending={busy}
                      onConfirm={() =>
                        act(
                          {
                            action: "remove",
                            voteId: voteId,
                            reason: removeReason.trim(),
                            mode: removeMode,
                          },
                          removeMode === "fraud"
                            ? "Removed as fraud. The email is barred for the round."
                            : "Removed. They may vote again.",
                        )
                      }
                    />
                  ) : (
                    <p className="text-sm text-ink-2">
                      Give the reason first.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setRemoving(null)}
                    className={buttonClass("quiet")}
                  >
                    Never mind
                  </button>
                </div>
    </div>
  );



  const signalsBlock = tally && (
    <div className={SPACING.related}>
      <h3 className="eyebrow text-ink-4">Signals</h3>
      <p className="max-w-prose text-sm leading-relaxed text-ink-2">
        {tally.unverified === 0
          ? "Every counted vote has a verified inbox."
          : `${count(tally.unverified)} cast and never verified. They count nothing, but a large number here is itself worth a look.`}
      </p>

      {tally.domains.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-white">
            Votes by domain, big consumer providers left out
          </p>
          <dl className="mt-2 divide-y divide-line border-y border-line">
            {tally.domains.slice(0, visibleDomains).map((d) => {
              const key = `domain:${d.domain}`;
              const open = openCluster === key;
              return (
                <div key={d.domain}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenCluster(open ? null : key)}
                    className="flex min-h-11 w-full cursor-pointer items-baseline justify-between gap-4 py-2 text-left transition-colors hover:bg-card-2"
                  >
                    <dt className="truncate text-sm text-ink-2">
                      {d.domain}
                      <span className="ml-2 text-ink-4">
                        {open ? "hide" : "show votes"}
                      </span>
                    </dt>
                    <dd className="tabular-nums text-sm text-ink-2">
                      {count(d.votes)}
                    </dd>
                  </button>
                  {open && renderMembers(d.members)}
                </div>
              );
            })}
          </dl>
          {tally.domains.length > visibleDomains ? (
            <button
              type="button"
              onClick={() => setVisibleDomains((v) => v + PAGE)}
              className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
            >
              Show more ({tally.domains.length - visibleDomains} more)
            </button>
          ) : (
            <p className="mt-3 text-sm text-ink-4">
              Showing all {tally.domains.length}{" "}
              {tally.domains.length === 1 ? "domain" : "domains"}.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-3">
          No votes from outside the big consumer providers.
        </p>
      )}

      {tally.ips.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-white">
            Same connection, three votes or more
          </p>
          <dl className="mt-2 divide-y divide-line border-y border-line">
            {tally.ips.slice(0, visibleIps).map((ip) => {
              const key = `ip:${ip.ipHash}`;
              const open = openCluster === key;
              return (
                <div key={ip.ipHash}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenCluster(open ? null : key)}
                    className="flex min-h-11 w-full cursor-pointer items-baseline justify-between gap-4 py-2 text-left transition-colors hover:bg-card-2"
                  >
                    <dt className="truncate font-mono text-sm text-ink-2">
                      {ip.ipHash.slice(0, 16)}…
                      <span className="ml-2 font-sans text-ink-4">
                        {open ? "hide" : "show votes"}
                      </span>
                    </dt>
                    <dd className="tabular-nums text-sm text-ink-2">
                      {count(ip.votes)}
                    </dd>
                  </button>
                  {open && renderMembers(ip.members)}
                </div>
              );
            })}
          </dl>
          {tally.ips.length > visibleIps ? (
            <button
              type="button"
              onClick={() => setVisibleIps((v) => v + PAGE)}
              className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
            >
              Show more ({tally.ips.length - visibleIps} more)
            </button>
          ) : (
            <p className="mt-3 text-sm text-ink-4">
              Showing all {tally.ips.length}{" "}
              {tally.ips.length === 1 ? "cluster" : "clusters"}.
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-white">Find a vote</p>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
          For a vote you already know about: the rehearsal one you cast
          yourself, or one somebody reported. Consumer inboxes are left out
          of the signals above, so this is the only way to reach them.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <Field id="lookup-email" label="Their email">
            <input
              id="lookup-email"
              name="lookup-email"
              type="email"
              autoComplete="off"
              value={lookupEmail}
              onChange={(event) => {
                setLookupEmail(event.target.value);
                setLookupResult(null);
              }}
              placeholder="name@example.com"
              className={control}
            />
          </Field>
          <button
            type="button"
            disabled={busy || !lookupEmail.trim()}
            onClick={lookup}
            className={buttonClass("secondary")}
          >
            Find it
          </button>
        </div>
        {lookupResult !== null &&
          (lookupResult.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">
              No counted vote from that address in this round.
            </p>
          ) : (
            <div className="mt-3 border-y border-line">
              {renderMembers(lookupResult)}
            </div>
          ))}
      </div>

      {heldCount > 0 && (
        <div>
          <p className="text-sm font-semibold text-white">
            Held votes, waiting on you
          </p>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
            Verified, but past the domain cap. Release the innocent ones into
            the tally; remove the rest with the reason recorded.
          </p>
          <div className="mt-2 border-b border-line">
            {tally.held.slice(0, visibleHeld).map((h) => (
              <div key={h.voteId} className="border-t border-line py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {h.email}
                    </p>
                    <p className="text-sm text-ink-4">
                      {h.domain} · {dateTime(h.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act(
                          { action: "release", voteId: h.voteId },
                          "Released. It counts now.",
                        )
                      }
                      className={buttonClass("secondary")}
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRemoving(h.voteId);
                        setRemoveReason("");
                        setRemoveMode("fraud");
                      }}
                      className={buttonClass("danger")}
                    >
                      Remove…
                    </button>
                  </div>
                </div>

                {removing === h.voteId &&
                  renderRemoveForm(h.voteId, h.email)}
              </div>
            ))}
          </div>
          {heldCount > visibleHeld ? (
            <button
              type="button"
              onClick={() => setVisibleHeld((v) => v + PAGE)}
              className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
            >
              Show more ({heldCount - visibleHeld} more)
            </button>
          ) : (
            <p className="mt-3 text-sm text-ink-4">
              Showing all {heldCount} held{" "}
              {heldCount === 1 ? "vote" : "votes"}.
            </p>
          )}
        </div>
      )}
    </div>
  );

  /* -------------------------------------------------------------------- */

  /*
   * One remove form, three callers.
   *
   * It used to live inline in the held list and nowhere else, which is the
   * whole of the defect this change fixes: the held list was the only place
   * the console ever printed a vote id, and the domain cap holds nothing
   * from gmail, yahoo or outlook. A reviewer reading "eighteen votes from
   * one connection" had no control to press, and P0806 then refuses to
   * announce anyone but the leader those votes chose.
   */
  /*
   * Find one address's votes.
   *
   * A read, so it does not go through act(): nothing refreshes, nothing is
   * recorded, and a miss is an answer rather than an error.
   */
  async function lookup() {
    const email = lookupEmail.trim().toLowerCase();
    if (!email || !round) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/vote-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup",
          roundId: round.roundId,
          email,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      setLookupResult(result.votes ?? []);
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <JobCard
      id="vote-round"
      step="Sunday"
      title={`Community Favourite vote, week ${weekNo}`}
      state={state}
      status={status}
      hint={hint}
      foot={
        !round ? (
          <>
            {!frozen && (
              <Panel tone="warn" className="w-full">
                <p className="text-sm font-semibold text-white">
                  Record the standings first
                </p>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
                  The vote can open without the freeze, but announcing the
                  winner cannot happen against an unrecorded week. Recording
                  now saves a locked Sunday evening.
                </p>
              </Panel>
            )}
            <button
              type="button"
              disabled={busy || !openReady}
              onClick={openRound}
              className={buttonClass("primary")}
            >
              {busy ? "Working…" : "Open the vote"}
            </button>
            {selected.length > 0 && (
              <p className="text-sm text-ink-2">
                {selected.length} of 5 picked.
              </p>
            )}
          </>
        ) : reviewed ? undefined : round.status === "closed" ? (
          <Confirm
            label="Mark review complete"
            question={
              heldCount > 0
                ? `Mark the review complete with ${heldCount} ${heldCount === 1 ? "vote" : "votes"} still held?`
                : "Mark the review complete?"
            }
            consequence="This says a person has looked at every held vote and cluster; it is what unlocks announcing Community Favourite. Votes left held stay out of the tally."
            confirmLabel="Yes, the sweep is done"
            pending={busy}
            onConfirm={() => act({ action: "review", roundId: round.roundId }, "Review marked complete. Announcing is unlocked.")}
          />
        ) : (
          <Confirm
            label="Close the vote"
            question={`Close the week ${weekNo} vote now?`}
            consequence="Casting stops for everybody the moment you confirm. Codes already sent still verify for fifteen minutes, then the tally moves only by your sweep."
            confirmLabel="Yes, close it"
            pending={busy}
            onConfirm={() => act({ action: "close", roundId: round.roundId }, "The vote is closed.")}
          />
        )
      }
    >
      {/* The page the voters see, one click from the card that runs it:
          the shortlist URL is otherwise something an owner reconstructs
          from memory on a Sunday. */}
      <p className="mb-4">
        <a
          href="/campaigns/monica-money-story/winners#shortlist"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
        >
          Open the public voting page
        </a>
      </p>
      {!round ? (
        <div className={SPACING.section}>
          {candidates.length === 0 ? (
            <p className="max-w-prose text-sm leading-relaxed text-ink-2">
              No approved entries for week {weekNo} yet. The ballot is built
              from approved entries, so approvals come first.
            </p>
          ) : (
            <fieldset>
              <legend className="text-sm font-semibold text-white">
                Nominees, three to five
              </legend>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
                The approved entries of the week, strongest first.
              </p>
              <div className="mt-3 divide-y divide-line border-y border-line">
                {candidates.slice(0, visibleCandidates).map((c) => {
                  const on = selected.includes(c.entryId);
                  return (
                    <label
                      key={c.entryId}
                      className="flex min-h-11 cursor-pointer items-center gap-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={busy || (!on && selected.length >= 5)}
                        onChange={() => toggle(c.entryId)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-brand-gold"
                      />
                      <span className="w-full min-w-0 flex-1 truncate text-sm font-semibold text-white">
                        {c.name}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-ink-3">
                        {count(c.points)} points ·{" "}
                        {c.approvedPlatforms}{" "}
                        {c.approvedPlatforms === 1 ? "platform" : "platforms"}
                      </span>
                    </label>
                  );
                })}
              </div>
              {candidates.length > visibleCandidates ? (
                <button
                  type="button"
                  onClick={() => setVisibleCandidates((v) => v + PAGE)}
                  className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
                >
                  Show more ({candidates.length - visibleCandidates} more)
                </button>
              ) : (
                <p className="mt-3 text-sm text-ink-4">
                  Showing all {candidates.length} approved{" "}
                  {candidates.length === 1 ? "entry" : "entries"}.
                </p>
              )}
            </fieldset>
          )}

          {needsOverride && (
            <Field
              id="few-reason"
              label="Why fewer than three"
              hint="The engine refuses a short ballot unless the reason travels with it. It goes in the audit log."
            >
              <input
                id="few-reason"
                name="few-reason"
                autoComplete="off"
                value={fewReason}
                onChange={(event) => setFewReason(event.target.value)}
                maxLength={300}
                placeholder="Only two entries were approved this week…"
                className={control}
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              id="vote-day"
              label="Voting day"
              hint="Sundays by rhythm, not by rule."
            >
              <input
                id="vote-day"
                name="vote-day"
                type="date"
                value={voteDay}
                onChange={(event) => setVoteDay(event.target.value)}
                className={control}
              />
            </Field>
            <Field id="opens-time" label="Opens" hint="Lagos time.">
              <input
                id="opens-time"
                name="opens-time"
                type="time"
                value={opensTime}
                onChange={(event) => setOpensTime(event.target.value)}
                className={control}
              />
            </Field>
            <Field id="closes-time" label="Closes" hint="Lagos time.">
              <input
                id="closes-time"
                name="closes-time"
                type="time"
                value={closesTime}
                onChange={(event) => setClosesTime(event.target.value)}
                className={control}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className={SPACING.section}>
          {!reviewed && (
            <p className="text-sm text-ink-3">
              Runs {dateTime(round.opensAt)} to {dateTime(round.closesAt)},
              Lagos.
            </p>
          )}
          {reviewed && (
            <p className="max-w-prose text-sm leading-relaxed text-ink-2">
              A person has looked at every held vote and cluster. Announce the
              winner from the{" "}
              <a
                href="#announce"
                className="text-link underline underline-offset-4"
              >
                announce card above
              </a>
              , which is what makes it public.
            </p>
          )}
          {tallyBlock}
          {!reviewed && signalsBlock}
        </div>
      )}
    </JobCard>
  );
}
