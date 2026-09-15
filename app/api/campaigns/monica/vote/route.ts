import { NextResponse, type NextRequest, after } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { canonicalEmail } from "@/lib/campaign-registration";
import {
  allowVoteKey,
  hashCode,
  hashIp,
  sixDigitCode,
  voteEmailSchema,
} from "@/lib/campaign-vote";
import { MONICA_SLUG } from "@/lib/campaigns";
import { sameOrigin } from "@/lib/admin/request";
import { isPgError } from "@/lib/db/errors";
import { sendEmailQuietly } from "@/lib/email/client";
import { voteVerificationEmail } from "@/lib/email/templates";
import { logError, logWarning } from "@/lib/log";

/** postgres over HTTP needs Node; see lib/db/client. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  roundId: z.string().uuid(),
  nomineeId: z.string().uuid(),
  email: voteEmailSchema,
});

/**
 * The one answer a cast ever gets on success, and the same answer when the
 * engine raises already_voted. P0816 covers a verified vote, a held vote and
 * a fraud-barred email on purpose, and this route keeps the merge: a
 * distinct message for any of those states would let anyone with a list of
 * addresses ask which of them voted, which are barred, and which tripped the
 * cap. Worded as a conditional so a person who already voted is not promised
 * a mail that will never arrive.
 */
const CAST_MESSAGE =
  "If this address has not voted in this round yet, a six digit code is on its way to its inbox.";

/**
 * A floor under how fast a cast can answer, so the merged branches cost the
 * same wall clock. The send itself now happens after the response, so the
 * only thing left to hide is the handful of milliseconds between an engine
 * refusal and a successful insert. Same device the recovery route uses, and
 * the same reason: a message that merges states is not a merge if a
 * stopwatch separates them.
 */
const TIMING_FLOOR_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function uniformCast(started: number) {
  await sleep(Math.max(0, TIMING_FLOOR_MS - (Date.now() - started)));
  return NextResponse.json({ ok: true, message: CAST_MESSAGE });
}

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * Casting a Community Favourite vote.
 *
 * The engine from migration 0046 owns every rule that matters: one counted
 * vote per canonical email per round, a pending cast replaced by a new one
 * with a fresh code, a verified or held or barred address refused under one
 * name. This route validates the shape, throttles the asking, and turns the
 * engine's named refusals into answers a person can act on without teaching
 * an attacker anything the engine hid on purpose.
 */
export async function POST(request: NextRequest) {
  const started = Date.now();

  /*
   * Same-origin, and JSON only, before anything else.
   *
   * Without both, a page anywhere on the internet can auto-submit a
   * text/plain form here: a CORS-safelisted body needs no preflight, and
   * request.text() does not care what content type produced it, so the
   * JSON arrives intact. Every innocent visitor then casts one ballot
   * under the attacker's address, and because the row stores the VISITOR's
   * address hash, both controls this route relies on are blinded at once:
   * the per-IP cast ration never fires, and the console's same-connection
   * cluster screen has nothing to cluster. The reviewer sweeps a clean
   * board and the prize is announced against a laundered tally.
   */
  if (!sameOrigin(request)) return fail("Not allowed.", 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return fail("We could not read that. Please try again.", 415);
  }

  // A vote is well under a kilobyte, and this endpoint is public and
  // unauthenticated. The register route explains why the App Router needs
  // the cap at all; the same reasoning applies unchanged here.
  const MAX_BODY_BYTES = 8 * 1024;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return fail("That request is too large.", 413);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return fail("That request is too large.", 413);
    }
    body = JSON.parse(raw);
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

  // Netlify sets its own header; x-forwarded-for is the fallback and its
  // first entry is the client. Same reading as the register route, and
  // trusted for exactly as little: throttling and the review trail.
  const ip =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ipHash = hashIp(ip);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  /*
   * Throttled before anything is written, and these buckets FAIL CLOSED,
   * unlike every registration limit. The registration routes fail open
   * because their limits only slow enumeration; a failure here is different
   * because the thing being rationed is outbound mail. A cast whose throttle
   * cannot be read must refuse rather than send, or a database blip becomes
   * an unmetered mail sender aimed at whatever inbox an attacker types.
   *
   * Two buckets: three code sends an hour for one address from one place,
   * because a person mistypes a code once or twice and a script asks for
   * hundreds, and thirty casts an hour from one place, high enough for a
   * carrier NAT full of real voters and low enough to make a farm slow.
   */
  if (!(await allowVoteKey(`vote-send:${emailCanonical}:${ipHash}`, "vote-send", 3, 3600))) {
    return fail(
      "That is a lot of codes for one address. Wait a while and try again.",
      429,
    );
  }
  /*
   * And an address-only bucket, because the pair above is only as strong as
   * the IP half: residential proxy exits are a commodity, and a fresh exit
   * is a fresh (address, IP) bucket worth three more sends to the same
   * inbox. Five an hour per address, whatever the connection, so the
   * mail-bomb this file's comments promise to prevent stays prevented.
   * Mirrors the recover-request-address bucket on the recovery route.
   */
  if (!(await allowVoteKey(`vote-send-address:${emailCanonical}`, "vote-send-address", 5, 3600))) {
    return fail(
      "That is a lot of codes for one address. Wait a while and try again.",
      429,
    );
  }
  if (!(await allowVoteKey(`vote-ip:${ipHash}`, "vote-cast", 30, 3600))) {
    return fail(
      "That is a lot of votes from one place. Wait a while and try again.",
      429,
    );
  }

  const code = sixDigitCode();

  try {
    await getDb().execute(sql`
      SELECT * FROM cast_vote(
        ${MONICA_SLUG},
        ${input.roundId}::uuid,
        ${input.nomineeId}::uuid,
        ${emailCanonical},
        ${hashCode(emailCanonical, code)},
        ${ipHash},
        ${userAgent}
      )
    `);
  } catch (error) {
    // The uniform branch. See CAST_MESSAGE for why this is a success shape,
    // and uniformCast for why it waits before saying it.
    if (isPgError(error, "P0816", "already_voted")) {
      return uniformCast(started);
    }
    // These two are honest: a closed round and a wrong ballot say nothing
    // about any email address, so there is nothing to hide.
    if (isPgError(error, "P0814", "round_not_open")) {
      return fail("Voting for this round is not open.", 409);
    }
    if (isPgError(error, "P0813", "unknown_round")) {
      return fail("That voting round does not exist.", 404);
    }
    if (isPgError(error, "P0815", "unknown_nominee")) {
      return fail("That creator is not on this ballot.", 404);
    }
    logError("campaign/vote unmapped", error);
    return fail("Something went wrong at our end. Please try again.", 500);
  }

  /*
   * The mail names the nominee and the week, so the lookup runs after the
   * cast has already committed. It fails soft: if this read breaks, the
   * pending vote holds a code nobody was sent, the voter hears the same
   * uniform answer, and casting again replaces the code. Failing the whole
   * request here would roll nothing back and only advertise the hiccup.
   *
   * After the response, not inside it. CAST_MESSAGE is worded to merge a
   * fresh address with one that already voted, is held, or is fraud-barred,
   * but the merge was only true in words: the already_voted branch returned
   * immediately while this branch waited on a mail round trip, so a
   * stopwatch told the two apart and an operator could enumerate which of
   * their own addresses the sweep had caught. after() keeps the work inside
   * the invocation without the caller waiting on it.
   */
  after(async () => {
    try {
      const meta = await getDb().execute(sql`
        SELECT c.full_name AS display_name, ch.week_no
          FROM vote_round_nominees n
          JOIN challenge_entries ce ON ce.id = n.entry_id
          JOIN challenges ch        ON ch.id = ce.challenge_id
          JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
          JOIN creators c           ON c.id = cc.creator_id
         WHERE n.id = ${input.nomineeId}::uuid
           AND n.round_id = ${input.roundId}::uuid
      `);
      const row = (meta.rows?.[0] ?? null) as {
        display_name?: string;
        week_no?: number;
      } | null;

      if (row?.display_name) {
        // To the address as typed, never the canonical form: canonicalEmail's
        // own contract is that its output is compared, not mailed.
        await sendEmailQuietly(
          voteVerificationEmail({
            to: input.email,
            code,
            nomineeName: row.display_name,
            weekNo: Number(row.week_no ?? 0),
          }),
          "vote code",
        );
      } else {
        logWarning("campaign/vote", "nominee lookup returned nothing after a successful cast");
      }
    } catch (error) {
      logError("campaign/vote code mail", error);
    }
  });

  return uniformCast(started);
}
