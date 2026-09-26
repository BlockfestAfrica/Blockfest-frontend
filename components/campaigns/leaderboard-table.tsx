"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { FaInstagram, FaTiktok, FaXTwitter } from "react-icons/fa6";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";
import type { LeaderboardBadge, LeaderboardRow } from "@/lib/leaderboard-row";
import { WINNER_CATEGORY_LABEL } from "@/lib/winner-categories";

type SortKey = "rank" | "name" | "points" | "stages";

/** Where the signed-in creator stands. Asked after load; see the route. */
const STANDING_URL = "/api/campaigns/monica/standing";

/**
 * The standings, sortable.
 *
 * The rank column always shows the rank the rules produce: total points, then
 * who reached that total first, then approved entries. Sorting reorders the
 * rows on screen and never renumbers them, because the number is the result and
 * the order is just a way of looking at it. Sorting by name and seeing somebody
 * become rank 1 would be a lie about who is winning.
 *
 * Done in the browser. The whole board arrives at once, it is capped at a
 * hundred rows, and a round trip per column click on a page people share would
 * make it feel broken.
 *
 * Four columns on a wide screen, three on a phone. Movement sits under the
 * rank, and the "you" mark, the platforms and any weekly prizes sit under the
 * name, rather than in columns of their own. On a phone the stages move under
 * the name too: the table used to hold a 30rem minimum and scroll sideways,
 * which put Points, the figure people came for, off the edge of the screen
 * behind a scroll nobody could see.
 */
/** Rows shown before the reader asks for more. */
const PAGE = 10;

export function LeaderboardTable({
  rows,
  movementSince,
  stageCount,
}: {
  rows: LeaderboardRow[];
  /** The stage movement is measured from, or null to show none. */
  movementSince: number | null;
  stageCount: number;
}) {
  const [sort, setSort] = useState<SortKey>("rank");
  const [ascending, setAscending] = useState(true);
  /*
   * Ten at a time, revealed rather than paged. The board holds up to a
   * hundred rows, and on the phones this campaign lives on that is a long
   * scroll past everything below the table. Reveal keeps the reader's
   * place; a page swap would lose it. Re-sorting resets the window because
   * the question changed.
   */
  const [visible, setVisible] = useState(PAGE);
  const [me, setMe] = useState<{ rank: number; name: string } | null>(null);

  /*
   * The page is one cached copy for everybody and never reads a cookie, so
   * who is looking is asked for here, after it loads. Anything other than a
   * clean answer marks nobody: this is a courtesy, and a board that fails to
   * say "you" is still a correct board.
   */
  useEffect(() => {
    let cancelled = false;
    fetch(STANDING_URL, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (cancelled || !body || typeof body !== "object") return;
        const found = (body as { me?: unknown }).me;
        if (!found || typeof found !== "object") return;
        const { rank, name } = found as { rank?: unknown; name?: unknown };
        if (Number.isInteger(rank) && typeof name === "string") {
          setMe({ rank: rank as number, name: name.trim() });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    const direction = ascending ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name) * direction;
      return (a[sort] - b[sort]) * direction;
    });
  }, [rows, sort, ascending]);
  const shown = sorted.slice(0, visible);

  /*
   * Rank AND name. Ranks are unique on a board, names are not; the board is
   * up to a minute old and the answer above is live. Only a row that agrees
   * on both is theirs.
   */
  const mine =
    me === null
      ? null
      : (rows.find((row) => row.rank === me.rank && row.name === me.name) ?? null);
  const mineOutOfView = mine !== null && !shown.includes(mine);

  function sortBy(key: SortKey) {
    setVisible(PAGE);
    if (key === sort) {
      setAscending((a) => !a);
      return;
    }
    setSort(key);
    // Rank and name read best ascending; points and stages best highest first.
    setAscending(key === "rank" || key === "name");
  }

  return (
    <>
      {/*
       * Scrolls inside its own container.
       *
       * html and body set overflow-x: hidden site-wide, so a table wider than a
       * phone would be clipped with no scrollbar and no sign anything was
       * missing. Keeping the overflow local means it can actually be scrolled.
       */}
      <div className="mt-10 overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-left sm:min-w-[30rem]">
          <caption className="sr-only">
            Campaign standings, sortable by rank, name, points or stages with an
            approved entry
          </caption>
          <thead>
            <tr className="border-b border-line">
              <Th onClick={() => sortBy("rank")} active={sort === "rank"} ascending={ascending} numeric>
                #
              </Th>
              <Th onClick={() => sortBy("name")} active={sort === "name"} ascending={ascending}>
                Creator
              </Th>
              <Th
                onClick={() => sortBy("stages")}
                active={sort === "stages"}
                ascending={ascending}
                numeric
                wideOnly
              >
                Stages
              </Th>
              <Th onClick={() => sortBy("points")} active={sort === "points"} ascending={ascending} numeric>
                Points
              </Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <Row
                key={`${row.rank}-${row.name}`}
                row={row}
                isMe={row === mine}
                movementSince={movementSince}
                stageCount={stageCount}
              />
            ))}
            {/* Their own row, kept in view below the ten on show rather than
                making them page through to find it. */}
            {mineOutOfView && mine && (
              <>
                <tr className="border-b border-line">
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-4 sm:px-4"
                  >
                    Your place
                  </td>
                </tr>
                <Row
                  row={mine}
                  isMe
                  movementSince={movementSince}
                  stageCount={stageCount}
                />
              </>
            )}
          </tbody>
        </table>
        {sorted.length > visible && (
          <div className="border-t border-line p-3">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
            >
              Show more ({sorted.length - visible} more)
            </button>
          </div>
        )}
      </div>

      {/* Signed in, with no row that is theirs on this copy of the board:
          either below the hundred shown, or ranked in the last minute. */}
      {me !== null && mine === null && (
        <p className="mt-3 text-sm text-ink-3">
          You are at <span className="font-semibold text-white">#{me.rank}</span>
          {me.rank > rows.length && rows.length >= 100
            ? `. This board shows the top ${rows.length}.`
            : ". This board catches up within a minute."}
        </p>
      )}
    </>
  );
}

function Row({
  row,
  isMe,
  movementSince,
  stageCount,
}: {
  row: LeaderboardRow;
  isMe: boolean;
  movementSince: number | null;
  stageCount: number;
}) {
  return (
    <tr
      aria-current={isMe ? "true" : undefined}
      className={`border-b border-line last:border-0 ${
        isMe ? "bg-brand-gold/[0.07] shadow-[inset_3px_0_0_var(--color-brand-gold)]" : ""
      }`}
    >
      <td className="w-14 px-3 py-4 text-right align-top tabular-nums sm:w-16 sm:px-4">
        <span
          className={`block text-lg font-bold ${
            row.rank <= 3 ? "text-brand-gold" : "text-ink-2"
          }`}
        >
          {row.rank}
        </span>
        {movementSince !== null && <Movement row={row} since={movementSince} />}
      </td>
      <td className="px-3 py-4 align-top sm:px-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`font-medium [overflow-wrap:anywhere] ${
              isMe ? "text-white" : "text-ink-2"
            }`}
          >
            {row.name}
          </span>
          {isMe && (
            <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-black">
              You
            </span>
          )}
        </div>
        {/* Always there on a phone, where it carries the stages; on a wide
            screen only when there is a platform or a prize to show. */}
        <div
          className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 ${
            row.platforms.length > 0 || row.badges.length > 0 ? "" : "sm:hidden"
          }`}
        >
          <span className="text-xs tabular-nums text-ink-4 sm:hidden">
            {row.stages} of {stageCount} {stageCount === 1 ? "stage" : "stages"}
          </span>
          {row.platforms.length > 0 && <Platforms platforms={row.platforms} />}
          {row.badges.map((badge) => (
            <Badge key={`${badge.weekNo}-${badge.category}`} badge={badge} />
          ))}
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-4 py-4 text-right align-top tabular-nums text-ink-3 sm:table-cell">
        {row.stages}
        <span className="text-ink-4"> of {stageCount}</span>
      </td>
      <td className="px-3 py-4 text-right align-top text-lg font-bold tabular-nums text-white sm:px-4">
        {row.points}
      </td>
    </tr>
  );
}

/**
 * Places gained or lost since the last recorded standings.
 *
 * Nothing for no change, so the eye goes to the rows that moved. Arrow and
 * colour both, and words for a screen reader, so the direction is never
 * carried by colour alone.
 */
function Movement({ row, since }: { row: LeaderboardRow; since: number }) {
  const context = `since the Stage ${since} standings`;
  if (row.previousRank === null) {
    return (
      <span className="mt-0.5 block text-[0.65rem] font-bold uppercase tracking-wider text-brand-gold">
        New<span className="sr-only"> {context}</span>
      </span>
    );
  }
  const change = row.previousRank - row.rank;
  if (change === 0) return <span className="sr-only">No change {context}</span>;
  const up = change > 0;
  return (
    <span
      className={`mt-0.5 block text-xs font-semibold ${
        up ? "text-green-300" : "text-red-300"
      }`}
    >
      <span aria-hidden="true">
        {up ? "▲" : "▼"}
        {Math.abs(change)}
      </span>
      <span className="sr-only">
        {up ? "Up" : "Down"} {Math.abs(change)} {context}
      </span>
    </span>
  );
}

const PLATFORM_ICON: Record<CampaignPlatform, typeof FaXTwitter> = {
  x: FaXTwitter,
  instagram: FaInstagram,
  tiktok: FaTiktok,
};

const listOf = (names: string[]) =>
  new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format(names);

/** Where their approved posts are. Icons, with the words for a screen reader. */
function Platforms({ platforms }: { platforms: CampaignPlatform[] }) {
  const said = `Approved on ${listOf(platforms.map((p) => platformLabels[p]))}`;
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-4" title={said}>
      {platforms.map((platform) => {
        const Icon = PLATFORM_ICON[platform];
        return <Icon key={platform} className="h-3.5 w-3.5" aria-hidden="true" />;
      })}
      <span className="sr-only">{said}</span>
    </span>
  );
}

function Badge({ badge }: { badge: LeaderboardBadge }) {
  return (
    /* Breaks before the stage and nowhere else, so on the narrowest phones it
       folds onto two tidy lines instead of forcing the name column wide and
       pushing Points off the screen. */
    <span className="inline-flex max-w-full items-start gap-1 rounded-xl border border-brand-gold/40 px-2 py-0.5 text-[0.7rem] font-semibold leading-snug text-brand-gold">
      <Trophy className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        {WINNER_CATEGORY_LABEL[badge.category]},{" "}
        <span className="whitespace-nowrap">Stage {badge.weekNo}</span>
      </span>
    </span>
  );
}

/** A sortable heading. aria-sort so the state is not carried by colour alone. */
function Th({
  children,
  onClick,
  active,
  ascending,
  numeric = false,
  wideOnly = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  ascending: boolean;
  numeric?: boolean;
  /** A column a phone shows under the name instead. */
  wideOnly?: boolean;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
      className={`${numeric ? "text-right" : "text-left"} ${
        wideOnly ? "hidden sm:table-cell" : ""
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-h-11 w-full cursor-pointer items-center gap-1 px-3 py-3 text-xs font-semibold uppercase sm:px-4 tracking-wider transition-colors ${
          numeric ? "justify-end" : "justify-start"
        } ${active ? "text-brand-gold" : "text-ink-4 hover:text-white"}`}
      >
        {children}
        <span aria-hidden="true" className="text-[0.65rem]">
          {active ? (ascending ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
