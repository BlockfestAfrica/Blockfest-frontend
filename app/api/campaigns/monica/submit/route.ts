import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { campaigns, challenges, getDb } from "@/lib/db/client";
import { currentCreator } from "@/lib/creator-session";
import { pauseState } from "@/lib/campaign-pause";
import { isPgError, PG, pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import {
  authorFromUrl,
  canonicalUrl,
  submissionSchema,
} from "@/lib/campaign-submission";
import {
  CAMPAIGN_GATE_FORCED_OPEN,
  MONICA_SLUG,
  type CampaignPlatform,
} from "@/lib/campaigns";

export const runtime = "nodejs";

/** A link and a platform name. Anything larger is not a submission. */
const MAX_BODY_BYTES = 4 * 1024;

function fail(message: string, status = 400, field?: string) {
  return NextResponse.json({ ok: false, message, field }, { status });
}

/**
 * Submitting an entry.
 *
 * Identity comes from the session cookie and nothing else. The creator does not
 * say who they are and cannot: there is no id in the request body to tamper
 * with, so there is no version of this where somebody submits as somebody else.
 *
 * The challenge is chosen by the server too, not sent by the client. A creator
 * submits to "the week that is open", and which week that is has one answer at
 * any moment. Letting the client name a challenge would mean validating that
 * choice anyway, and the failure mode of getting it wrong is an entry filed
 * against the wrong week, which is invisible until results are published.
 *
 * Everything that decides whether the submission is legal lives in
 * submit_entry: the window, the registered platform, one entry per creator per
 * week, one submission per platform, and one live submission per URL. It is one
 * function because the driver has no interactive transactions and the checks
 * would otherwise race each other.
 */
export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail("That request is too large.", 413);

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return fail("That request is too large.", 413);
    }
    body = JSON.parse(raw);
  } catch {
    return fail("We could not read that. Please try again.");
  }

  const creator = await currentCreator();
  if (!creator) {
    return fail(
      "We do not know who you are. Open your personal link and try again.",
      401,
    );
  }

  const paused = await pauseState();
  if (paused.paused) {
    return fail(
      paused.reason ?? "Submissions are paused. Please try again shortly.",
      503,
    );
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(
      first?.message ?? "Please check the form.",
      400,
      String(first?.path?.[0] ?? ""),
    );
  }

  const db = getDb();

  // The week that is open right now. All four are published, so the dates are
  // what decide, and the same comparison runs again inside submit_entry.
  const open = await db
    .select({ id: challenges.id, title: challenges.title })
    .from(challenges)
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .where(
      and(
        eq(campaigns.slug, MONICA_SLUG),
        eq(challenges.status, "active"),
        lte(challenges.startsAt, new Date()),
        gt(challenges.endsAt, new Date()),
      ),
    )
    .limit(1);

  let challenge = open[0];

  // Before launch there is no open week, and the flow still has to be walkable
  // end to end. When the campaign gate is deliberately forced open, the next
  // week is offered instead. This is read from the server's own environment,
  // so nothing a client sends can reach it, and after 14 September a week is
  // open continuously until 17 October, which makes this branch unreachable.
  if (!challenge && CAMPAIGN_GATE_FORCED_OPEN) {
    const upcoming = await db
      .select({ id: challenges.id, title: challenges.title })
      .from(challenges)
      .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
      .where(
        and(
          eq(campaigns.slug, MONICA_SLUG),
          eq(challenges.status, "active"),
          gt(challenges.startsAt, new Date()),
        ),
      )
      .orderBy(asc(challenges.startsAt))
      .limit(1);
    challenge = upcoming[0];
  }

  if (!challenge) {
    return fail(
      "No challenge is open right now. The next brief opens on Monday.",
      409,
    );
  }

  // Canonicalised before it is stored, so the same post submitted by two people
  // collides on the uniqueness index rather than slipping past it because one
  // share sheet appended a tracking parameter.
  const url = canonicalUrl(parsed.data.url);

  // Read from the URL here, never taken from the request. X and TikTok carry
  // the author in the path; Instagram does not and yields null, which the
  // function reads as "nothing to compare" rather than "no check needed".
  const author = authorFromUrl(url, parsed.data.platform as CampaignPlatform);

  try {
    const result = await db.execute(sql`
      SELECT * FROM submit_entry(
        ${creator.enrolmentId}, ${challenge.id}, ${parsed.data.platform}, ${url},
        ${CAMPAIGN_GATE_FORCED_OPEN}, ${author}
      )
    `);

    const row = (result.rows?.[0] ?? {}) as { entry_id?: string };

    return NextResponse.json({
      ok: true,
      challenge: challenge.title,
      platform: parsed.data.platform,
      url,
      entryId: row.entry_id ?? null,
    });
  } catch (error) {


    // Raised deliberately by the function, so the creator can be told the one
    // thing they need to change rather than "something went wrong".
    if (isPgError(error, PG.ENROLMENT_NOT_ACTIVE, "enrolment_not_active")) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This account cannot enter the campaign. If you think that is a mistake, write to partnership@blockfestafrica.com from the address you registered with.",
        },
        { status: 403 },
      );
    }

    if (isPgError(error, PG.WRONG_ACCOUNT, "wrong_account")) {
      return fail(
        "That post is not from the account you registered. Entries have to come from an account you listed when you joined.",
        409,
        "url",
      );
    }
    if (isPgError(error, PG.PLATFORM_NOT_REGISTERED, "platform_not_registered")) {
      return fail(
        "You did not register that account. Entries have to come from an account you listed when you joined.",
        409,
        "platform",
      );
    }
    if (isPgError(error, PG.ALREADY_SUBMITTED_FOR_PLATFORM, "already_submitted_for_platform")) {
      return fail(
        "You have already submitted on that platform for this challenge.",
        409,
        "platform",
      );
    }
    if (isPgError(error, PG.URL_ALREADY_SUBMITTED, "url_already_submitted")) {
      return fail(
        "That link has already been submitted. If it is your post, get in touch.",
        409,
        "url",
      );
    }
    if (isPgError(error, PG.CHALLENGE_NOT_OPEN, "challenge_not_open")) {
      return fail("That challenge has not opened yet.", 409);
    }
    if (
      isPgError(error, PG.CHALLENGE_ENDED, "challenge_ended") ||
      isPgError(error, PG.CHALLENGE_CLOSED, "challenge_closed")
    ) {
      return fail("That challenge has closed.", 409);
    }
    if (pgErrorMessage(error).includes("submission_url_is_http")) {
      return fail("The link has to start with https://", 400, "url");
    }

    // Logged with the SQLSTATE, because that is what a mapping is keyed on
    // and a message alone did not distinguish these at all.
    console.error(
      "[campaign/submit] unmapped",
      pgErrorCode(error),
      pgErrorMessage(error),
    );
    return fail("Something went wrong at our end. Please try again.", 500);
  }
}
