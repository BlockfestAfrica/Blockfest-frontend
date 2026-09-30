"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Lock } from "lucide-react";
import { monicaRoutes } from "@/lib/campaigns";
import { IntegrityTicker } from "@/components/campaigns/integrity-ticker";
import { CountRows } from "@/components/campaigns/count-rows";
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

/** setTimeout's ceiling; a boundary further out waits for a later tick. */
const LONGEST_WAIT = 2 ** 31 - 1;

/**
 * The Community Favourite count, under the ballot.
 *
 * Asks once on load and then every five minutes, and only while the tab is
 * showing: a phone left open on this page overnight asks nothing. The route
 * keeps each answer at the edge for a little under that, so every open page
 * shares one database read and each ask finds a fresh one, and the time shown
 * is when that read happened, so an old count never passes for a live one. A
 * refresh button would be a lie on top of that cache: it would fetch the
 * same answer.
 *
 * Renders nothing until it has a count, and nothing before voting opens,
 * when every row would be a zero. Once the vote ends it stays up, marked
 * closed, while the votes are reviewed.
 *
 * Once the Community Favourite is published the count is final, and the
 * page already shows it with that week under "Winners so far". Drawing it
 * here as well said the same numbers twice, one under the other, so a
 * visitor who loads the page after publication sees it only there. One who
 * was watching when it went final keeps it, marked final, with a pointer to
 * reload: their copy of the page was rendered before the winner was in it.
 *
 * A failed refresh keeps the last count and its time rather than blanking
 * the board.
 */
export function LiveVoteCount() {
  const [board, setBoard] = useState<VoteBoard | null>(null);
  const [now, setNow] = useState(0);
  /* Whether this visit watched the vote before it went final. The rest of
     the page was rendered when it loaded, so the winner the final note
     points at is only on it after a reload. */
  const [sawLive, setSawLive] = useState(false);
  const shown = useRef<VoteBoard | null>(null);

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
          if (!next) {
            // A good answer with no round in it clears the board; anything
            // else is a failure, and the last count stays up with its time.
            if (body?.ok === true && body.board === null) {
              shown.current = null;
              setBoard(null);
            }
            return;
          }
          // Never step backwards: an older copy from the edge must not
          // replace a newer count already on screen.
          const current = shown.current;
          if (current && Date.parse(current.asOf) > Date.parse(next.asOf)) return;
          shown.current = next;
          if (!next.final) setSawLive(true);
          setBoard(next);
        })
        .catch(() => {
          // The last count stays up with its own time.
        });
    };

    load();
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!shown.current?.final && document.visibilityState === "visible") load();
    }, REFRESH_MS);
    // Back to a tab that was hidden past a refresh: ask now rather than
    // showing a stale count until the next tick.
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      if (!shown.current?.final && Date.now() - lastAsked >= REFRESH_MS) load();
    };
    document.addEventListener("visibilitychange", onShow);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  /* The open and the close land on the minute they happen, not on the next
     five minute tick: a board still pulsing "Live" four minutes after the
     close is the page contradicting the clock beside it. */
  useEffect(() => {
    if (!board) return;
    const at = Date.now();
    const next = [board.opensAt, board.closesAt]
      .map((value) => new Date(value).getTime())
      .filter((time) => !Number.isNaN(time) && time > at)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const wait = Math.min(next - at + 1_000, LONGEST_WAIT);
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [board, now]);

  if (!board || board.nominees.length === 0) return null;
  const state = boardState(board, now);
  if (state === "before") return null;
  if (state === "final" && !sawLive) return null;

  const { rows, total, levelAtTop } = rankBoard(board.nominees);

  return (
    <>
    {/* On top of the count, once votes in this round were removed as fraud:
        where the numbers dropped is where the reason belongs. */}
    {/* Spaced by the week group it sits in, right under the week it counts. */}
    {board.flagged && <IntegrityTicker />}
    <section
      aria-label="Community Favourite vote count"
      className={`${board.flagged ? "-mt-1" : ""} rounded-xl border border-line bg-card p-5 sm:p-6`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2.5 text-base font-semibold text-white">
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
          Week {board.weekNo} · {count(total)} {total === 1 ? "vote" : "votes"}
        </p>
      </div>
      {state === "closed" && (
        <p className="mt-1 text-sm text-ink-3">
          The votes are reviewed before the Community Favourite is confirmed.
        </p>
      )}
      {state === "final" && (
        <p className="mt-1 text-sm text-ink-3">
          The Community Favourite is confirmed.{" "}
          <a
            href={monicaRoutes.winners}
            className="text-link underline underline-offset-2 hover:text-white"
          >
            Reload the page
          </a>{" "}
          to see them under Winners so far.
        </p>
      )}

      <CountRows rows={rows} className="mt-5" />

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
        {/* Both ways, because review moves the count both ways: a vote held
            at the domain cap joins it when released, and a vote removed as
            manipulated leaves it. Codes also still confirm for fifteen
            minutes after the close. */}
        <p className="text-ink-4">
          {state === "final"
            ? "Verified votes, after review."
            : "Only verified votes count. Review can still add or set aside votes after voting closes, so the count may move until the winner is confirmed."}
        </p>
      </div>
    </section>
    </>
  );
}
