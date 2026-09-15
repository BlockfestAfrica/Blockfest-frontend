import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { sendEmailQuietly } from "@/lib/email/client";
import { personalPage, repriceEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bring ONE entry to current rates, on purpose (#68).
 *
 * Never automatic and never a side effect: a configurable system that
 * recomputes history on edit is a trapdoor where one well-meant change
 * silently re-ranks everybody. This is the explicit lever, owner-only,
 * reasoned, audited with the totals it moved between.
 */

const FORBIDDEN = NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

const schema = z.object({
  entryId: z.string().uuid("That is not an entry id."),
  reason: z.string().trim().min(1, "Say why. It is what a dispute is answered with.").max(300),
});

const KNOWN: Array<[string, string, string]> = [
  ["P0911", "entry_not_found", "That entry does not exist."],
  ["P0502", "reason_required", "Say why. It is what a dispute is answered with."],
  /* The ordinary refusal, previously unmapped: repricing an entry of a week
     that has ended answered as a server fault, which reads as a bug rather
     than the rule it is. Same wording the challenge editor already uses. */
  ["P0907", "challenge_readonly", "That week has ended. A finished week is the record of how its winners were decided, so it stays as it ran."],
];

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return FORBIDDEN;
  const admin = await requireAdmin();
  if (!admin.ok || !isOwner(admin.admin)) return FORBIDDEN;

  const read = await readJsonBody(request);
  if (!read.ok) return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  try {
    const result = await getDb().execute(sql`
      SELECT * FROM reprice_entry(${parsed.data.entryId}::uuid, ${admin.admin.adminId}::uuid, ${parsed.data.reason}::text)
    `);
    const row = (result.rows?.[0] ?? {}) as { points_before?: number; points_after?: number };
    const before = Number(row.points_before ?? 0);
    const after = Number(row.points_after ?? 0);

    /*
     * Tell the creator, but only when the number actually moved: a no-op
     * reprice is bookkeeping, and mailing "nothing changed" trains people
     * to ignore the mails that matter. Fail-soft after the commit.
     */
    if (before !== after) {
      try {
        const who = await getDb().execute(sql`
          SELECT c.email, c.full_name, ch.week_no
            FROM challenge_entries ce
            JOIN challenges ch        ON ch.id = ce.challenge_id
            JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
            JOIN creators c           ON c.id = cc.creator_id
           WHERE ce.id = ${parsed.data.entryId}::uuid
        `);
        const person = (who.rows?.[0] ?? null) as {
          email?: string;
          full_name?: string;
          week_no?: number;
        } | null;
        if (person?.email) {
          await sendEmailQuietly(
            repriceEmail({
              to: person.email,
              fullName: person.full_name ?? "",
              weekNo: Number(person.week_no ?? 0),
              before,
              after,
              reason: parsed.data.reason,
              personalPage: personalPage(),
            }),
            "reprice notice",
          );
        }
      } catch (error) {
        logError("admin/reprice notice mail", error);
      }
    }

    return NextResponse.json({ ok: true, before, after });
  } catch (error) {
    for (const [code, raise, message] of KNOWN) {
      if (isPgError(error, code, raise)) {
        return NextResponse.json({ ok: false, message }, { status: 400 });
      }
    }
    logError("admin/reprice", error);
    return NextResponse.json({ ok: false, message: "Something went wrong at our end." }, { status: 500 });
  }
}
