import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { MONICA_SLUG } from "@/lib/campaigns";
import { closingAt } from "@/lib/format";
import { sendEmailQuietly } from "@/lib/email/client";
import { shortlistEmail, votingPage } from "@/lib/email/templates";
import { findVotesByEmail } from "@/lib/admin/vote-round";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* The open action commits the round and then mails its nominees. At ten
   seconds a send and five nominees, the default budget could kill the
   handler AFTER the round existed, so the console said "we could not reach
   the server" about a round that was already open, and the retry hit the
   one-round-per-week index. Room for the commit plus one batch. */
export const maxDuration = 30;

/**
 * Run the Community Favourite round: open it, close it, sweep it, mark the
 * sweep done.
 *
 * Owners only, like announcing a winner, because every action here shapes who
 * that winner is. One endpoint with an action discriminator rather than five
 * routes, so the guards and the error mapping exist once and cannot drift
 * apart between the open call and the removal call.
 *
 * The rules all live in the 0046 SQL functions, which also write their own
 * audit rows. This route validates shape, forwards, and translates SQLSTATEs
 * into sentences; it never restates a rule the engine already enforces, and
 * it never logs an action twice.
 */

const openSchema = z.object({
  action: z.literal("open"),
  weekNo: z.number().int().min(1).max(4),
  /*
   * One to five here, three to five in the engine. The gap is deliberate: a
   * shortlist of one or two is refused by SQL as too_few_nominees unless the
   * override and its reason travel with it, and that refusal must come from
   * the engine so the recorded reason is what unlocked it.
   */
  entryIds: z
    .array(z.string().uuid("That is not an entry."))
    .min(1, "Pick the nominees first.")
    .max(5, "A ballot takes five nominees at most."),
  opensAt: z.string().datetime({ offset: true, message: "That is not a time." }),
  closesAt: z.string().datetime({ offset: true, message: "That is not a time." }),
  allowFew: z.boolean().optional(),
  fewReason: z.string().trim().min(1).max(300).optional(),
});

const closeSchema = z.object({
  action: z.literal("close"),
  roundId: z.string().uuid("That is not a round."),
});

const reviewSchema = z.object({
  action: z.literal("review"),
  roundId: z.string().uuid("That is not a round."),
});

const removeSchema = z.object({
  action: z.literal("remove"),
  voteId: z.string().uuid("That is not a vote."),
  reason: z
    .string()
    .trim()
    .min(1, "A removal needs a reason.")
    .max(300, "Keep the reason under three hundred characters."),
  mode: z.enum(["fraud", "unsweep"]),
});

const releaseSchema = z.object({
  action: z.literal("release"),
  voteId: z.string().uuid("That is not a vote."),
});

/*
 * Find the votes one address cast, so a reviewer can act on a vote they
 * already know about. The cluster panels cover "who looks suspicious"; this
 * covers the rehearsal vote the runbook says to remove, which comes from a
 * consumer inbox and is therefore filtered out of the domain signals.
 */
const lookupSchema = z.object({
  action: z.literal("lookup"),
  roundId: z.string().uuid("That is not a round."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That is not an email address.")
    .max(320),
});

const schema = z.discriminatedUnion("action", [
  openSchema,
  closeSchema,
  reviewSchema,
  removeSchema,
  releaseSchema,
  lookupSchema,
]);

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, string> = {
  P0810: "A ballot takes five nominees at most. Drop one and try again.",
  P0811:
    "A ballot needs at least three nominees. If the week genuinely produced fewer, use the override and record why.",
  P0812:
    "One of those entries is not an approved entry of this week's challenge. Reload the list and pick again.",
  P0813: "That round does not exist.",
  P0814: "That round is not open.",
  P0815: "That nominee is not on this ballot.",
  P0818: "Say whether the removal is fraud or an unsweep.",
  P0819:
    "That vote is not there any more, or is not held. Reload to see the current list.",
  P0820: "Close the round before marking the review complete.",
  /* Deliberately vague about the instant: the exact deadline depends on the
     round and is filled in below, because the engine measures from the
     SCHEDULED close and this message used to imply it measured from the
     button. See the P0821 block in the catch. */
  P0821:
    "Codes sent before the close can still be redeemed for fifteen minutes past the round's scheduled closing time. Wait for that window to pass, then mark the review complete: certifying now would certify a board that can still move.",
  P0908: "The vote has to close after it opens. Check the window.",
  P0502: "A removal needs a reason.",
  P0401: "Only a signed-in admin can do this.",
  P0002: "That campaign does not exist.",
  /* The one_round_per_week index, for two owners opening the same Sunday. */
  "23505": "This week already has a round. Reload to see it.",
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
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Check the request.",
      },
      { status: 400 },
    );
  }

  const action = parsed.data;
  const adminId = admin.admin.adminId;

  try {
    if (action.action === "open") {
      /*
       * A uuid[] built element by element, because the HTTP driver has no
       * reliable serialisation for a bare JavaScript array parameter and a
       * wrong guess here would fail only in production.
       */
      const entryIdList = sql.join(
        action.entryIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      const result = await getDb().execute(
        sql`SELECT * FROM open_vote_round(
              ${MONICA_SLUG}, ${action.weekNo}::smallint,
              ${action.opensAt}::timestamptz, ${action.closesAt}::timestamptz,
              ARRAY[${entryIdList}]::uuid[], ${adminId}::uuid,
              ${action.allowFew ?? false}::boolean,
              ${action.fewReason ?? null}::text
            )`,
      );
      const row = (result.rows?.[0] ?? {}) as { round_id?: string };

      /*
       * Tell the nominees they are on the ballot, after the round exists
       * and never in its way. The vote is theirs to campaign in, and a
       * shortlist nobody was told about is a page their audiences never
       * hear of. Three to five sends, each fail-soft: a lost mail leaves
       * the ballot public and the console showing the round regardless.
       */
      try {
        const entryIdListAgain = sql.join(
          action.entryIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        );
        const nominees = await getDb().execute(sql`
          SELECT c.email, c.full_name
            FROM challenge_entries ce
            JOIN campaign_creators cc ON cc.id = ce.campaign_creator_id
            JOIN creators c           ON c.id = cc.creator_id
           WHERE ce.id IN (${entryIdListAgain})
        `);
        /* Together, not one after another: five sequential sends against a
           slow provider is five times one timeout, and the round is
           already committed by the time they run. */
        await Promise.allSettled(
          (nominees.rows ?? []).map((nominee) => {
            const person = nominee as { email?: string; full_name?: string };
            if (!person.email) return Promise.resolve();
            return sendEmailQuietly(
              shortlistEmail({
                to: person.email,
                fullName: person.full_name ?? "",
                weekNo: action.weekNo,
                closesAtLagos: closingAt(action.closesAt),
                opensAtLagos:
                  new Date(action.opensAt).getTime() > Date.now()
                    ? closingAt(action.opensAt)
                    : undefined,
                votingUrl: votingPage(),
              }),
              "shortlist notice",
            );
          }),
        );
      } catch (error) {
        logError("admin/vote-round shortlist mail", error);
      }

      return NextResponse.json({ ok: true, roundId: row.round_id ?? null });
    }

    if (action.action === "close") {
      await getDb().execute(
        sql`SELECT close_vote_round(${adminId}::uuid, ${action.roundId}::uuid)`,
      );
      return NextResponse.json({ ok: true });
    }

    if (action.action === "review") {
      await getDb().execute(
        sql`SELECT mark_round_reviewed(${adminId}::uuid, ${action.roundId}::uuid)`,
      );
      return NextResponse.json({ ok: true });
    }

    if (action.action === "lookup") {
      /* A read. No audit row and no state change: it answers a question the
         console could already answer for held votes and simply could not
         for the rest. */
      const votes = await findVotesByEmail(action.roundId, action.email);
      return NextResponse.json({
        ok: true,
        votes: votes.map((v) => ({
          voteId: v.voteId,
          email: v.email,
          createdAt: v.createdAt.toISOString(),
          held: v.held,
        })),
      });
    }

    if (action.action === "remove") {
      await getDb().execute(
        sql`SELECT remove_vote(
              ${adminId}::uuid, ${action.voteId}::uuid,
              ${action.reason}::text, ${action.mode}::text
            )`,
      );
      return NextResponse.json({ ok: true });
    }

    await getDb().execute(
      sql`SELECT release_vote(${adminId}::uuid, ${action.voteId}::uuid)`,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;

    /*
     * Name the actual deadline.
     *
     * verify_vote honours a code for fifteen minutes past closes_at, and
     * mark_round_reviewed refuses until that same instant. Closing early
     * does not move it: close at five against a six o'clock scheduled
     * close and the wait is until 18:15, not 17:15. The old message said
     * "fifteen minutes after the close", so an owner pressing the button
     * at 17:16, 17:31 and 17:46 was told the same fifteen minutes each
     * time, with nothing on screen connecting the wait to the round's
     * window, and no way to amend that window either.
     */
    if (code === "P0821" && known && action.action === "review") {
      try {
        const when = await getDb().execute(sql`
          SELECT closes_at + interval '15 minutes' AS ready
            FROM vote_rounds WHERE id = ${action.roundId}::uuid
        `);
        const ready = (when.rows?.[0] as { ready?: string } | undefined)?.ready;
        if (ready) {
          return NextResponse.json(
            {
              ok: false,
              message: `${known} That is ${closingAt(String(ready))}, Lagos time.`,
            },
            { status: 400 },
          );
        }
      } catch {
        // Fall through to the message without the instant, which is still
        // truthful. A failed read here must not turn a refusal into a 500.
      }
    }

    if (known) {
      return NextResponse.json({ ok: false, message: known }, { status: 400 });
    }

    logError("admin/vote-round", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
