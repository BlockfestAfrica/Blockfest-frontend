import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { sameOrigin } from "@/lib/admin/request";
import { looksAutomated } from "@/lib/campaign-registration";
import { pauseState } from "@/lib/campaign-pause";
import { CONTACT_EMAIL } from "@/lib/constants";
import { getDb } from "@/lib/db/client";
import { PG, pgErrorCode } from "@/lib/db/errors";
import { sendEmailQuietly } from "@/lib/email/client";
import { rovvEntryEmail } from "@/lib/email/templates";
import { logError } from "@/lib/log";
import { ROVV, ROVV_SLUG, rovvEntrySchema } from "@/lib/rovv";
import { ROVV_PRIVACY_VERSION } from "@/lib/rovv-privacy";
import { ROVV_RULES_VERSION } from "@/lib/rovv-rules";
import { allow, allowKeyStrict } from "@/lib/throttle";

/** postgres.js needs sockets; it does not run on the edge. */
export const runtime = "nodejs";

/** An entry is well under a kilobyte. Anything larger is not a form. */
const MAX_BODY_BYTES = 8 * 1024;

function fail(message: string, status = 400, field?: string) {
  return NextResponse.json({ ok: false, message, field }, { status });
}

/**
 * Why a closed window is closed, from the clock: before the start it has not
 * opened, after the end it has finished. The database decides; this only
 * picks the words.
 */
function closedMessage(): string {
  return Date.now() < new Date(ROVV.opensAt).getTime()
    ? "Entries open at midnight on Tuesday 13 October, Lagos time."
    : "Entries closed at 11:59 PM on Sunday 18 October, Lagos time.";
}

/**
 * An entry to Rovv's campaign: name, email, TikTok username, the video's link
 * and the ROVV referral code.
 *
 * The guards run in Monica's order, for Monica's reasons (her register route
 * explains each): size, same origin, JSON, then the per-address throttle, and
 * only then the body. Everything the form checks is checked again here, and
 * the rules that matter live in the database, which nothing here can race:
 * the window, the pause, one entry per email, one entry per video, and a
 * replacement only by the same TikTok username before anyone has reviewed it.
 */
export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail("That request is too large.", 413);
  if (!sameOrigin(request)) return fail("Not allowed.", 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return fail("We could not read that. Please try again.", 415);
  }
  if (!(await allow(request, "rovv-enter", 300, 3600))) {
    return fail("That is a lot of attempts from one place. Wait a few minutes and try again.", 429);
  }

  // Measured again after reading, because content-length is advisory.
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail("That request is too large.", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("We could not read that. Please try again.");
  }

  const parsed = rovvEntrySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? "Please check the form.", 400, String(first?.path?.[0] ?? ""));
  }
  const input = parsed.data;

  // The stored consent is dispute evidence, so it names the text this server
  // publishes. A stale tab re-reads and re-accepts.
  if (input.privacyVersion !== ROVV_PRIVACY_VERSION) {
    return fail(
      "The privacy notice has changed since this page loaded. Reload the page and read it before entering.",
      409,
      "privacyVersion",
    );
  }
  if (input.rulesVersion !== ROVV_RULES_VERSION) {
    return fail(
      "The rules have changed since this page loaded. Reload the page, read them again and tick the box.",
      409,
      "rulesVersion",
    );
  }

  // Answered as though it worked, so a bot learns nothing. The reason is
  // logged; the address is not, because logs are no place for one. A real
  // person caught by it gets no receipt, which is their sign to write in.
  const automated = looksAutomated(input);
  if (automated) {
    console.warn("[rovv/enter] refused as automated:", automated);
    return NextResponse.json({ ok: true, outcome: "created" });
  }

  // Read for the reason only; the database refuses a paused entry anyway.
  const paused = await pauseState(ROVV_SLUG);
  if (paused.paused) {
    return fail(paused.reason ?? "Entries are paused. Please try again shortly.", 503);
  }

  const ip =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  let outcome: "created" | "updated" | "unchanged";
  try {
    const result = await getDb().execute(sql`
      SELECT * FROM submit_rovv_entry(
        ${ROVV_SLUG}, ${input.fullName}, ${input.email}, ${input.emailCanonical},
        ${input.tiktokHandle}, ${input.tiktokUrl}, ${input.referralCode},
        ${ROVV_RULES_VERSION}, ${ROVV_PRIVACY_VERSION}, ${input.marketingOptIn},
        ${ip}, ${userAgent}
      )
    `);
    const row = (result.rows?.[0] ?? {}) as { outcome?: string };
    outcome = row.outcome === "updated" || row.outcome === "unchanged" ? row.outcome : "created";
  } catch (error) {
    switch (pgErrorCode(error)) {
      case PG.ROVV_CLOSED:
        return fail(closedMessage(), 403);
      case PG.ROVV_PAUSED:
        return fail("Entries are paused. Please try again shortly.", 503);
      case PG.ROVV_ENTRY_TAKEN:
        return fail(
          `This email address already has an entry, from another TikTok username or one the team has already reviewed. Each person enters once. If something needs changing, write to ${CONTACT_EMAIL}.`,
          409,
          "email",
        );
      case PG.ROVV_VIDEO_TAKEN:
        return fail(
          `That video is already in the campaign as somebody else's entry. If it is your video, write to ${CONTACT_EMAIL} and we will look into it.`,
          409,
          "tiktokUrl",
        );
      case PG.CAMPAIGN_NOT_FOUND:
        return fail("This campaign is not taking entries.", 404);
      default:
        logError("rovv/enter", error);
        return fail("Something went wrong on our side and your entry was not saved. Please try again.", 500);
    }
  }

  /*
   * The receipt, awaited so a serverless function does not freeze before it
   * leaves. Nothing changed means nothing to tell them.
   *
   * At most three an hour to one address, strictly (lib/throttle.ts). The
   * address is typed, never verified, and every resubmission that changes
   * the code is an "update", so without this the form would mail whatever
   * inbox a script names, from our domain, hundreds of times an hour. The
   * entry is saved either way; only the mail is skipped.
   */
  if (outcome !== "unchanged" && (await allowKeyStrict(input.emailCanonical, "rovv-receipt", 3, 3600))) {
    await sendEmailQuietly(
      rovvEntryEmail({
        to: input.email,
        fullName: input.fullName,
        tiktokUrl: input.tiktokUrl,
        referralCode: input.referralCode,
        replaced: outcome === "updated",
      }),
      outcome === "updated" ? "rovv entry updated" : "rovv entry received",
    );
  }

  return NextResponse.json({ ok: true, outcome });
}
