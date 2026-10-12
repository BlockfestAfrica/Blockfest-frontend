import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { decideRovvEntry } from "@/lib/admin/rovv";
import { PG, pgErrorCode } from "@/lib/db/errors";
import { ROVV_ENTRY_STATUSES } from "@/lib/rovv";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rule on a Rovv entry: eligible, ineligible (with the reason), or back to
 * waiting.
 *
 * Any admin, because reviewing is reviewer work; picking winners is not, and
 * lives in its own owner-only route. The same order of checks as the Monica
 * review route: origin before the body is read, the admin against the
 * database, then the shape. decide_rovv_entry writes the audit row itself.
 *
 * Nothing is emailed. An entrant hears once, if they win, from the owner's
 * notice; a ruling can still change until then.
 */

const schema = z.object({
  entryId: z.string().uuid("That is not an entry."),
  status: z.enum(ROVV_ENTRY_STATUSES),
  /** Shown in the console beside the entry, and in the team's export. Never sent to ROVV. */
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
  /** The version of the entry the reviewer was looking at. */
  revision: z.number().int().positive(),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, { status: number; message: string }> = {
  [PG.REASON_REQUIRED]: {
    status: 400,
    message: "Ruling an entry out needs a reason, so the team can see why later.",
  },
  [PG.ROVV_BAD_STATUS]: { status: 400, message: "That is not a review state." },
  [PG.ROVV_WINNER_STAYS_ELIGIBLE]: {
    status: 409,
    message:
      "This entry is a winner, so it stays eligible. An owner has to unpick it first.",
  },
  [PG.ROVV_ENTRY_NOT_FOUND]: {
    status: 404,
    message: "That entry is not there any more. The list has been reloaded.",
  },
  [PG.ADMIN_REQUIRED]: { status: 403, message: "Only a signed-in admin can do this." },
  [PG.ROVV_ENTRY_CHANGED]: {
    status: 409,
    message:
      "The entrant has replaced this entry since you loaded it. The list has been reloaded: watch the new video, then rule.",
  },
  /* rovv_entry_one_per_video: only one entry per video can be eligible.
     Pending entries may share one, so the reviewer decides whose it is. */
  [PG.UNIQUE_VIOLATION]: {
    status: 409,
    message:
      "Another entry for this same video is already eligible. Only one can be: rule that one out first if this is the author's.",
  },
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;

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
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the decision." },
      { status: 400 },
    );
  }

  const { entryId, status, note, revision } = parsed.data;

  // Asked here as well as in the function, so the reviewer gets the words
  // before a round trip, and the function's check stays the one that counts.
  if (status === "ineligible" && !note) {
    return NextResponse.json(
      { ok: false, message: MESSAGES[PG.REASON_REQUIRED].message },
      { status: 400 },
    );
  }

  try {
    const outcome = await decideRovvEntry(admin.admin, entryId, status, note || null, revision);
    return NextResponse.json({ ok: true, status: outcome.status, winner: outcome.winner });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;
    if (known) {
      return NextResponse.json({ ok: false, message: known.message }, { status: known.status });
    }
    logError("admin/rovv decision", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
