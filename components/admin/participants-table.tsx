"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Pill } from "@/components/shared/panel";

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
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
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
                </tr>
              ))}
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
