"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  buttonClass,
  control,
  Pill,
  selectControl,
  SectionHeading,
  Segmented,
} from "@/components/shared/panel";

/** The sources a person may write. The engine owns challenge_entry and referral. */
const AWARD_SOURCES = [
  { key: "quality_bonus", label: "Quality" },
  { key: "featured_blockfest", label: "Featured by us" },
  { key: "featured_monica", label: "Featured by Monica" },
  { key: "engagement_milestone", label: "Engagement" },
  { key: "collab", label: "Collaboration" },
  { key: "wildcard_win", label: "Wildcard" },
  { key: "manual_adjustment", label: "Correction" },
] as const;

/** The label a person reads, for a source key the database stores. */
function sourceLabel(key: string): string {
  return AWARD_SOURCES.find((s) => s.key === key)?.label ?? key;
}

/** Rows shown before the reader asks for more. */
const PAGE = 10;

/** One manual ledger row: a bonus given, or one taken back. */
export interface AwardRecord {
  source: string;
  points: number;
  note: string | null;
  /** Pre-formatted Lagos time, so this component never touches timezones. */
  atLabel: string;
  /** Who gave it. Null if that admin row has since gone. */
  by: string | null;
  /** Set for engagement bonuses, which attach to one entry. */
  entryId: string | null;
  weekNo: number | null;
}

/** Net extra points: bonuses given minus bonuses taken back. */
function extraPoints(awards: AwardRecord[]): number {
  return awards.reduce((total, a) => total + a.points, 0);
}

export interface ParticipantRow {
  enrolmentId: string;
  name: string;
  email: string;
  joinedAt: string;
  handles: string[];
  /** Approved entries, for the engagement bonus picker. */
  entries: { id: string; weekNo: number }[];
  /** Every manual award and take-back, newest first. */
  awards: AwardRecord[];
  submitted: number;
  approved: number;
  points: number;
  active: boolean;
}

type SortKey = "name" | "joinedAt" | "submitted" | "approved" | "points";
type Filter = "all" | "submitted" | "silent" | "approved" | "extra";

/**
 * Everyone who joined, whether or not they have submitted anything.
 *
 * A real table, because this is the one screen here that is genuinely tabular:
 * seven values per person, compared down columns. The review queue is not, which
 * is why it is a list.
 *
 * Filtering and sorting happen in the browser. The whole set arrives at once,
 * it is a few hundred rows at most, and a round trip per column click on a
 * screen somebody is scanning would make it feel broken.
 */
export function ParticipantsTable({
  rows,
  canCorrectHandles = false,
}: {
  rows: ParticipantRow[];
  /** Owners only. Editing a handle moves attribution, so the control is not
   *  rendered for reviewers at all rather than rendered and refused. */
  canCorrectHandles?: boolean;
}) {
  const router = useRouter();
  /** Which handle is being corrected: one at a time, keyed by row and platform. */
  /** Which row is being disqualified, and the reason being typed for it. */
  const [voiding, setVoiding] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [fixing, setFixing] = useState<{
    enrolmentId: string;
    platform: string;
    current: string;
  } | null>(null);
  /** Which row has the award panel open. One at a time, on purpose. */
  const [awarding, setAwarding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("joinedAt");
  const [ascending, setAscending] = useState(false);
  /*
   * Ten rows at a time, and one window for both shapes: the cards and the
   * table slice the same array, so the reveal moves them together. Narrowing
   * or re-sorting resets the window because the question changed.
   */
  const [visible, setVisible] = useState(PAGE);

  const matching = useMemo(() => {
    // Searching lives on the page now and runs in the database, so this only
    // narrows by the chips.
    const filtered = rows.filter((row) => {
      if (filter === "submitted" && row.submitted === 0) return false;
      if (filter === "silent" && row.submitted > 0) return false;
      if (filter === "approved" && row.approved === 0) return false;
      if (filter === "extra" && row.awards.length === 0) return false;
      return true;
    });

    const direction = ascending ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name) * direction;
        case "joinedAt":
          return (
            (new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()) *
            direction
          );
        default:
          return (a[sort] - b[sort]) * direction;
      }
    });
  }, [rows, filter, sort, ascending]);
  const shown = matching.slice(0, visible);

  async function submitAward(
    enrolmentId: string,
    source: string,
    points: number,
    note: string,
    entryId?: string,
  ) {
    if (!note.trim()) {
      toast.error("Say why. It is what a dispute is answered with.");
      return;
    }
    if (!Number.isFinite(points) || points === 0) {
      toast.error("Zero points is not an award.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrolmentId,
          source,
          points,
          note: note.trim(), entryId,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      toast.success(
        `${points > 0 ? "Awarded" : "Removed"} ${Math.abs(points)} points`,
      );
      setAwarding(null);
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Disqualification. The engine reverses the points this enrolment earned
   * and claws back referral payouts it triggered, all inside one function
   * with its own audit row; this only carries the reason, which SQL
   * requires because a disqualification with no reason cannot be answered.
   */
  async function voidEnrolment(enrolmentId: string, name: string) {
    const reason = voidReason.trim();
    if (!reason) {
      toast.error("Say why. It is what a dispute is answered with.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolmentId, reason }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(
        `${name} is disqualified. ${result.pointsReversed ?? 0} points reversed.`,
      );
      setVoiding(null);
      setVoidReason("");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function sortBy(key: SortKey) {
    setVisible(PAGE);
    if (key === sort) {
      setAscending((a) => !a);
      return;
    }
    setSort(key);
    // Names read naturally A to Z; numbers and dates are almost always wanted
    // largest or newest first.
    setAscending(key === "name");
  }

  /*
   * Derived from what is on screen, not from everything loaded.
   *
   * Opening the award panel for a row and then changing a filter used to leave
   * the panel open for a creator who is no longer in the list, which is the
   * worst possible state for the one control that moves points.
   */
  const selected = shown.find((r) => r.enrolmentId === awarding) ?? null;
  /* The same lookup for the void panel, which now renders once after the
     list rather than inside each md:hidden card. */
  const voidingRow = shown.find((r) => r.enrolmentId === voiding) ?? null;
  const awardRef = useRef<HTMLDivElement>(null);

  /*
   * Bring the panel to the person who opened it.
   *
   * It renders after the entire list, so tapping Points on the fortieth row of
   * five hundred opened a form several thousand pixels below the fold with no
   * scroll, no focus move and no visible acknowledgement. On a phone the button
   * appeared to do nothing at all.
   */
  useEffect(() => {
    if (!selected) return;
    awardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    awardRef.current
      ?.querySelector<HTMLElement>("select, input, button")
      ?.focus();
  }, [selected]);

  const counts = {
    all: rows.length,
    submitted: rows.filter((r) => r.submitted > 0).length,
    silent: rows.filter((r) => r.submitted === 0).length,
    approved: rows.filter((r) => r.approved > 0).length,
    extra: rows.filter((r) => r.awards.length > 0).length,
  };

  return (
    <div className="space-y-6">
      {/* A legend, because four buttons in a row with one of them gold do not
          say what dimension they are choosing along. */}
      <Segmented<Filter>
        legend="Show"
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setVisible(PAGE);
        }}
        options={[
          { value: "all", label: `Everyone (${counts.all})` },
          { value: "submitted", label: `Submitted (${counts.submitted})` },
          { value: "silent", label: `Never submitted (${counts.silent})` },
          { value: "approved", label: `Has an approval (${counts.approved})` },
          { value: "extra", label: `Given extra points (${counts.extra})` },
        ]}
      />

      {/* Said plainly, because the figures above the table are population counts
          from their own query and these are not. Both numbers are true and they
          answer different questions, which is exactly the sort of thing that
          gets misread when nothing says so. */}
      <p className="mt-3 text-sm text-ink-3">
        These narrow the {rows.length} rows loaded here.
      </p>

      {shown.length === 0 ? (
        <p className="mt-10 text-base leading-relaxed text-ink-3">
          Nobody here matches that.
        </p>
      ) : (
        <>
          {/*
           * Two shapes, one row array.
           *
           * Below md the table is abandoned rather than scrolled: a 46rem table
           * inside a scroll container on a 375px phone means every column but
           * the first is off screen, and the reviewer is scrolling sideways to
           * read a number. Cards say the same things down the page.
           */}
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line md:hidden">
            {shown.map((row) => (
              <li key={row.enrolmentId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">
                      {row.name}
                    </p>
                    <p className="truncate text-sm text-ink-3">
                      {row.email}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-bold tabular-nums text-white">
                      {row.points}
                    </p>
                    <ExtraNote awards={row.awards} />
                  </div>
                </div>

                {row.handles.length > 0 && (
                  <ul className="mt-2 flex flex-wrap items-center gap-1.5">
                    {row.handles.map((h) => {
                      const [platform, handle] = h.split(":");
                      return (
                        <li key={h} className="flex items-center gap-1">
                          <Pill>
                            {platform} @{handle}
                          </Pill>
                          {canCorrectHandles && (
                            <button
                              type="button"
                              onClick={() =>
                                setFixing(
                                  fixing?.enrolmentId === row.enrolmentId &&
                                    fixing.platform === platform
                                    ? null
                                    : {
                                        enrolmentId: row.enrolmentId,
                                        platform,
                                        current: handle,
                                      },
                                )
                              }
                              aria-expanded={
                                fixing?.enrolmentId === row.enrolmentId &&
                                fixing.platform === platform
                              }
                              className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 text-xs font-semibold text-ink-4 transition-colors hover:text-white"
                            >
                              fix
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}



                <p className="mt-2 text-sm text-ink-3">
                  {row.submitted} sent · {row.approved} approved · joined{" "}
                  {new Date(row.joinedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Africa/Lagos",
                  })}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setAwarding(
                        awarding === row.enrolmentId ? null : row.enrolmentId,
                      )
                    }
                    aria-expanded={awarding === row.enrolmentId}
                    aria-controls="award-panel"
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-card-2"
                  >
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    {awarding === row.enrolmentId ? "Close" : "Points"}
                  </button>
                  {/* Disqualification, which void_enrolment has enforced
                      since 0027 while being reachable by nobody: no route,
                      no control, psql only. A rule that cannot be invoked
                      is a rule the campaign does not have. Owner-only, and
                      two steps because it takes points back. */}
                  {canCorrectHandles && (
                    <button
                      type="button"
                      onClick={() =>
                        setVoiding(
                          voiding === row.enrolmentId ? null : row.enrolmentId,
                        )
                      }
                      aria-expanded={voiding === row.enrolmentId}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-2 px-4 text-sm font-semibold text-ink-3 transition-colors hover:border-red-400/50 hover:text-red-200"
                    >
                      Disqualify
                    </button>
                  )}
                  {!row.active && <Pill tone="bad">removed</Pill>}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-line bg-ground md:block">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <Th
                    onClick={() => sortBy("name")}
                    active={sort === "name"}
                    ascending={ascending}
                    sticky
                  >
                    Creator
                  </Th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Handles
                  </th>
                  <Th
                    onClick={() => sortBy("joinedAt")}
                    active={sort === "joinedAt"}
                    ascending={ascending}
                  >
                    Joined
                  </Th>
                  <Th
                    onClick={() => sortBy("submitted")}
                    active={sort === "submitted"}
                    ascending={ascending}
                    numeric
                  >
                    Sent
                  </Th>
                  <Th
                    onClick={() => sortBy("approved")}
                    active={sort === "approved"}
                    ascending={ascending}
                    numeric
                  >
                    Approved
                  </Th>
                  <Th
                    onClick={() => sortBy("points")}
                    active={sort === "points"}
                    ascending={ascending}
                    numeric
                  >
                    Points
                  </Th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Award
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr
                    key={row.enrolmentId}
                    className="border-b border-line last:border-0"
                  >
                    {/* Pinned. Scrolling right to reach the points column used
                        to leave an unlabelled row under the cursor, which is
                        how points get awarded to the wrong person. */}
                    <td className="sticky left-0 z-10 bg-ground px-4 py-3 align-top after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-white/12">
                      <span className="block font-semibold text-white">
                        {row.name}
                      </span>
                      <span className="block text-sm text-ink-3">
                        {row.email}
                      </span>
                      {!row.active && (
                        <span className="mt-1 inline-block">
                          <Pill tone="bad">removed</Pill>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-ink-3">
                      {row.handles.length === 0 ? (
                        <span className="text-red-300">none</span>
                      ) : (
                        row.handles.map((h) => {
                          const [platform, handle] = h.split(":");
                          return (
                            <span key={h} className="block font-mono text-xs">
                              <span className="text-ink-3">{platform}</span>{" "}
                              @{handle}
                              {/* The same control the card list has had all
                                  along. Correcting a handle existed only
                                  below 768px, so on a laptop the capability
                                  did not exist and nothing said so. */}
                              {canCorrectHandles && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFixing(
                                      fixing?.enrolmentId === row.enrolmentId &&
                                        fixing.platform === platform
                                        ? null
                                        : {
                                            enrolmentId: row.enrolmentId,
                                            platform,
                                            current: handle,
                                          },
                                    )
                                  }
                                  aria-expanded={
                                    fixing?.enrolmentId === row.enrolmentId &&
                                    fixing.platform === platform
                                  }
                                  className="ml-1 inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 font-sans text-xs font-semibold text-ink-4 transition-colors hover:text-white"
                                >
                                  fix
                                </button>
                              )}
                            </span>
                          );
                        })
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-ink-3">
                      {new Date(row.joinedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Africa/Lagos",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-ink-2">
                      {row.submitted}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-ink-2">
                      {row.approved}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-semibold tabular-nums text-white">
                      {row.points}
                      <ExtraNote awards={row.awards} />
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <button
                        type="button"
                        onClick={() =>
                          setAwarding(
                            awarding === row.enrolmentId
                              ? null
                              : row.enrolmentId,
                          )
                        }
                        aria-expanded={awarding === row.enrolmentId}
                        aria-controls="award-panel"
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-card-2"
                      >
                        <Coins className="h-4 w-4" aria-hidden="true" />
                        {awarding === row.enrolmentId ? "Close" : "Points"}
                      </button>
                      {/* Disqualifying was reachable only in the card list,
                          so above 768px /api/admin/void had no caller at
                          all: an owner on a laptop would have had to narrow
                          the window to find it, which nobody would guess.
                          Quiet, and far from Points, because it is the
                          destructive one. */}
                      {canCorrectHandles && row.active && (
                        <button
                          type="button"
                          onClick={() =>
                            setVoiding(
                              voiding === row.enrolmentId
                                ? null
                                : row.enrolmentId,
                            )
                          }
                          aria-expanded={voiding === row.enrolmentId}
                          className="ml-2 inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-red-300/80 transition-colors hover:text-red-300"
                        >
                          {voiding === row.enrolmentId
                            ? "Close"
                            : "Disqualify"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {matching.length > visible ? (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
            >
              Show more ({matching.length - visible} more)
            </button>
          ) : (
            <p className="mt-3 text-sm text-ink-4">
              Showing all {matching.length} who match.
            </p>
          )}
        </>
      )}

      {/*
       * The award form, out of the table entirely.
       *
       * It lived in a colSpan cell inside the horizontal scroll container, so
       * the form was at least 736px wide and its Apply button was off screen to
       * the right on every phone: the one control that moves points could not
       * be reached on the device an admin is most likely holding. One instance,
       * below the list, for whichever creator is selected.
       */}
      {/*
        * Rendered once, after the list, rather than inside each card.
        *
        * They used to live in the per-row card markup, which is md:hidden,
        * so the controls existed only below 768px. Adding the buttons to
        * the desktop table would have set the state and shown nothing.
        * This is the shape the award panel already uses, and one panel
        * serves both layouts.
        */}
                {voidingRow && (
                  <div className="mt-3 rounded-lg border border-red-400/40 bg-red-400/5 p-4">
                    <p className="max-w-prose text-sm leading-relaxed text-ink-2">
                      Their entries stop being accepted, the points those
                      entries earned are reversed, and referral payouts they
                      triggered are clawed back. This is recorded against your
                      name.
                    </p>
                    <label
                      htmlFor={`void-why-${voidingRow.enrolmentId}`}
                      className="mt-3 block text-sm font-semibold text-white"
                    >
                      Why
                    </label>
                    <input
                      id={`void-why-${voidingRow.enrolmentId}`}
                      value={voidReason}
                      onChange={(event) => setVoidReason(event.target.value)}
                      maxLength={300}
                      placeholder="Bought engagement on two entries, evidence in the thread"
                      className={`${control} mt-1`}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => voidEnrolment(voidingRow.enrolmentId, voidingRow.name)}
                        className={buttonClass("dangerFill")}
                      >
                        {busy ? "Working…" : `Disqualify ${voidingRow.name}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVoiding(null);
                          setVoidReason("");
                        }}
                        className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-3 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {fixing && (
                  <CorrectHandle
                    key={`${fixing.enrolmentId}-${fixing.platform}`}
                    enrolmentId={fixing.enrolmentId}
                    platform={fixing.platform}
                    current={fixing.current}
                    onDone={() => setFixing(null)}
                  />
                )}

      <div ref={awardRef} id="award-panel">
        {selected && (
          <div className="mt-8 border-t border-line-2 pt-6">
            <SectionHeading label="Points" title={selected.name} />
            <AwardRow
              /*
               * Keyed on the creator, so the points and the note do not carry
               * over when the panel is reopened for somebody else. Without it a
               * reviewer who closes one and opens another is looking at the
               * previous person's figures in a form that will award them.
               */
              key={selected.enrolmentId}
              name={selected.name}
              entries={selected.entries}
              awards={selected.awards}
              busy={busy}
              onSubmit={(source, points, note, entryId) =>
                submitAward(selected.enrolmentId, source, points, note, entryId)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * How much of a total is extra points, under the total itself.
 *
 * The total moved when a bonus was given, but it never said what it was made
 * of, so "have I already given them something" had no answer on the screen.
 * Net of take-backs, because that is what the total actually contains.
 */
function ExtraNote({ awards }: { awards: AwardRecord[] }) {
  if (awards.length === 0) return null;
  const net = extraPoints(awards);
  return (
    <span className="block text-xs font-normal text-brand-gold">
      {net === 0
        ? "extra given and taken back"
        : `incl. ${net > 0 ? "+" : "−"}${Math.abs(net)} extra`}
    </span>
  );
}

/** A sortable heading. aria-sort so the state is not colour alone. */
function Th({
  children,
  onClick,
  active,
  ascending,
  numeric = false,
  /** Pins the column while the table scrolls sideways. */
  sticky = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  ascending: boolean;
  numeric?: boolean;
  sticky?: boolean;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
      className={`${sticky ? "sticky left-0 z-10 bg-ground" : ""} ${
        numeric ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-h-11 w-full cursor-pointer items-center gap-1 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-white ${
          numeric ? "justify-end" : "justify-start"
        } ${active ? "text-brand-gold" : "text-ink-3"}`}
      >
        {children}
        <span aria-hidden="true" className="text-[0.65rem]">
          {active ? (ascending ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

/**
 * Award or take back points for one creator.
 *
 * The note is required and says so, because it is what a dispute is answered
 * with and because the database refuses an award without one. Negative numbers
 * are allowed and explained: the ledger is append-only, so taking a bonus back
 * is a signed row rather than an edit and the original decision stays visible.
 *
 * Every ceiling is enforced in the database, not here. This form can be wrong
 * about a limit and the award is still refused, which is the right way round.
 */
function AwardRow({
  name,
  entries,
  awards,
  busy,
  onSubmit,
}: {
  name: string;
  entries: { id: string; weekNo: number }[];
  awards: AwardRecord[];
  busy: boolean;
  onSubmit: (
    source: string,
    points: number,
    note: string,
    entryId?: string,
  ) => void;
}) {
  const [source, setSource] = useState<string>(AWARD_SOURCES[0].key);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [entryId, setEntryId] = useState("");

  const value = Number.parseInt(points, 10);

  /*
   * What this creator already has from the kind of award being chosen.
   *
   * Engagement is counted per entry, because that is the rule: one bonus per
   * entry, and a second entry earning its own is not a repeat. Everything else
   * is counted per kind. Net of take-backs, so a bonus given and then taken
   * back does not read as one still standing.
   */
  const sameKind = awards.filter(
    (a) =>
      a.source === source &&
      (source !== "engagement_milestone" || a.entryId === entryId),
  );
  const standing = extraPoints(sameKind);
  const entryNet = (id: string) =>
    extraPoints(
      awards.filter(
        (a) => a.source === "engagement_milestone" && a.entryId === id,
      ),
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-3">
        Points for <span className="font-semibold text-white">{name}</span>. A
        negative number takes points back, and leaves the original award in the
        ledger.
      </p>

      {/* Everything already given, before the form rather than after it, so
          it is read before a number is typed. The question this answers is
          "have I already given them this", which used to have no answer on
          the screen at all. */}
      {awards.length === 0 ? (
        <p className="text-sm text-ink-4">No extra points given yet.</p>
      ) : (
        <div>
          <p className="text-sm font-semibold text-white">
            Already given ({extraPoints(awards) >= 0 ? "+" : "−"}
            {Math.abs(extraPoints(awards))} net)
          </p>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {awards.map((a, i) => (
              <li key={`${a.atLabel}-${i}`} className="px-3 py-2 text-sm">
                <span
                  className={`font-semibold tabular-nums ${
                    a.points > 0 ? "text-green-300" : "text-red-300"
                  }`}
                >
                  {a.points > 0 ? "+" : "−"}
                  {Math.abs(a.points)}
                </span>{" "}
                <span className="text-white">{sourceLabel(a.source)}</span>
                {a.weekNo !== null && (
                  <span className="text-ink-3"> · week {a.weekNo} entry</span>
                )}
                <span className="block text-ink-3">
                  {a.atLabel} · {a.by ?? "admin no longer listed"}
                </span>
                {a.note && (
                  <span className="block break-words text-ink-2">{a.note}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Said before Apply, not after. A second quality bonus for the same
          post looks exactly like a quality bonus for a new one once it is in
          the total, so this is the last point it can be caught. It warns
          rather than blocks: two bonuses of one kind for two pieces of work
          are legitimate, and only the person awarding knows which this is. */}
      {sameKind.length > 0 && standing > 0 && (
        <p
          role="status"
          className="rounded-lg border border-brand-gold/40 bg-brand-gold/5 p-3 text-sm leading-relaxed text-ink-2"
        >
          {source === "engagement_milestone"
            ? `This entry already has an engagement bonus of +${standing}. One bonus per entry: take that one back first if the tier changed.`
            : `${name} already has +${standing} from ${sourceLabel(source)}. Check this is for different work before giving it again.`}
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row">
        <label htmlFor="award-source" className="sr-only">
          What kind of award
        </label>
        <select
          id="award-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={`${selectControl} lg:max-w-56`}
        >
          {AWARD_SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <label htmlFor="award-points" className="sr-only">
          How many points
        </label>
        <input
          id="award-points"
          value={points}
          onChange={(e) => setPoints(e.target.value.replace(/[^0-9-]/g, ""))}
          inputMode="numeric"
          placeholder="Points, or -points"
          className="min-h-12 rounded-lg border border-line bg-control px-4 text-base text-white placeholder:text-ink-3 lg:w-44"
        />

        <label htmlFor="award-note" className="sr-only">
          Why, required
        </label>
        <input
          id="award-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Why. Required, and kept against the award."
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-control px-4 text-base text-white placeholder:text-ink-3"
        />

        <button
          type="button"
          disabled={
            busy ||
            !note.trim() ||
            !Number.isFinite(value) ||
            value === 0 ||
            (source === "engagement_milestone" && !entryId)
          }
          onClick={() => onSubmit(source, value, note, entryId || undefined)}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-black transition-colors duration-150 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Working..." : "Apply"}
        </button>
      </div>
      {/* The published ladder, where the person choosing the number needs
          it. Awards outside these figures are refused by the rule bounds
          anyway; showing the ladder saves the round trip. */}
      {source === "engagement_milestone" && (
        <>
          <label htmlFor="award-entry" className="sr-only">
            Which entry reached the milestone
          </label>
          {/* The bonus attaches to the entry that earned the views; the
              database refuses one without it, and one per entry. */}
          <select
            id="award-entry"
            value={entryId}
            onChange={(e) => setEntryId(e.target.value)}
            className={`${selectControl} mt-2 lg:max-w-56`}
          >
            <option value="">Which entry reached it...</option>
            {entries.map((entry) => {
              const has = entryNet(entry.id);
              return (
                <option key={entry.id} value={entry.id}>
                  Week {entry.weekNo} entry
                  {has > 0 ? ` (has +${has} already)` : ""}
                </option>
              );
            })}
          </select>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            The published ladder: 5K views 20 · 10K 40 · 20K 60 · 30K 80 ·
            50K 100 · 75K 150 · 100K 200. One bonus per entry, highest tier
            verifiably reached.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * The inline correction form.
 *
 * This is the tool behind the sentence a creator reads when their submission is
 * refused for a handle mismatch: "write to partnership@blockfestafrica.com and
 * we will correct it." Before this, "we will correct it" meant a manual UPDATE
 * against production, with handle_normalized forgotten as the likely failure.
 *
 * The reason is required, the same as taking points away, because with
 * verification gone the registered handle IS the attribution and every change
 * of it should be answerable afterwards.
 */
function CorrectHandle({
  enrolmentId,
  platform,
  current,
  onDone,
}: {
  enrolmentId: string;
  platform: string;
  current: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [handle, setHandle] = useState(current);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!handle.trim() || handle.trim().replace(/^@+/, "") === current) {
      toast.error("Enter the corrected username.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Say why. It is what a dispute is answered with.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/correct-handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrolmentId,
          platform,
          handle: handle.trim(),
          reason: reason.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      toast.success(`${platform} handle corrected: @${result.from} is now @${result.to}`);
      onDone();
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-line-2 bg-card p-4">
      <p className="text-sm font-semibold text-white">
        Correct the {platform} handle
      </p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
        Currently @{current}. Their next submission is checked against whatever
        you save here, so make sure it is the account they actually publish
        from.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <label htmlFor={`fix-${enrolmentId}-${platform}`} className="sr-only">
          Corrected username
        </label>
        <input
          id={`fix-${enrolmentId}-${platform}`}
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="the-right-username"
          className="min-h-11 w-full rounded-lg border border-line-2 bg-control px-4 text-base text-white placeholder:text-ink-3"
        />
        <label htmlFor={`fix-why-${enrolmentId}-${platform}`} className="sr-only">
          Why it is being corrected
        </label>
        <input
          id={`fix-why-${enrolmentId}-${platform}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          placeholder="Why: they wrote in from their registered email…"
          className="min-h-11 w-full rounded-lg border border-line-2 bg-control px-4 text-base text-white placeholder:text-ink-3"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-brand-gold px-5 text-sm font-semibold text-black transition-colors hover:bg-brand-gold-hover disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save the correction"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold text-ink-2 transition-colors hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
