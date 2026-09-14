import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { canonicalEmail } from "@/lib/campaign-registration";
import {
  allowVoteKey,
  DOMAIN_CAP,
  hashCode,
  isAllowlisted,
  voteEmailSchema,
} from "@/lib/campaign-vote";
import { MONICA_SLUG } from "@/lib/campaigns";
import { isPgError } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { sendEmailQuietly } from "@/lib/email/client";
import { voteReceiptEmail } from "@/lib/email/templates";

/** postgres over HTTP needs Node; see lib/db/client. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  roundId: z.string().uuid(),
  email: voteEmailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six digit code from the email."),
});

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * Verifying a cast vote with the emailed code.
 *
 * The engine owns the decision: it matches the hash, enforces the fifteen
 * minute life, and judges the domain cap at the moment the vote becomes
 * countable. This route only throttles the guessing and keeps the answers
 * uniform. Whatever the engine decided about counted versus held, the voter
 * hears one sentence, because "your vote is being reviewed" is a progress
 * report to a farm operator tuning their run.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("We could not read that. Please try again.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Check the details and try again.",
      400,
    );
  }
  const input = parsed.data;
  const emailCanonical = canonicalEmail(input.email);

  /*
   * Fail closed, like the cast throttle and unlike registration: what this
   * bucket rations is guesses at a six digit code, and a throttle that
   * cannot be read must refuse rather than let a guessing run ride out a
   * database blip. Ten an hour is generous for fat thumbs and hopeless for
   * brute force against a million codes that expire in fifteen minutes.
   */
  if (!(await allowVoteKey(`vote-verify:${emailCanonical}`, "vote-verify", 10, 3600))) {
    return fail(
      "That is a lot of attempts for one address. Wait a while and try again.",
      429,
    );
  }

  try {
    await getDb().execute(sql`
      SELECT * FROM verify_vote(
        ${MONICA_SLUG},
        ${input.roundId}::uuid,
        ${emailCanonical},
        ${hashCode(emailCanonical, input.code)},
        ${DOMAIN_CAP}::integer,
        ${isAllowlisted(emailCanonical)}::boolean
      )
    `);
  } catch (error) {
    // One name for a wrong code, an expired code, and an email with nothing
    // pending. The engine merges them on purpose and this route keeps the
    // merge: separating them would say which addresses have votes waiting.
    if (isPgError(error, "P0817", "code_invalid")) {
      return fail(
        "That code did not match or has expired. Cast your vote again for a fresh one.",
        400,
      );
    }
    if (isPgError(error, "P0813", "unknown_round")) {
      return fail("That voting round does not exist.", 404);
    }
    if (isPgError(error, "P0814", "round_not_open")) {
      return fail("Voting for this round has closed.", 409);
    }
    logError("campaign/vote/verify unmapped", error);
    return fail("Something went wrong at our end. Please try again.", 500);
  }

  // The function reports whether the vote was held for review, and that
  // report deliberately stops here. Held is still a verified vote in the
  // voter's eyes and in the engine's audit trail; a human admits or removes
  // it, and the voter is never the one told the cap fired.

  /*
   * The receipt, after the verdict and blind to it. The lookup reads the
   * vote's nominee without touching status or held_at, so a counted vote
   * and a held one produce byte-identical mail, which is the same uniform
   * rule the response line above enforces. Fail-soft, to the address as
   * typed: a lost receipt costs nothing, the vote is already in.
   */
  try {
    const meta = await getDb().execute(sql`
      SELECT c.full_name AS display_name, ch.week_no
        FROM votes v
        JOIN vote_round_nominees n ON n.id = v.nominee_id
        JOIN challenge_entries ce  ON ce.id = n.entry_id
        JOIN challenges ch         ON ch.id = ce.challenge_id
        JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
        JOIN creators c            ON c.id = cc.creator_id
       WHERE v.round_id = ${input.roundId}::uuid
         AND v.voter_email_canonical = ${emailCanonical}
         AND v.status = 'counted'
         AND v.verified_at IS NOT NULL
       ORDER BY v.created_at DESC
       LIMIT 1
    `);
    /* status = 'counted' keeps removed rows out: an unswept voter who cast
       again would otherwise race two rows for rows[0] and the receipt could
       name their PREVIOUS choice. A held vote still has status 'counted'
       and a verified_at, so the filter changes nothing between counted and
       held, which is the uniformity the comment above promises. */
    const row = (meta.rows?.[0] ?? null) as {
      display_name?: string;
      week_no?: number;
    } | null;
    if (row?.display_name) {
      await sendEmailQuietly(
        voteReceiptEmail({
          to: input.email,
          nomineeName: row.display_name,
          weekNo: Number(row.week_no ?? 0),
        }),
        "vote receipt",
      );
    }
  } catch (error) {
    logError("campaign/vote receipt mail", error);
  }

  return NextResponse.json({ ok: true, message: "Your vote is in." });
}
