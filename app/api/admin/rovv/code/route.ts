import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { setRovvTicketCode } from "@/lib/admin/rovv";
import { PG, pgErrorCode } from "@/lib/db/errors";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Give a Rovv winner their 100%-off ticket code, change it, or clear it.
 *
 * Owners only, like picking: the code is the prize. set_rovv_ticket_code
 * (0074) holds the rules: winners only, one code per winner, never once
 * their email has gone or while it is going. The winner email carries the
 * code, so a winner without one is never emailed.
 */

const schema = z.object({
  entryId: z.string().uuid("That is not an entry."),
  /** Empty clears it. Shape checked here for the words, and by the function. */
  code: z
    .string()
    .trim()
    .max(64, "That code is too long.")
    .refine((v) => v === "" || /^[A-Za-z0-9_-]{3,64}$/.test(v), {
      message: "A ticket code is letters, numbers, dashes or underscores, as the ticket page gives it.",
    }),
});

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

const MESSAGES: Record<string, { status: number; message: string }> = {
  [PG.ROVV_CODE_NEEDS_WINNER]: { status: 409, message: "Only a winner gets a ticket code. Pick them first." },
  [PG.ROVV_CODE_LOCKED]: {
    status: 409,
    message: "This winner has been emailed their code already, so it stays as sent.",
  },
  [PG.ROVV_WINNER_BEING_TOLD]: {
    status: 409,
    message: "This winner's email is being sent right now. Reload in a few minutes.",
  },
  [PG.ROVV_CODE_TAKEN]: { status: 409, message: "Another winner already has that code. Each winner needs their own." },
  [PG.UNIQUE_VIOLATION]: { status: 409, message: "Another winner already has that code. Each winner needs their own." },
  [PG.ROVV_BAD_CODE]: {
    status: 400,
    message: "A ticket code is letters, numbers, dashes or underscores, as the ticket page gives it.",
  },
  [PG.ROVV_ENTRY_NOT_FOUND]: { status: 404, message: "That entry is not there any more. The list has been reloaded." },
  [PG.ADMIN_REQUIRED]: { status: 403, message: "Only a signed-in admin can do this." },
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the code." },
      { status: 400 },
    );
  }

  try {
    const code = await setRovvTicketCode(admin.admin, parsed.data.entryId, parsed.data.code);
    return NextResponse.json({ ok: true, code });
  } catch (error) {
    const known = MESSAGES[pgErrorCode(error) ?? ""];
    if (known) return NextResponse.json({ ok: false, message: known.message }, { status: known.status });
    // Only the code: a query error carries its parameters, and one of them
    // is somebody's ticket.
    logError("admin/rovv code", new Error(`ticket code not saved: ${pgErrorCode(error) ?? "no SQLSTATE"}`));
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
