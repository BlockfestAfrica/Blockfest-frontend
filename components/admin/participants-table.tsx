"use client";

import { useMemo, useState } from "react";
import { Coins, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/shared/panel";

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

export interface ParticipantRow {
  enrolmentId: string;
  name: string;
  email: string;
  joinedAt: string;
  handles: string[];
  submitted: number;
  approved: number;
  points: number;
  active: boolean;
}

type SortKey = "name" | "joinedAt" | "submitted" | "approved" | "points";
type Filter = "all" | "submitted" | "silent" | "approved";

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
export function ParticipantsTable({ rows }: { rows: ParticipantRow[] }) {
  const router = useRouter();
  /** Which row has the award panel open. One at a time, on purpose. */
  const [awarding, setAwarding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("joinedAt");
  const [ascending, setAscending] = useState(false);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      if (filter === "submitted" && row.submitted === 0) return false;
      if (filter === "silent" && row.submitted > 0) return false;
      if (filter === "approved" && row.approved === 0) return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        row.handles.some((h) => h.toLowerCase().includes(needle))
      );
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
  }, [rows, filter, search, sort, ascending]);

  async function submitAward(
    enrolmentId: string,
    source: string,
    points: number,
    note: string,
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
        body: JSON.stringify({ enrolmentId, source, points, note: note.trim() }),
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

  function sortBy(key: SortKey) {
    if (key === sort) {
      setAscending((a) => !a);
      return;
    }
    setSort(key);
    // Names read naturally A to Z; numbers and dates are almost always wanted
    // largest or newest first.
    setAscending(key === "name");
  }

  const counts = {
    all: rows.length,
    submitted: rows.filter((r) => r.submitted > 0).length,
    silent: rows.filter((r) => r.submitted === 0).length,
    approved: rows.filter((r) => r.approved > 0).length,
  };

  const FILTERS: Array<{ key: Filter; label: string }> = [
    { key: "all", label: `Everyone (${counts.all})` },
    { key: "submitted", label: `Submitted (${counts.submitted})` },
    { key: "silent", label: `Never submitted (${counts.silent})` },
    { key: "approved", label: `Has an approval (${counts.approved})` },
  ];

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                filter === f.key
                  ? "border-brand-gold/50 bg-brand-gold/10 text-brand-gold"
                  : "border-white/15 text-white/60 hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
            aria-hidden="true"
          />
          <label htmlFor="participant-search" className="sr-only">
            Search by name, email or handle
          </label>
          <input
            id="participant-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email or handle"
            className="min-h-11 w-full rounded-full border border-white/15 bg-white/[0.03] pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:border-brand-gold focus:outline-none"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-base leading-relaxed text-white/50">
          Nobody matches that.
        </p>
      ) : (
        /*
         * Scrolls inside its own container.
         *
         * html and body set overflow-x: hidden site-wide, so a table wider than
         * the screen would be clipped with no scrollbar and no sign that
         * anything was missing. This keeps the overflow local, where it can
         * actually be scrolled.
         */
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/12">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/12">
                <Th onClick={() => sortBy("name")} active={sort === "name"} ascending={ascending}>
                  Creator
                </Th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Handles
                </th>
                <Th onClick={() => sortBy("joinedAt")} active={sort === "joinedAt"} ascending={ascending}>
                  Joined
                </Th>
                <Th onClick={() => sortBy("submitted")} active={sort === "submitted"} ascending={ascending} numeric>
                  Sent
                </Th>
                <Th onClick={() => sortBy("approved")} active={sort === "approved"} ascending={ascending} numeric>
                  Approved
                </Th>
                <Th onClick={() => sortBy("points")} active={sort === "points"} ascending={ascending} numeric>
                  Points
                </Th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/40">
                  Award
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.flatMap((row) => [
                <tr
                  key={row.enrolmentId}
                  className="border-b border-white/[0.06] last:border-0"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="block font-semibold text-white">
                      {row.name}
                    </span>
                    <span className="block text-sm text-white/40">
                      {row.email}
                    </span>
                    {!row.active && (
                      <span className="mt-1 inline-block">
                        <Pill tone="bad">removed</Pill>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-white/55">
                    {row.handles.length === 0 ? (
                      <span className="text-red-300">none</span>
                    ) : (
                      row.handles.map((h) => {
                        const [platform, handle] = h.split(":");
                        return (
                          <span key={h} className="block font-mono text-xs">
                            <span className="text-white/35">{platform}</span>{" "}
                            @{handle}
                          </span>
                        );
                      })
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-white/55">
                    {new Date(row.joinedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Africa/Lagos",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-white/70">
                    {row.submitted}
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-white/70">
                    {row.approved}
                  </td>
                  <td className="px-4 py-3 text-right align-top font-semibold tabular-nums text-white">
                    {row.points}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <button
                      type="button"
                      onClick={() =>
                        setAwarding(
                          awarding === row.enrolmentId ? null : row.enrolmentId,
                        )
                      }
                      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5"
                    >
                      <Coins className="h-4 w-4" aria-hidden="true" />
                      {awarding === row.enrolmentId ? "Close" : "Points"}
                    </button>
                  </td>
                </tr>,
                awarding === row.enrolmentId ? (
                  <tr key={`${row.enrolmentId}-award`} className="bg-white/[0.03]">
                    <td colSpan={7} className="px-4 py-5">
                      <AwardRow
                        name={row.name}
                        busy={busy}
                        onSubmit={(source, points, note) =>
                          submitAward(row.enrolmentId, source, points, note)
                        }
                      />
                    </td>
                  </tr>
                ) : null,
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** A sortable heading. aria-sort so the state is not colour alone. */
function Th({
  children,
  onClick,
  active,
  ascending,
  numeric = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  ascending: boolean;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
      className={numeric ? "text-right" : "text-left"}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-h-11 w-full cursor-pointer items-center gap-1 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-white ${
          numeric ? "justify-end" : "justify-start"
        } ${active ? "text-brand-gold" : "text-white/40"}`}
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
  busy,
  onSubmit,
}: {
  name: string;
  busy: boolean;
  onSubmit: (source: string, points: number, note: string) => void;
}) {
  const [source, setSource] = useState<string>(AWARD_SOURCES[0].key);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");

  const value = Number.parseInt(points, 10);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-white/55">
        Points for <span className="font-semibold text-white">{name}</span>. A
        negative number takes points back, and leaves the original award in the
        ledger.
      </p>

      <div className="flex flex-col gap-3 lg:flex-row">
        <label htmlFor="award-source" className="sr-only">
          What kind of award
        </label>
        <select
          id="award-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="min-h-12 cursor-pointer rounded-lg border border-white/12 bg-ground px-4 text-base text-white focus:border-brand-gold focus:outline-none lg:w-56"
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
          className="min-h-12 rounded-lg border border-white/12 bg-white/[0.03] px-4 text-base text-white placeholder:text-white/30 focus:border-brand-gold focus:outline-none lg:w-44"
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
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-4 text-base text-white placeholder:text-white/30 focus:border-brand-gold focus:outline-none"
        />

        <button
          type="button"
          disabled={busy || !note.trim() || !Number.isFinite(value) || value === 0}
          onClick={() => onSubmit(source, value, note)}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Working..." : "Apply"}
        </button>
      </div>
    </div>
  );
}
