import { NextResponse } from "next/server";
import { voteBoard } from "@/lib/winners";
import { EDGE_SECONDS } from "@/lib/vote-board";

export const runtime = "nodejs";

/**
 * The Community Favourite count, for the winners page to fetch.
 *
 * Public and unauthenticated on purpose: nominee names are already on the
 * page, and the count is the number the result is decided on.
 *
 * Kept at the edge for four minutes (EDGE_SECONDS) while each open page asks
 * every five, so all of them share one answer and the database is read at
 * most once every four minutes however many people are watching on the
 * night the link goes round. The answer says when it was read (asOf), and
 * the page shows that time, so nobody is told an old count is live.
 *
 * max-age=0 keeps browsers from holding their own copy on top of the edge's.
 */
const FRESH = `public, max-age=0, s-maxage=${EDGE_SECONDS}`;

export async function GET() {
  try {
    const board = await voteBoard();
    return NextResponse.json({ ok: true, board }, { headers: { "Cache-Control": FRESH } });
  } catch (error) {
    console.warn(
      "[vote-count] unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    // The page keeps the last count it drew, with its time; a failure is
    // held for a minute so a struggling database is not asked by every
    // open page at once.
    return NextResponse.json(
      { ok: false, board: null },
      { status: 200, headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } },
    );
  }
}
