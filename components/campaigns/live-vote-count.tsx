"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Lock } from "lucide-react";
import { clockTime, count } from "@/lib/format";
import {
  boardState,
  rankBoard,
  readBoard,
  REFRESH_MINUTES,
  REFRESH_MS,
  type VoteBoard,
} from "@/lib/vote-board";

const COUNT_URL = "/api/campaigns/monica/vote/count";

/**
 * The Community Favourite count, under the ballot.
 *
 * Asks once on load and then every five minutes, and only while the tab is
 * showing: a phone left open on this page overnight asks nothing. The route
 * keeps each answer at the edge for the same five minutes, so every open page
 * shares one database read, and the time shown is when that read happened,
 * so a five minute old count never passes for a live one. A refresh button
 * would be a lie on top of that cache: it would fetch the same answer.
 *
 * Renders nothing until it has a count, and nothing before voting opens,
 * when every row would be a zero. Once the vote ends it stays up, marked
 * closed, and then final when the Community Favourite is published, so the
 * count people watched does not disappear the moment it matters most.
 *
 * A failed refresh keeps the last count and its time rather than blanking
 * the board.
 */
export function LiveVoteCount() {
  const [board, setBoard] = useState<VoteBoard | null>(null);
  const [now, setNow] = useState(0);
  const final = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let lastAsked = 0;

    const load = () => {
      lastAsked = Date.now();
      fetch(COUNT_URL)
        .then((response) => response.json())
        .then((body) => {
          if (cancelled) return;
          setNow(Date.now());
          const next = readBoard(body);
          if (!next) return;
          final.current = next.final;
          // Never step backwards: an older copy from the edge must not
          // replace a newer count already on screen.
          setBoard((shown) =>
            shown && Date.parse(shown.asOf) > Date.parse(next.asOf) ? shown : next,
          );
        })
        .catch(() => {
          // The last count stays up with its own time.
        });
    };

    load();
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!final.current && document.visibilityState === "visible") load();
    }, REFRESH_MS);
    // Back to a tab that was hidden past a refresh: ask now rather than
    // showing a stale count until the next tick.
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      if (!final.current && Date.now() - lastAsked >= REFRESH_MS) load();
    };
    document.addEventListener("visibilitychange", onShow);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  if (!board || board.nominees.length === 0) return null;
  const state = boardState(board, now);
  if (state === "before") return null;

  const { rows, total, levelAtTop } = rankBoard(board.nominees);

  return (
    <section
      aria-labelledby="vote-count-title"
      className="mt-8 rounded-xl border border-line bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3
          id="vote-count-title"
          className="flex items-center gap-2.5 text-base font-semibold text-white"
        >
          {state === "open" ? (
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
          ) : state === "final" ? (
            <CircleCheck className="h-4 w-4 text-brand-gold" aria-hidden="true" />
          ) : (
            <Lock className="h-4 w-4 text-ink-3" aria-hidden="true" />
          )}
          {state === "open" ? "Live count" : state === "final" ? "Final count" : "Voting closed"}
        </h3>
        <p className="text-sm tabular-nums text-ink-3">
          {count(total)} {total === 1 ? "vote" : "votes"}
        </p>
      </div>
      {state === "closed" && (
        <p className="mt-1 text-sm text-ink-3">
          Week {board.weekNo}. The votes are reviewed before the Community
          Favourite is confirmed.
        </p>
      )}
      {state === "final" && (
        <p className="mt-1 text-sm text-ink-3">
          Week {board.weekNo}. The Community Favourite is listed under Weekly
          winners above.
        </p>
      )}

      <ol className="mt-5 flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.nomineeId}>
            <div className="flex items-baseline gap-3">
              <span
                className="w-5 shrink-0 text-sm font-semibold tabular-nums text-ink-4"
                aria-hidden="true"
              >
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-white">
                {row.name}
                {row.leading && <span className="sr-only">, in the lead</span>}
              </span>
              <span className="shrink-0 text-sm tabular-nums">
                <span className="font-semibold text-white">{count(row.votes)}</span>
                <span className="sr-only">
                  {row.votes === 1 ? " vote," : " votes,"}
                </span>
                <span className="ml-2 text-ink-4">{row.share}%</span>
              </span>
            </div>
            {/* The bar is each nominee's share of all counted votes, the
                same figure printed beside it. Gold only for a nominee
                strictly ahead: nobody leads a tie. */}
            <div
              aria-hidden="true"
              className="ml-8 mt-2 h-1.5 overflow-hidden rounded-full bg-card-3"
            >
              <div
                className={`h-full rounded-full ${row.leading ? "bg-brand-gold" : "bg-ink-4"}`}
                style={{ width: `${row.share}%` }}
              />
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-col gap-1 border-t border-line pt-4 text-sm leading-relaxed">
        {state !== "final" && (
          <p className="text-ink-3">
            Updated <time dateTime={board.asOf}>{clockTime(board.asOf)}</time>,
            Lagos time. Refreshes every {REFRESH_MINUTES} minutes.
          </p>
        )}
        {levelAtTop && (
          <p className="text-ink-3">
            Level at the top. A tie goes to whoever has more points in that
            week&apos;s recorded standings.
          </p>
        )}
        <p className="text-ink-4">
          {state === "final"
            ? "Verified votes, after review."
            : "Only verified votes count. Votes set aside in review come off before the winner is confirmed."}
        </p>
      </div>
    </section>
  );
}
