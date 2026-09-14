import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { readJsonBody, sameOrigin } from "@/lib/admin/request";
import { pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { logError } from "@/lib/log";
import { MONICA_SLUG, monicaWeeklyPrizes } from "@/lib/campaigns";
import { sendEmailQuietly } from "@/lib/email/client";
import { personalPage, winnerEmail } from "@/lib/email/templates";
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
  P0201: "That creator is not in this campaign.",
  P0401: "Only a signed-in admin can do this.",
  P0002: "That campaign does not exist.",
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
     * be changed and an email cannot. Quietly, because the public page is
     * live either way and a mail failure is a Monday follow-up, not a reason
     * to fail the announcement.
     */
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
        await sendEmailQuietly(
          winnerEmail({
            to: winner.email,
            fullName: winner.fullName,
            weekNo,
            categoryLabel: CATEGORY_LABEL[category as (typeof CATEGORIES)[number]],
            prizeNaira,
            personalPage: personalPage(),
          }),
          `winner announcement week ${weekNo}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      published: Boolean(row.published),
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
