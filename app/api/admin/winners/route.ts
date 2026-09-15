import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { MONICA_SLUG, monicaWeeklyPrizes } from "@/lib/campaigns";
import { sendEmail, sendEmailQuietly } from "@/lib/email/client";
import {
  nomineeResultEmail,
  personalPage,
  votingPage,
  winnerEmail,
} from "@/lib/email/templates";
import { campaignCreators, creators } from "@/lib/db/client";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Choose, and announce, a weekly winner.
 *
 * Owners only. This is the one admin action that commits prize money to a named
 * person, and unlike approving an entry it is not recomputed from anything: the
 * row is the decision. That makes it the second place the owner and reviewer
 * distinction is actually used, after pausing.
 *
 * Drafting and publishing are the same call with a flag, because the Saturday
 * choice and the Sunday announcement are one decision made at two moments, and
 * splitting them into two endpoints would be two places for the no-repeat rule
 * to be got wrong.
 */

const CATEGORIES = ["creator_of_week", "community_favourite"] as const;

const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  creator_of_week: "Creator of the Week",
  community_favourite: "Community Favourite",
};

const schema = z.object({
  weekNo: z.number().int().min(1).max(4),
  category: z.enum(CATEGORIES),
  enrolmentId: z.string().uuid("That is not a creator."),
  prizeNaira: z
    .number()
    .int()
    .positive("A prize has to be a positive amount.")
    .max(5_000_000, "That is more than the whole pool."),
  note: z.string().trim().max(300).optional(),
  publish: z.boolean(),
}).superRefine((value, ctx) => {
  /*
   * The amount is the advertised amount, exactly. The pool is derived from
   * these figures everywhere else, the rules publish them, and the flat
   * 5,000,000 ceiling still let a fat-fingered 3,000,000 publish straight
   * onto the winners page. A deliberate change to the prize structure is a
   * change to lib/campaigns.ts, not a number typed on a Sunday night.
   */
  const advertised = monicaWeeklyPrizes.find(
    (prize) =>
      (value.category === "creator_of_week") ===
      (prize.label === "Creator of the Week"),
  );
  if (advertised && value.prizeNaira !== advertised.amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["prizeNaira"],
      message: `${advertised.label} is ${advertised.amount.toLocaleString("en-NG")} naira this campaign. To change the prize structure, change the campaign registry.`,
    });
  }
});

const FORBIDDEN = NextResponse.json(
  { ok: false, message: "Not allowed." },
  { status: 403 },
);

const MESSAGES: Record<string, string> = {
  P0801:
    "That creator has already been Creator of the Week. The rules say it cannot go to the same person twice, so pick somebody else. Community Favourite has no such limit.",
  P0802:
    "This week's winner in that category is already published. A published winner cannot be changed from here.",
  P0803: "That creator has been removed from the campaign and cannot win.",
  P0804:
    "Record the standings for this week before announcing. The announcement commits money against the frozen board.",
  P0805:
    "This week's vote is not settled. Close the round, sweep suspicious votes, and mark the review complete, then announce.",
  P0806:
    "The vote decided this one, and that is not the winner. The tally names the Community Favourite; to dispute the result, remove fraudulent votes in the round review and the tally changes with it.",
  P0807:
    "With no countable votes, the Community Favourite is picked from the shortlist people were shown. That creator was not on it.",
  P0201: "That creator is not in this campaign.",
  P0401: "Only a signed-in admin can do this.",
  P0002: "That campaign does not exist.",
  P0808: "There is no draft to discard for that week and category.",
};

const discardSchema = z.object({
  weekNo: z.number().int().min(1).max(4),
  category: z.enum(CATEGORIES),
});

/**
 * Discard a saved draft. Owners only, same as saving one: the draft is a
 * provisional money decision, and removing it is part of making it.
 * Publishing stays immutable; the engine refuses a published slot by name.
 */
export async function DELETE(request: NextRequest) {
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

  const parsed = discardSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  try {
    await getDb().execute(
      sql`SELECT discard_winner_draft(
            ${MONICA_SLUG}, ${parsed.data.weekNo}::smallint,
            ${parsed.data.category}::winner_category, ${admin.admin.adminId}::uuid
          )`,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;
    if (known) {
      return NextResponse.json({ ok: false, message: known }, { status: 400 });
    }
    logError("admin/winners discard", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}

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
        message: parsed.error.issues[0]?.message ?? "Check the winner.",
      },
      { status: 400 },
    );
  }

  const { weekNo, category, enrolmentId, prizeNaira, note, publish } =
    parsed.data;

  try {
    const result = await getDb().execute(
      sql`SELECT * FROM publish_weekly_winner(
            ${MONICA_SLUG}, ${weekNo}::smallint, ${category}::winner_category,
            ${enrolmentId}::uuid, NULL, ${prizeNaira}::integer,
            ${note ?? null}::text, ${admin.admin.adminId}::uuid, ${publish}::boolean
          )`,
    );
    const row = (result.rows?.[0] ?? {}) as { published?: boolean };

    /*
     * The winner hears when it is PUBLISHED, never for a draft: a draft can
     * be changed and an email cannot. The announcement stands whatever the
     * mail does, but the result now travels back to the console instead of
     * dying in a log: a naira-prize winner who never heard is a failure the
     * person announcing should see on the spot, not on Monday.
     */
    let emailed: boolean | null = null;
    let winnerName = "";
    if (publish && Boolean(row.published)) {
      const who = await getDb()
        .select({ email: creators.email, fullName: creators.fullName })
        .from(campaignCreators)
        .innerJoin(creators, eq(creators.id, campaignCreators.creatorId))
        .where(eq(campaignCreators.id, enrolmentId))
        .limit(1)
        .catch(() => []);
      const winner = who[0];
      if (winner) {
        winnerName = winner.fullName;
        const sent = await sendEmail(
          winnerEmail({
            to: winner.email,
            fullName: winner.fullName,
            weekNo,
            categoryLabel: CATEGORY_LABEL[category as (typeof CATEGORIES)[number]],
            prizeNaira,
            personalPage: personalPage(),
          }),
        );
        emailed = sent.sent;
        if (!sent.sent) {
          logError(
            "admin/winners",
            new Error(`winner mail week ${weekNo} not sent: ${sent.reason ?? ""}`),
          );
        }
      } else {
        emailed = false;
      }
    }

    /*
     * A Community Favourite publish also closes a public contest, and the
     * nominees who campaigned and did not win find out from this or from
     * silence. Fail-soft: the result is public either way.
     */
    if (
      publish &&
      Boolean(row.published) &&
      category === "community_favourite" &&
      winnerName
    ) {
      try {
        const others = await getDb().execute(sql`
          SELECT c.email, c.full_name
            FROM vote_rounds r
            JOIN vote_round_nominees n ON n.round_id = r.id
            JOIN challenge_entries ce  ON ce.id = n.entry_id
            JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
            JOIN creators c            ON c.id = cc.creator_id
            JOIN campaigns cp          ON cp.id = r.campaign_id
           WHERE cp.slug = ${MONICA_SLUG}
             AND r.week_no = ${weekNo}
             AND n.withdrawn_at IS NULL
             AND cc.id <> ${enrolmentId}::uuid
        `);
        for (const other of others.rows ?? []) {
          const person = other as { email?: string; full_name?: string };
          if (!person.email) continue;
          await sendEmailQuietly(
            nomineeResultEmail({
              to: person.email,
              fullName: person.full_name ?? "",
              weekNo,
              winnerName,
              votingUrl: votingPage(),
            }),
            "nominee result notice",
          );
        }
      } catch (error) {
        logError("admin/winners nominee result mail", error);
      }
    }

    return NextResponse.json({
      ok: true,
      published: Boolean(row.published),
      emailed,
    });
  } catch (error) {
    const code = pgErrorCode(error);
    const known = code ? MESSAGES[code] : undefined;

    if (known) {
      return NextResponse.json({ ok: false, message: known }, { status: 400 });
    }

    logError("admin/winners", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong at our end." },
      { status: 500 },
    );
  }
}
