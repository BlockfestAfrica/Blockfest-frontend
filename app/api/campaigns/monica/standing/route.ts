import { NextRequest, NextResponse } from "next/server";
import { notCrossSite } from "@/lib/admin/request";
import { currentCreator } from "@/lib/creator-session";
import { creatorRank } from "@/lib/leaderboard";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Every response, every branch. The answer is one person's, read from their
 * cookie, and the public GETs beside this one are cached at the edge; copying
 * their header here would hand one creator's name to the next visitor.
 */
const PRIVATE = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

/**
 * Where the signed-in creator stands, for the public leaderboard to mark.
 *
 * The leaderboard is one cached page for everybody, and it stays that way: it
 * reads no cookie, so the ranking query does not run once per visitor. The
 * table asks this after it loads, and marks the row whose rank AND name match.
 * Rank alone would mark whoever held it a minute ago on a board a minute old;
 * name alone would mark a stranger with the same name. Where they disagree,
 * nothing is marked.
 *
 * The answer is those two fields and nothing else, built by hand. The session
 * carries the enrolment id and the referral code, and neither is needed to
 * find a row, so neither is sent. Signed out, or holding only the old cookie,
 * is not an error here: it is simply nobody to mark.
 */
export async function GET(request: NextRequest) {
  if (!notCrossSite(request)) {
    return NextResponse.json(
      { ok: false, message: "Not allowed." },
      { status: 403, headers: PRIVATE },
    );
  }

  try {
    const creator = await currentCreator();
    if (!creator) {
      return NextResponse.json({ ok: true, me: null }, { headers: PRIVATE });
    }

    // Fails soft to null, like the board.
    const rank = await creatorRank(creator.enrolmentId);
    return NextResponse.json(
      {
        ok: true,
        me: rank === null ? null : { rank, name: creator.name.trim() },
      },
      { headers: PRIVATE },
    );
  } catch (error) {
    logError("campaigns/monica/standing", error);
    return NextResponse.json({ ok: false, me: null }, { headers: PRIVATE });
  }
}
