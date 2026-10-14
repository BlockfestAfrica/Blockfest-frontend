import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { decideRovvEntry, rovvRulingEmail, sendRovvRulingEmail } from "@/lib/admin/rovv";
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
 * The entrant is emailed when a ruling changes their entry (the owner, 12
 * October, as Monica's entries are): eligible says it is in the running,
 * ineligible gives the reviewer's reason and, while entries are open, how to
 * fix it and send it again. Back to waiting sends nothing, and neither does
 * the ruling they were last emailed (ruling_emailed, 0074), even with a
 * "back to waiting" between: the same news twice is noise. What is sent, and
 * when, is lib/admin/rovv.ts's rovvRulingEmail, shared with the owner's
 * rule-out so both say the same.
 *
 * A send that was tried and failed answers emailFailed, so the reviewer is
 * told rather than left to assume the entrant heard.
 */

const schema = z.object({
  entryId: z.string().uuid("That is not an entry."),
  status: z.enum(ROVV_ENTRY_STATUSES),
  /**
   * On an ineligible ruling, the reason: emailed to the entrant word for
   * word. On an eligible one, an optional judge's note for the team: stored
   * and shown on the card and in the team's export, never emailed (the
   * eligible email takes no reason). Never sent to ROVV either way.
   */
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
  /** The version of the entry the reviewer was looking at. */
  revision: z.number().int().positive(),
  /**
   * The ruling the reviewer's card showed. Two reviewers work the list at
   * once; a card minutes out of date would otherwise overturn the other
   * reviewer's ruling and email the entrant the opposite news.
   */
  from: z.enum(ROVV_ENTRY_STATUSES).optional(),
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, { status: number; message: string }> = {
  [PG.REASON_REQUIRED]: {
    status: 400,
    message: "Ruling an entry out needs a reason. The entrant is emailed it, so write it to them.",
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
  [PG.ROVV_RULED_MEANWHILE]: {
    status: 409,
    message: "Another reviewer has just ruled on this entry. The list has been reloaded: check it before ruling again.",
  },
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

  const { entryId, status, note, revision, from } = parsed.data;

  // Asked here as well as in the function, so the reviewer gets the words
  // before a round trip, and the function's check stays the one that counts.
  if (status === "ineligible" && !note) {
    return NextResponse.json(
      { ok: false, message: MESSAGES[PG.REASON_REQUIRED].message },
      { status: 400 },
    );
  }

  try {
    // Checked by the database under the row's lock (0075), so two reviewers
    // ruling at once cannot both get through.
    const outcome = await decideRovvEntry(admin.admin, entryId, status, note || null, revision, from ?? null);

    /* The ruling is made whatever happens to the email: a failure to read
       or send is logged, never turned into a failed ruling. */
    let emailed = false;
    let emailFailed = false;
    const ruled = outcome.status;
    if (ruled !== "pending") {
      const email = await rovvRulingEmail(admin.admin, entryId, ruled, note || null, "admin/rovv decision");
      if (email) {
        emailed = await sendRovvRulingEmail(admin.admin, entryId, ruled, email, "admin/rovv decision");
        emailFailed = !emailed;
      }
    }

    // emailFailed only when true, so a ruling whose email went, or was not
    // due, answers exactly as it always has.
    return NextResponse.json({
      ok: true,
      status: outcome.status,
      winner: outcome.winner,
      emailed,
      ...(emailFailed ? { emailFailed: true } : {}),
    });
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
