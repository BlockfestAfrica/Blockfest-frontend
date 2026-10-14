import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { rovvTicketCodeOf, setRovvWinner } from "@/lib/admin/rovv";
import { PG, pgErrorCode } from "@/lib/db/errors";
import { ROVV } from "@/lib/rovv";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pick, or unpick, a Rovv winner.
 *
 * Owners only: a pick gives a person a ticket, the same reason announcing a
 * Monica winner is owner work. The tab being visible to reviewers is for
 * reviewing; this route checks the role itself. set_rovv_winner holds the
 * rules (eligible only, never more than 20, an emailed winner stays) under a
 * lock, and writes the audit row.
 */

const schema = z.object({
  entryId: z.string().uuid("That is not an entry."),
  pick: z.boolean(),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, { status: number; message: string }> = {
  [PG.ROVV_NOT_ELIGIBLE]: {
    status: 409,
    message: "Only an eligible entry can win. Mark it eligible first.",
  },
  [PG.ROVV_WINNERS_FULL]: {
    status: 409,
    message: `All ${ROVV.winners} winners are picked. Unpick one before picking another.`,
  },
  [PG.ROVV_WINNER_ALREADY_TOLD]: {
    status: 409,
    message:
      "This winner has already been emailed, so they stay a winner. Their username is on the campaign page.",
  },
  [PG.ROVV_WINNER_BEING_TOLD]: {
    status: 409,
    message:
      "This winner's email is being sent right now. Reload in a few minutes: if it went, they stay a winner; if it failed, you can unpick them.",
  },
  [PG.ROVV_ENTRY_NOT_FOUND]: {
    status: 404,
    message: "That entry is not there any more. The list has been reloaded.",
  },
  [PG.ADMIN_REQUIRED]: { status: 403, message: "Only a signed-in admin can do this." },
  /* Both held by set_rovv_winner under the campaign's lock (0075). */
  [PG.ROVV_ALREADY_WON]: {
    status: 409,
    message: "This TikTok username is already a winner from another entry. Each person wins once.",
  },
  [PG.ROVV_RESULTS_SENT]: {
    status: 409,
    message: "This entrant has already been emailed that they did not win, so they cannot be picked now.",
  },
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  try {
    const { entryId, pick } = parsed.data;
    // Read before the unpick clears it, so the owner is told which code is free again.
    const freedCode = pick ? null : await rovvTicketCodeOf(admin.admin, entryId);
    const winners = await setRovvWinner(admin.admin, entryId, pick);
    return NextResponse.json({ ok: true, winners, freedCode });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;
    if (known) {
      return NextResponse.json({ ok: false, message: known.message }, { status: known.status });
    }
    logError("admin/rovv winner", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
