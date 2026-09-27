/**
 * The public vote count: its shape, and how it is read and ranked.
 *
 * Shared by the route that serves it and the component that draws it, so
 * nothing here touches the database. The count itself comes from the
 * vote_tally view and nothing else (voteBoard in lib/winners.ts): that view is
 * what closing, review and publishing all read, so what the public sees is the
 * number the result is decided on, not a second count that could disagree.
 */

/** How often an open page asks again. */
export const REFRESH_MINUTES = 5;
export const REFRESH_MS = REFRESH_MINUTES * 60_000;

/**
 * How long the edge keeps one answer: a minute under the page's beat, with
 * no stale-while-revalidate. Held for the full five minutes plus a stale
 * window, a page asking every five minutes kept landing on the copy it
 * already had, and a lone viewer saw a new count only every other tick,
 * up to ten minutes old under "refreshes every 5 minutes". This way every
 * ask after the first finds a copy that has expired or is younger than the
 * page's own, and the database is still read at most once in four minutes.
 */
export const EDGE_SECONDS = REFRESH_MINUTES * 60 - 60;

export interface VoteBoardRow {
  nomineeId: string;
  /** As they registered it; already on the nominee cards. */
  name: string;
  votes: number;
}

export interface VoteBoard {
  weekNo: number;
  opensAt: string;
  closesAt: string;
  /** An owner has closed the round, whatever the clock says. */
  closed: boolean;
  /** The Community Favourite has been published; the count is final. */
  final: boolean;
  /** When the database was actually read, not when the page asked. */
  asOf: string;
  nominees: VoteBoardRow[];
}

export type BoardState = "before" | "open" | "closed" | "final";

/**
 * Where the board's round sits, worked out in the browser.
 *
 * Not taken from the response: an answer can sit at the edge for five
 * minutes, and a board that still says "live" four minutes after the close
 * is the page contradicting the clock beside it.
 */
export function boardState(board: VoteBoard, now: number): BoardState {
  if (board.final) return "final";
  const closes = new Date(board.closesAt).getTime();
  if (board.closed || (!Number.isNaN(closes) && closes <= now)) return "closed";
  const opens = new Date(board.opensAt).getTime();
  if (!Number.isNaN(opens) && opens > now) return "before";
  return "open";
}

export interface RankedRow extends VoteBoardRow {
  /** Shared on a tie: two nominees level on votes are both second. */
  rank: number;
  /** Whole percent of all counted votes; 0 while nobody has voted. */
  share: number;
  /** Strictly ahead of everybody else. Nobody leads a tie, or an empty count. */
  leading: boolean;
}

/**
 * Most votes first, ties sharing a rank and keeping the ballot's order.
 *
 * Nobody is marked as leading a tie. The rules settle a tie on that week's
 * recorded points, which are only pinned when the round closes, so a board
 * that picked one of two level nominees would be guessing at a result the
 * engine has not decided.
 */
export function rankBoard(rows: VoteBoardRow[]): {
  rows: RankedRow[];
  total: number;
  levelAtTop: boolean;
} {
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.votes - a.row.votes || a.index - b.index)
    .map(({ row }) => row);
  const top = sorted[0]?.votes ?? 0;
  const atTop = sorted.filter((row) => row.votes === top).length;

  let rank = 0;
  const ranked = sorted.map((row, index) => {
    if (index === 0 || row.votes !== sorted[index - 1].votes) rank = index + 1;
    return {
      ...row,
      rank,
      share: total === 0 ? 0 : Math.round((row.votes / total) * 100),
      leading: top > 0 && atTop === 1 && row.votes === top,
    };
  });
  return { rows: ranked, total, levelAtTop: top > 0 && atTop > 1 };
}

/**
 * The response, checked before anything renders it.
 *
 * Every field is rebuilt by hand, so a column added upstream cannot reach the
 * page through this, and anything malformed is refused whole rather than
 * drawn half right.
 */
export function readBoard(value: unknown): VoteBoard | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (body.ok !== true) return null;
  const board = body.board as Record<string, unknown> | null | undefined;
  if (!board || typeof board !== "object" || !Array.isArray(board.nominees)) return null;

  const nominees: VoteBoardRow[] = [];
  for (const item of board.nominees as unknown[]) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (
      typeof row.nomineeId !== "string" ||
      typeof row.name !== "string" ||
      typeof row.votes !== "number" ||
      !Number.isInteger(row.votes) ||
      row.votes < 0
    ) {
      return null;
    }
    nominees.push({ nomineeId: row.nomineeId, name: row.name, votes: row.votes });
  }
  if (
    typeof board.weekNo !== "number" ||
    typeof board.opensAt !== "string" ||
    typeof board.closesAt !== "string" ||
    typeof board.asOf !== "string" ||
    Number.isNaN(new Date(board.asOf).getTime())
  ) {
    return null;
  }
  return {
    weekNo: board.weekNo,
    opensAt: board.opensAt,
    closesAt: board.closesAt,
    closed: board.closed === true,
    final: board.final === true,
    asOf: board.asOf,
    nominees,
  };
}
