import { and, eq, gt, lte, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { campaigns, challenges, getDb } from "@/lib/db/client";
import { currentCreator } from "@/lib/creator-session";
import { canonicalUrl, submissionSchema } from "@/lib/campaign-submission";
import { MONICA_SLUG } from "@/lib/campaigns";

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

  const challenge = open[0];
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

  try {
    const result = await db.execute(sql`
      SELECT * FROM submit_entry(
        ${creator.enrolmentId}, ${challenge.id}, ${parsed.data.platform}, ${url}
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
    const message = error instanceof Error ? error.message : String(error);

    // Raised deliberately by the function, so the creator can be told the one
    // thing they need to change rather than "something went wrong".
    if (message.includes("platform_not_registered")) {
      return fail(
        "You did not register that account. Entries have to come from an account you listed when you joined.",
        409,
        "platform",
      );
    }
    if (message.includes("already_submitted_for_platform")) {
      return fail(
        "You have already submitted on that platform for this challenge.",
        409,
        "platform",
      );
    }
    if (message.includes("url_already_submitted")) {
      return fail(
        "That link has already been submitted. If it is your post, get in touch.",
        409,
        "url",
      );
    }
    if (message.includes("challenge_not_open")) {
      return fail("That challenge has not opened yet.", 409);
    }
    if (message.includes("challenge_ended") || message.includes("challenge_closed")) {
      return fail("That challenge has closed.", 409);
    }
    if (message.includes("submission_url_is_http")) {
      return fail("The link has to start with https://", 400, "url");
    }

    console.error("[campaign/submit]", message);
    return fail("Something went wrong at our end. Please try again.", 500);
  }
}
