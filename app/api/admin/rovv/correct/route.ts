import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { correctRovvEntrant } from "@/lib/admin/rovv";
import { canonicalEmail, canonicalHandle } from "@/lib/campaign-registration";
import { PG, pgErrorCode } from "@/lib/db/errors";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Correct an entrant's TikTok username or email address (the walk-through,
 * 12 October): an entrant who typed either wrong had no way to fix it, since
 * the form only replaces an entry under the same email and username. Owners
 * only, when the entrant writes in; never once they have been emailed as a
 * winner. Read the same way the form reads them.
 */
const schema = z
  .object({
    entryId: z.string().uuid("That is not an entry."),
    tiktokHandle: z
      .string()
      .trim()
      .max(120)
      .transform((v) => canonicalHandle(v))
      .refine((v) => v === "" || /^[a-z0-9._]{2,24}$/.test(v), { message: "That is not a TikTok username." })
      .optional(),
    email: z.string().trim().toLowerCase().max(254).email("That is not an email address.").or(z.literal("")).optional(),
  })
  .refine((v) => Boolean(v.tiktokHandle) || Boolean(v.email), { message: "Give the corrected username or email." });

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });
const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;

  const admin = await requireAdmin();
  if (!admin.ok) return FORBIDDEN;
  if (!isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) return fail("We could not read that.");
  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the correction.");

  const { entryId, tiktokHandle, email } = parsed.data;
  try {
    const result = await correctRovvEntrant(admin.admin, entryId, {
      tiktokHandle: tiktokHandle || undefined,
      email: email || undefined,
      emailCanonical: email ? canonicalEmail(email) : undefined,
    });
    if (result === "missing") return fail("That entry is not there any more.", 404);
    if (result === "notified") {
      return fail("This winner has been emailed (or is being emailed right now), so their details stay as they are.", 409);
    }
    if (result === "handle_won") {
      return fail("That TikTok username is already a winner from another entry. Each person wins once.", 409);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (pgErrorCode(error) === PG.UNIQUE_VIOLATION) {
      return fail("Another entry already uses that email address. Each person enters once.", 409);
    }
    logError("admin/rovv correct", new Error(`correction not saved: ${pgErrorCode(error) ?? "no SQLSTATE"}`));
    return fail("Something went wrong at our end.", 500);
  }
}
