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
  return NextResponse.json({ ok: true, message: "Your vote is in." });
}
