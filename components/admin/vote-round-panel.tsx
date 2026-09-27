"use client";

import { useEffect, useState } from "react";
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
import { ActionDialog } from "@/components/shared/action-dialog";
import { Confirm } from "@/components/shared/confirm";
import { count, dateTime } from "@/lib/format";
import { openableHref } from "@/lib/admin/openable-href";
import { monicaStages, platformLabels, type CampaignPlatform } from "@/lib/campaigns";
import { PLATFORM_ICON } from "@/components/shared/platform-icon";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface RoundView {
  roundId: string;
  status: "draft" | "open" | "closed" | "published";
  opensAt: string;
  closesAt: string;
  reviewedAt: string | null;
  /** When the creators were told, from the send's audit row. */
  announced?: {
    at: string;
    finished: boolean;
    sent: number | null;
    failed?: number | null;
  } | null;
}

export interface EntryCandidateRow {
  entryId: string;
  name: string;
  points: number;
  approvedPlatforms: number;
  /** Approved posts with the handle registered on each platform. */
  posts?: { platform: CampaignPlatform; handle: string | null; url: string }[];
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
  /**
   * One row per registrable domain, the key the cap and "Remove all" use.
   * hosts lists where the votes actually came from, so a farm spread over
   * subdomains is visible as one.
   */
  domains: {
    domain: string;
    votes: number;
    members: ClusterVote[];
    hosts?: { host: string; votes: number }[];
  }[];
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

/** YYYY-MM-DD, `days` after another, by the calendar rather than 24-hour steps. */
function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A Lagos date and time as an instant. Lagos is UTC+1 all year, so the offset
 * is fixed; null when either field is empty or unreadable.
 */
function lagosInstant(day: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${day}T${time}:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "48 hours", "36 hours 30 minutes", for the length of a vote. */
function lengthOf(from: Date, to: Date): string {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = hours === 1 ? "1 hour" : `${hours} hours`;
  const m = rest === 1 ? "1 minute" : `${rest} minutes`;
  if (hours === 0) return m;
  return rest ? `${h} ${m}` : h;
}

/** "Sunday 27 September", read from the YYYY-MM-DD the date field holds. */
function longDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function listOf(names: string[]): string {
  return new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format(names);
}

/**
 * One approved post, as the account it was filed under. Opens the post.
 *
 * A chip with the platform's mark rather than an underlined "X @handle":
 * three of those per row, on every row, were most of what made the list
 * look like a wall of links.
 */
function HandleChip({
  post,
}: {
  post: { platform: CampaignPlatform; handle: string | null; url: string };
}) {
  const Icon = PLATFORM_ICON[post.platform];
  const label = platformLabels[post.platform];
  const shown = post.handle ? `@${post.handle.replace(/^@/, "")}` : "post";
  const inner = (
    <>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{shown}</span>
    </>
  );
  const chip =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-2 px-2 py-0.5 text-xs text-ink-2";
  const href = openableHref(post.url);
  if (!href) {
    return (
      <span className={chip} aria-label={`${shown} on ${label}`} role="img">
        {inner}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // The name said in full: the handle, then where it is and what the link
      // does. As split text spans it read "@handleon X" to a screen reader.
      aria-label={`${shown} on ${label} (opens the approved post in a new tab)`}
      title={`Open the approved ${label} post`}
      className={`${chip} transition-colors hover:border-ink-3 hover:text-white`}
    >
      {inner}
    </a>
  );
}

/**
 * What happened to "Tell the creators" for this round: a short state word
 * in a Pill, the detail beside it as text. One sentence-long Pill did not
 * fit a 320px foot, and the words cut off were the ones that mattered.
 *
 * Green only for a send that finished and reached everybody. A send that
 * reached nobody, or left some behind, is amber, because somebody should
 * look; the route refuses a retry, so this line is where it gets noticed.
 */
function ToldLine({
  told,
}: {
  told: { at: string; finished: boolean; sent: number | null; failed?: number | null };
}) {
  const sent = told.sent ?? 0;
  const failed = told.failed ?? 0;
  const [tone, word] = !told.finished
    ? (["warn", "Not finished"] as const)
    : sent === 0 && failed > 0
      ? (["warn", "Not sent"] as const)
      : failed > 0
        ? (["warn", "Some not sent"] as const)
        : (["good", "Creators told"] as const);
  const detail = !told.finished
    ? `started ${dateTime(told.at)}`
    : `${dateTime(told.at)} · ${count(sent)} ${sent === 1 ? "email" : "emails"}${
        failed > 0 ? `, ${count(failed)} failed` : ""
      }`;
  return (
    <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
      <Pill tone={tone}>{word}</Pill>
      <span>{detail}</span>
    </p>
  );
}

/** One end of the voting window: a date and a time, labelled once. */
function WindowEnd({
  legend,
  id,
  day,
  time,
  minDay,
  onDay,
  onTime,
}: {
  legend: string;
  id: "opens" | "closes";
  day: string;
  time: string;
  minDay?: string;
  onDay: (value: string) => void;
  onTime: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
        {legend}
      </legend>
      {/* Date and time side by side from sm; on a phone each takes the
          full width, stacked, rather than a narrow time box alone. */}
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`${id}-day`} className="sr-only">
          {legend} date
        </label>
        <input
          id={`${id}-day`}
          name={`${id}-day`}
          type="date"
          value={day}
          min={minDay}
          onChange={(event) => onDay(event.target.value)}
          className={`${control} min-w-[10.5rem] flex-1`}
        />
        <label htmlFor={`${id}-time`} className="sr-only">
          {legend} time
        </label>
        <input
          id={`${id}-time`}
          name={`${id}-time`}
          type="time"
          value={time}
          onChange={(event) => onTime(event.target.value)}
          className={`${control} sm:w-32 sm:flex-none`}
        />
      </div>
    </fieldset>
  );
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
  isPast = false,
}: {
  weekNo: number;
  round: RoundView | null;
  candidates: EntryCandidateRow[];
  tally: TallyView | null;
  /** Whether this week's standings have been recorded yet. */
  frozen: boolean;
  /** The week is over: the next stage has started. */
  isPast?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  /*
   * A date and a time on each side. It was one "voting day" with an open and
   * a close time on it, so a vote could never run past midnight, and the plan
   * is a 48-hour vote. The close defaults to 48 hours after the open.
   */
  const [opensDay, setOpensDay] = useState(defaultVoteDay);
  const [opensTime, setOpensTime] = useState("08:00");
  const [closesDay, setClosesDay] = useState(() => addDays(defaultVoteDay(), 2));
  const [closesTime, setClosesTime] = useState("08:00");
  /*
   * The clock, read after mount (so the server and the first client render
   * agree) and every minute after. An open time already past means the vote
   * opens the moment it is confirmed, so its length runs from now.
   */
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);
  const [fewReason, setFewReason] = useState("");
  /** The vote whose removal is being confirmed, and whose email it names. */
  const [removing, setRemoving] = useState<{ voteId: string; email: string } | null>(null);
  /** A whole domain whose removal as fraud is being confirmed. */
  const [removingDomain, setRemovingDomain] = useState<{ domain: string; votes: number } | null>(null);
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
  const opensAt = lagosInstant(opensDay, opensTime);
  const closesAt = lagosInstant(closesDay, closesTime);
  // The engine refuses a close at or before the open (window_inverted); said
  // here, under the fields, before the round trip. A close already past would
  // open a vote nobody can cast in.
  const opensInPast = opensAt !== null && now !== null && opensAt.getTime() < now;
  const closesInPast = closesAt !== null && now !== null && closesAt.getTime() <= now;
  const windowOk =
    opensAt !== null && closesAt !== null && closesAt > opensAt && !closesInPast;
  const length =
    windowOk && opensAt && closesAt
      ? lengthOf(opensInPast && now !== null ? new Date(now) : opensAt, closesAt)
      : "";
  /*
   * A vote that runs past the start of the next stage needs this week's
   * standings recorded before it opens. Closing a round requires them
   * (P0804), and the snapshot route only records the current stage, so an
   * unrecorded week's vote opened on Sunday could never be closed on Tuesday.
   */
  const nextStage = monicaStages.find((stage) => stage.number === weekNo + 1);
  const crossesStage =
    closesAt !== null &&
    nextStage !== undefined &&
    closesAt.getTime() > new Date(nextStage.startsAt).getTime();
  const needsFreeze = crossesStage && !frozen;
  const openReady =
    selected.length > 0 &&
    selected.length <= 5 &&
    (!needsOverride || fewReason.trim().length > 0) &&
    windowOk &&
    !needsFreeze;

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
      setRemovingDomain(null);
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
        needsFreeze && selected.length > 0
          ? `Record the week ${weekNo} standings before opening a vote that runs into the next stage.`
          : !windowOk && selected.length > 0
          ? "The vote has to close after it opens."
          : needsOverride
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
        opensAt: `${opensDay}T${opensTime}:00+01:00`,
        closesAt: `${closesDay}T${closesTime}:00+01:00`,
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
      {heldCount > 0 && round?.status !== "published" && (
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
                setRemoving({ voteId: m.voteId, email: m.email });
                setRemoveReason("");
                setRemoveMode("fraud");
              }}
              aria-haspopup="dialog"
              className={buttonClass("danger")}
            >
              Remove…
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRemoveForm = (voteId: string, email: string) => (
    <div className={SPACING.related}>
                <Field
                  id={`remove-reason-${voteId}`}
                  label="Why it goes"
                  hint="Recorded in the audit log beside your name."
                >
                  <input
                    id={`remove-reason-${voteId}`}
                    data-autofocus
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
                    disabled={busy}
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
                  {open && (
                    <>
                      {/* One judgement for a farm, not one per vote. */}
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-card-2/40 px-3 py-3">
                        {/* Subdomains share the domain's allowance of ten
                            and go with it on "Remove all", so the row says
                            which hosts it is made of. */}
                        {d.hosts &&
                          (d.hosts.length > 1 || d.hosts[0]?.host !== d.domain) && (
                            <p className="basis-full text-sm text-ink-4 [overflow-wrap:anywhere]">
                              Subdomains count as one domain:{" "}
                              {d.hosts
                                .map((h) => `${h.host} ${count(h.votes)}`)
                                .join(" · ")}
                            </p>
                          )}
                        <p className="max-w-prose text-sm text-ink-2 [overflow-wrap:anywhere]">
                          All from {d.domain} look like one person?
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setRemovingDomain({ domain: d.domain, votes: d.votes });
                            setRemoveReason("");
                          }}
                          aria-haspopup="dialog"
                          className={buttonClass("danger")}
                        >
                          Remove all {count(d.votes)} as fraud…
                        </button>
                      </div>
                      {renderMembers(d.members)}
                    </>
                  )}
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
                        setRemoving({ voteId: h.voteId, email: h.email });
                        setRemoveReason("");
                        setRemoveMode("fraud");
                      }}
                      aria-haspopup="dialog"
                      className={buttonClass("danger")}
                    >
                      Remove…
                    </button>
                  </div>
                </div>

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
  /*
   * Tell the campaign the vote is open.
   *
   * Opening the round already mails the three to five nominees. Everybody
   * else heard nothing, which on the one prize decided purely by turnout
   * quietly made it a contest between whoever already had the largest
   * audience. A separate press, because a round is often staged the day
   * before it runs and a send riding along with the open would announce a
   * page that refuses every ballot.
   */
  /* The send as this page knows it: the audit row the server read, or the
     answer to a press made on this page before the refresh brings that row
     in. Local state alone forgot the send on every reload and put the
     button back on a vote whose email had already gone out.

     The local answer names its round. The week links change only the
     query string, which keeps this panel mounted, and an answer that was
     not tied to a round followed the owner to the next week's vote, hiding
     its button behind a claim nobody had been told about it. */
  const [toldHere, setToldHere] = useState<{
    roundId: string;
    at: string;
    sent: number;
    failed: number;
  } | null>(null);
  const told = round?.announced
    ? round.announced
    : toldHere && round && toldHere.roundId === round.roundId
      ? { at: toldHere.at, finished: true, sent: toldHere.sent, failed: toldHere.failed }
      : null;

  async function announceVote() {
    if (!round) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/announce-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: round.roundId }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        // A refusal usually means this page is behind: another owner sent
        // it, or this press outlived the gateway while the server kept
        // sending. The refresh reads the audit row and swaps the button for
        // what actually happened.
        await router.refresh();
        return;
      }
      setToldHere({
        roundId: round.roundId,
        // The claim's time, the same one the refresh will read back.
        at: typeof result.startedAt === "string" ? result.startedAt : new Date().toISOString(),
        sent: Number(result.sent ?? 0),
        failed: Number(result.failed ?? 0),
      });
      toast.success(
        `Told ${result.sent} ${result.sent === 1 ? "creator" : "creators"}.` +
          (result.failed ? ` ${result.failed} did not go through.` : ""),
      );
      await router.refresh();
    } catch {
      // The answer was lost, not necessarily the send.
      toast.error("We lost the answer. Checking whether the email went out.");
      await router.refresh();
    } finally {
      setBusy(false);
    }
  }

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
        !round && isPast ? undefined : !round ? (
          <>
            {!frozen && (
              <Panel tone="warn" className="w-full">
                <p className="text-sm font-semibold text-white">
                  Record the standings first
                </p>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
                  Announcing the winner needs this week&apos;s standings, and a
                  vote that runs past the start of the next stage cannot even
                  be closed without them. Record them now, while the week is
                  current.
                </p>
              </Panel>
            )}
            {/* Keyed, like every step's Confirm on this card: the foot swaps
                one step's buttons for the next when a refresh brings a round
                in, and an unkeyed Confirm in the same slot would carry an
                open "Open the vote?" across as an open "Close the vote?".
                The day and times sit further down the card than the button,
                with defaults nobody has to touch, so the question says them
                back along with the names. Nothing about a round changes once
                it is open, and the nominees are emailed straight away. */}
            <Confirm
              key="open-vote"
              label="Open the vote"
              question={`Open the week ${weekNo} vote with ${listOf(
                selected.map(
                  (id) => candidates.find((c) => c.entryId === id)?.name ?? "an entry",
                ),
              )}, from ${opensInPast ? "now" : `${longDay(opensDay)} ${opensTime}`} to ${longDay(closesDay)} ${closesTime} Lagos time${
                length ? ` (${opensInPast ? "about " : ""}${length})` : ""
              }?${
                needsOverride ? " Fewer than three nominees, with your reason recorded." : ""
              }`}
              consequence="Each nominee is emailed now and the shortlist goes on the public voting page. A week gets one round, and its nominees and times cannot be changed once it is open."
              confirmLabel="Yes, open the vote"
              pending={busy}
              disabled={!openReady}
              onConfirm={openRound}
            />
            {selected.length > 0 && (
              <p className="text-sm text-ink-2">
                {selected.length} of 5 picked.
              </p>
            )}
          </>
        ) : reviewed ? undefined : round.status === "closed" ? (
          <Confirm
            key="review-vote"
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
          <>
            {/* Offered only while the round is actually taking ballots, and
                only once per round: the audit row is what remembers, and
                once it exists the button gives way to when it was sent.
                Next week's round is a new round with no row, so the button
                is back for it. The route refuses a second press as well. */}
            {told ? (
              <ToldLine told={told} />
            ) : (
              new Date(round.opensAt).getTime() <= Date.now() &&
              new Date(round.closesAt).getTime() > Date.now() && (
                <Confirm
                  key="tell-vote"
                  label="Tell the creators"
                  question={`Email every active creator that the week ${weekNo} vote is open?`}
                  consequence="One email each, naming the shortlist and the closing time. It can only be sent once for this round."
                  confirmLabel="Yes, tell them"
                  pending={busy}
                  onConfirm={announceVote}
                />
              )
            )}
            <Confirm
              key="close-vote"
              label="Close the vote"
            question={`Close the week ${weekNo} vote now?`}
            consequence="Casting stops for everybody the moment you confirm. Codes already sent still verify for fifteen minutes, then the tally moves only by your sweep."
            confirmLabel="Yes, close it"
            pending={busy}
              onConfirm={() => act({ action: "close", roundId: round.roundId }, "The vote is closed.")}
            />
          </>
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
      {!round && isPast ? (
        <p className="max-w-prose text-sm leading-relaxed text-ink-2">
          Week {weekNo}&apos;s vote was never opened, and the week is over. A
          vote is opened while its week is current.
        </p>
      ) : !round ? (
        <div className={SPACING.section}>
          {candidates.length === 0 ? (
            <p className="max-w-prose text-sm leading-relaxed text-ink-2">
              No approved entries for week {weekNo} yet. The ballot is built
              from approved entries, so approvals come first.
            </p>
          ) : (
            <fieldset>
              <legend className="sr-only">Nominees, three to five</legend>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Nominees</p>
                  <p className="mt-1 text-sm text-ink-3">
                    Pick three to five of the week&apos;s approved entries,
                    strongest first.
                  </p>
                </div>
                <Pill tone={selected.length >= 3 ? "gold" : "neutral"}>
                  {selected.length} of 5 picked
                </Pill>
              </div>
              {/* Cards, two to a row from sm. Each says who the nominee is
                  three ways: the name, the points, and the account behind
                  every approved post, as quiet chips that open the post.
                  The list was a stack of rows where every handle was an
                  underlined blue link, and read as a wall of links. */}
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {candidates.slice(0, visibleCandidates).map((c) => {
                  const on = selected.includes(c.entryId);
                  const locked = busy || (!on && selected.length >= 5);
                  return (
                    <li key={c.entryId}>
                      <label
                        className={`flex h-full items-start gap-3 rounded-lg border px-4 py-3 transition-colors duration-150 ${
                          on
                            ? "border-brand-gold/60 bg-brand-gold/[0.07]"
                            : "border-line hover:border-line-2 hover:bg-card-2"
                        } ${locked && !on ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={locked}
                          onChange={() => toggle(c.entryId)}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-gold disabled:cursor-not-allowed"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-2">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-white">
                              {c.name}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-ink-3">
                              {count(c.points)} pts
                            </span>
                          </span>
                          {(c.posts?.length ?? 0) > 0 && (
                            <span className="flex flex-wrap gap-1.5">
                              {c.posts!.map((post) => (
                                <HandleChip key={post.platform} post={post} />
                              ))}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
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

          {/* The window as one block: when it opens, when it closes, and how
              long that is, said back as the fields change so a close typed on
              the wrong day shows up before the vote does. */}
          <section
            aria-labelledby="vote-window-title"
            className="rounded-lg border border-line p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id="vote-window-title" className="text-sm font-semibold text-white">
                Voting window
              </p>
              {windowOk && !needsFreeze && (
                <Pill tone="gold">{opensInPast ? `About ${length}` : length}</Pill>
              )}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <WindowEnd
                legend="Opens"
                id="opens"
                day={opensDay}
                time={opensTime}
                onDay={setOpensDay}
                onTime={setOpensTime}
              />
              <WindowEnd
                legend="Closes"
                id="closes"
                day={closesDay}
                time={closesTime}
                minDay={opensDay}
                onDay={setClosesDay}
                onTime={setClosesTime}
              />
            </div>
            <p
              className={`mt-4 text-sm ${windowOk && !needsFreeze ? "text-ink-3" : "text-red-300"}`}
              aria-live="polite"
            >
              {!windowOk
                ? closesInPast
                  ? "The close time has already passed."
                  : "The vote has to close after it opens."
                : needsFreeze
                  ? `Record the week ${weekNo} standings first. This vote closes after stage ${weekNo + 1} starts, and closing it needs week ${weekNo}'s standings, which can only be recorded until then.`
                  : opensInPast
                    ? `The open time has passed, so it opens as soon as you confirm and closes ${longDay(closesDay)} ${closesTime}. All times Lagos.`
                    : `${longDay(opensDay)} ${opensTime} to ${longDay(closesDay)} ${closesTime}. All times Lagos.`}
            </p>
          </section>
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
          {/*
            * The sweep survives the review, and stops at publication.
            *
            * It was gated on `reviewed`, so marking the review complete
            * deleted the held list, the clusters and the lookup from the
            * page. That is the exact window it is most needed in: the
            * minutes between certifying and announcing, when a nominee can
            * still write in about a farmed cluster.
            *
            * And the engine disagreed with the screen. remove_vote checks
            * the admin, the mode, the reason and that the vote exists, and
            * nothing about whether the round is reviewed; vote_tally is a
            * live view over countable_votes, so a removal moves the tally
            * at once. Since publish_weekly_winner refuses anybody but the
            * tally leader (P0806), removing a fraudulent vote after the
            * review genuinely changes who may be announced. The console
            * was hiding a control that still worked and still mattered.
            *
            * Published is the real end of it: the winner is public and
            * immutable, so there is nothing left for a removal to change.
            */}
          {round.status !== "published" && signalsBlock}
        </div>
      )}

      {/*
       * Removing a vote, in front of the admin.
       *
       * The reason form expanded under the vote that was pressed, inside an
       * expanded cluster or the held list. From a row near the bottom of the
       * screen the reason field and the confirm landed below the fold, and
       * the Remove button appeared to do nothing. One dialog serves every
       * list the button appears in.
       */}
      <ActionDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
        title={removing ? `Remove the vote from ${removing.email}` : "Remove a vote"}
        tone="danger"
        busy={busy}
      >
        {removing && renderRemoveForm(removing.voteId, removing.email)}
      </ActionDialog>
      <ActionDialog
        open={removingDomain !== null}
        onOpenChange={(next) => {
          if (!next) setRemovingDomain(null);
        }}
        title={
          removingDomain
            ? `Remove every verified vote from ${removingDomain.domain}`
            : "Remove a domain's votes"
        }
        tone="danger"
        busy={busy}
      >
        {removingDomain && round && (
          <div className={SPACING.related}>
            <Field
              id="remove-domain-reason"
              label="Why they go"
              hint="Recorded in the audit log beside your name, once for each vote."
            >
              <input
                id="remove-domain-reason"
                data-autofocus
                name="remove-domain-reason"
                autoComplete="off"
                value={removeReason}
                onChange={(event) => setRemoveReason(event.target.value)}
                maxLength={300}
                placeholder="Catch-all domain, random addresses, all within minutes…"
                className={control}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              {removeReason.trim() ? (
                <Confirm
                  label={`Remove all ${count(removingDomain.votes)}`}
                  intent="danger"
                  question={`Remove all ${count(removingDomain.votes)} ${
                    removingDomain.votes === 1 ? "vote" : "votes"
                  } from ${removingDomain.domain} as fraud?`}
                  consequence={`They stop counting and each email is barred from this round. The removed votes still use up ${removingDomain.domain}'s allowance of ten this round, so at most ${Math.max(0, 10 - removingDomain.votes)} more from it can count before later ones are held. Voters are not told; the public answer never changes.`}
                  confirmLabel="Yes, remove them all"
                  pending={busy}
                  onConfirm={() =>
                    act(
                      {
                        action: "remove_domain",
                        roundId: round.roundId,
                        domain: removingDomain.domain,
                        reason: removeReason.trim(),
                      },
                      "Removed as fraud.",
                    )
                  }
                />
              ) : (
                <p className="text-sm text-ink-2">Give the reason first.</p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setRemovingDomain(null)}
                className={buttonClass("quiet")}
              >
                Never mind
              </button>
            </div>
          </div>
        )}
      </ActionDialog>
    </JobCard>
  );
}
