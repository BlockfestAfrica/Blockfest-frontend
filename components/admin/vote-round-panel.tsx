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

export interface TallyView {
  nominees: { nomineeId: string; name: string; votes: number }[];
  domains: { domain: string; votes: number }[];
  ips: { ipHash: string; votes: number }[];
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
  const [removeReason, setRemoveReason] = useState("");
  const [removeMode, setRemoveMode] = useState<RemoveMode>("fraud");

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
            {tally.domains.map((d) => (
              <div
                key={d.domain}
                className="flex items-baseline justify-between gap-4 py-2"
              >
                <dt className="truncate text-sm text-ink-2">{d.domain}</dt>
                <dd className="tabular-nums text-sm text-ink-2">
                  {count(d.votes)}
                </dd>
              </div>
            ))}
          </dl>
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
            {tally.ips.map((ip) => (
              <div
                key={ip.ipHash}
                className="flex items-baseline justify-between gap-4 py-2"
              >
                <dt className="truncate font-mono text-sm text-ink-2">
                  {ip.ipHash.slice(0, 16)}…
                </dt>
                <dd className="tabular-nums text-sm text-ink-2">
                  {count(ip.votes)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

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
            {tally.held.map((h) => (
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

                {removing === h.voteId && (
                  <div className={`mt-4 ${SPACING.related}`}>
                    <Field
                      id={`remove-reason-${h.voteId}`}
                      label="Why it goes"
                      hint="Recorded in the audit log beside your name."
                    >
                      <input
                        id={`remove-reason-${h.voteId}`}
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
                              ? `Remove the vote from ${h.email} as fraud?`
                              : `Remove the vote from ${h.email} and free them to vote again?`
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
                                voteId: h.voteId,
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
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* -------------------------------------------------------------------- */

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
                {candidates.map((c) => {
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
