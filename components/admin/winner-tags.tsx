"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { buttonClass } from "@/components/shared/panel";
import { naira } from "@/lib/format";
import { WINNER_CATEGORY_LABEL, type WinnerCategory } from "@/lib/winner-categories";

export interface WinnerTagRow {
  weekNo: number;
  category: WinnerCategory;
  name: string;
  /** Null when they registered before the form asked for it. */
  monicaTag: string | null;
  email: string;
  prizeNaira: number;
}

/** A cell never carries a tab or a line break into the pasted table. */
const cell = (value: string) => value.replace(/[\t\r\n]+/g, " ").trim();

/**
 * The list as text, for a spreadsheet or a message: tab-separated, a header
 * row first, so a paste into a sheet lands in columns. The prize is digits,
 * so the sheet can add it up.
 */
export function winnersAsTable(rows: WinnerTagRow[]): string {
  const lines = [["Week", "Award", "Name", "Monica tag", "Prize (NGN)"]];
  for (const row of rows) {
    lines.push([
      String(row.weekNo),
      WINNER_CATEGORY_LABEL[row.category],
      cell(row.name),
      row.monicaTag ? cell(row.monicaTag) : "(no tag)",
      String(row.prizeNaira),
    ]);
  }
  return lines.map((line) => line.join("\t")).join("\n");
}

/**
 * Every announced winner of both awards, with the Monica tag their prize is
 * paid to, for the owner to copy.
 *
 * The ballot's anatomy: one card, its header saying where it stands once
 * (how many wins, how much), a group row per week, and a row per win leading
 * with the name. The tag sits at the row's right hand with Copy, selectable
 * as a whole for when the clipboard is refused. A win with no tag is the one
 * thing that needs the owner, so it is the one row with an edge: amber, with
 * the address to ask.
 */
export function WinnerTags({ winners }: { winners: WinnerTagRow[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(done);
      setTimeout(() => setCopied((now) => (now === key ? null : now)), 2000);
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  const weeks = [...new Set(winners.map((w) => w.weekNo))];
  const missing = winners.filter((w) => !w.monicaTag).length;
  const total = winners.reduce((sum, w) => sum + w.prizeNaira, 0);

  return (
    <section
      id="winners-so-far"
      aria-labelledby="winners-so-far-title"
      className="overflow-hidden rounded-xl border border-line-2 bg-card"
    >
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 id="winners-so-far-title" className="text-xl font-bold text-white">
            Every winner so far
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            {winners.length === 0
              ? "Nobody has been announced yet."
              : `${winners.length} ${winners.length === 1 ? "win" : "wins"}, ${naira(total)} in prizes, each paid to the Monica tag the winner registered with.`}
            {missing > 0 &&
              ` ${missing === 1 ? "One has" : `${missing} have`} no tag yet.`}
          </p>
        </div>
        {winners.length > 0 && (
          <button
            type="button"
            onClick={() =>
              copy(
                winnersAsTable(winners),
                "all",
                `Copied ${winners.length} ${winners.length === 1 ? "winner" : "winners"}`,
              )
            }
            aria-label="Copy every winner as a table, for a spreadsheet"
            className={buttonClass("secondary", "min-w-24 self-start sm:self-auto")}
          >
            {copied === "all" ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied === "all" ? "Copied" : "Copy all"}
          </button>
        )}
      </div>

      {winners.length === 0 ? (
        <p className="px-4 py-4 text-sm leading-relaxed text-ink-3 sm:px-5">
          Each Creator of the Week and Community Favourite appears here with their Monica tag once announced.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {weeks.map((week) => (
            <div key={week} role="group" aria-labelledby={`winners-week-${week}`}>
              {/* The same 2px edge as its rows, unseen, so the week lines up
                  with the names under it. */}
              <h3
                id={`winners-week-${week}`}
                className="border-l-2 border-l-transparent px-4 pb-2 pt-4 text-sm font-semibold text-ink-3 sm:px-5"
              >
                Week {week}
              </h3>
              <ul className="divide-y divide-line">
                {winners
                  .filter((w) => w.weekNo === week)
                  .map((w) => {
                    const key = `${w.weekNo}-${w.category}`;
                    const label = WINNER_CATEGORY_LABEL[w.category];
                    return (
                      <li
                        key={key}
                        className={`flex flex-col gap-3 border-l-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5 ${
                          w.monicaTag ? "border-l-transparent" : "border-l-amber-400"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white [overflow-wrap:anywhere]">{w.name}</p>
                          <p className="mt-0.5 text-sm text-ink-3">
                            {label} · {naira(w.prizeNaira)}
                          </p>
                          {!w.monicaTag && (
                            <p className="mt-1 text-sm text-amber-300">
                              No Monica tag on their registration. Ask them at{" "}
                              <a
                                href={`mailto:${w.email}`}
                                className="text-link underline underline-offset-4 [overflow-wrap:anywhere]"
                              >
                                {w.email}
                              </a>
                              .
                            </p>
                          )}
                        </div>
                        {w.monicaTag && (
                          <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                            <span className="min-w-0 select-all font-semibold text-white [overflow-wrap:anywhere]">
                              {w.monicaTag}
                            </span>
                            <button
                              type="button"
                              onClick={() => copy(w.monicaTag!, key, `Copied ${w.monicaTag}`)}
                              aria-label={`Copy ${w.name}'s Monica tag, ${w.monicaTag} (week ${w.weekNo} ${label})`}
                              className={buttonClass("secondary", "min-w-24 shrink-0")}
                            >
                              {copied === key ? (
                                <Check className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Copy className="h-4 w-4" aria-hidden="true" />
                              )}
                              {copied === key ? "Copied" : "Copy"}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
