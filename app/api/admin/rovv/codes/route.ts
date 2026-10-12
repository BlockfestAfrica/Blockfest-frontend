import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { assignRovvTicketCodes, heldRovvTicketCodes } from "@/lib/admin/rovv";
import { PG, pgErrorCode } from "@/lib/db/errors";
import { readTicketCodes } from "@/lib/rovv-codes";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hand out a pasted list of ticket codes, one per winner (the owner, 12
 * October). Owners only. The list is read the way the console showed it
 * (lib/rovv-codes.ts) and refused whole if anything in it is wrong, so a
 * paste never half-lands: a piece that is not a code, a code twice, or a
 * code a winner already holds. assign_rovv_ticket_codes does the handing
 * out, in the order the winners were picked, and checks all three again.
 *
 * Nothing is emailed here. The codes show on each winner's card, and the
 * winner email (its own button) carries each winner's own.
 */
const schema = z.object({
  text: z.string().max(16_000, "That is a lot more than twenty codes. Paste just the codes."),
  /** Hand them to test winners instead of real ones (the test panel). */
  test: z.boolean().optional().default(false),
});

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });
const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });
const listed = (items: string[]) => items.slice(0, 5).join(", ") + (items.length > 5 ? ` and ${items.length - 5} more` : "");

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request, 20 * 1024);
  if (!read.ok) return fail("We could not read that.");
  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the codes.");

  const { codes, invalid, repeated } = readTicketCodes(parsed.data.text);
  if (codes.length === 0) return fail("Paste the codes first, one per line.");
  if (invalid.length > 0) return fail(`These are not ticket codes: ${listed(invalid)}. Paste only the codes.`);
  if (repeated.length > 0) return fail(`These codes are in the list twice: ${listed(repeated)}. Each winner needs their own.`);

  try {
    const held = await heldRovvTicketCodes(admin.admin, codes);
    if (held.length > 0) {
      return fail(`These codes are already given to a winner: ${listed(held)}. Take them out and paste again.`, 409);
    }
    const assigned = await assignRovvTicketCodes(admin.admin, codes, parsed.data.test);
    return NextResponse.json({
      ok: true,
      assigned,
      unused: codes.length - assigned.length,
    });
  } catch (error) {
    switch (pgErrorCode(error)) {
      case PG.ROVV_CODE_TAKEN:
      case PG.UNIQUE_VIOLATION:
        return fail("One of these codes was just given to a winner. Reload and paste again.", 409);
      case PG.ROVV_BAD_CODE:
        return fail("One of these is not a ticket code. Paste only the codes.");
      case PG.ROVV_CODES_REPEATED:
        return fail("A code is in the list twice. Each winner needs their own.");
      default:
        // Only the code: a query error carries its parameters, which are
        // the tickets themselves.
        logError("admin/rovv codes", new Error(`ticket codes not handed out: ${pgErrorCode(error) ?? "no SQLSTATE"}`));
        return fail("Something went wrong at our end.", 500);
    }
  }
}
