import { sendEmailQuietly } from "@/lib/email/client";
import { personalLink, registrationEmail } from "@/lib/email/templates";
import { randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { campaigns, getDb, registrationAttempts } from "@/lib/db/client";
import {
  canonicalise,
  looksAutomated,
  REFERRAL_COOKIE,
  registrationSchema,
} from "@/lib/campaign-registration";
import { CAMPAIGN_GATE_FORCED_OPEN, MONICA_SLUG } from "@/lib/campaigns";
import { isPgError, PG, pgErrorCode, pgErrorMessage } from "@/lib/db/errors";
import { pauseState } from "@/lib/campaign-pause";
import { hashAccessToken, newAccessToken } from "@/lib/creator-access";

/** postgres.js and the Neon driver need sockets; neither runs on the edge. */
export const runtime = "nodejs";

/**
 * How many attempts one address may make in a rolling hour.
 *
 * Set high on purpose. This exists to bound automated probing of the "already
 * registered" messages, not to ration registrations, and a limit in the
 * hundreds bounds a script just as well as a tight one. What a tight one also
 * does is turn away real creators: Nigerian mobile carriers put very large
 * numbers of subscribers behind each egress address, so every creator on a
 * carrier shares one number here, while anyone with a VPN simply changes
 * address and is unaffected. The honeypot and the timing floor are what
 * actually carry the load.
 */
const ATTEMPTS_PER_HOUR = 300;

/** Short, unambiguous, and safe to read aloud over a voice note. */
function newReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0, no I/1
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function fail(message: string, status = 400, field?: string) {
  return NextResponse.json({ ok: false, message, field }, { status });
}

/**
 * Creator registration.
 *
 * The checks here are the real ones. The form validates the same rules in the
 * browser so a creator is told about a typo without a round trip, but none of
 * that is trusted: everything arriving here is parsed again, and the two checks
 * that actually protect the campaign have no client-side counterpart at all.
 *
 * The first is the opening date. The landing page renders a locked control
 * before the campaign starts, and that is a courtesy, not a gate. Anyone who
 * reads the page source knows this URL. Registering early would take a
 * referral code before the referral programme exists and put a creator on the
 * board before the first challenge, so it is refused here.
 *
 * The second is identity. Uniqueness is enforced by the database on canonical
 * forms, not by a lookup in this handler, because a lookup followed by an
 * insert is two statements with a gap between them, and two requests arriving
 * inside that gap both pass. The constraint cannot be raced. So the insert is
 * attempted and a unique violation is translated into something a person can
 * act on.
 */
export async function POST(request: NextRequest) {
  /**
   * A registration is well under a kilobyte. Anything larger is not a form.
   *
   * The App Router has no body size limit for route handlers: the
   * bodyParser.sizeLimit option belongs to the Pages Router, and
   * experimental.serverActions.bodySizeLimit covers Server Actions only. So
   * without this, request.json() will buffer whatever is sent into the memory
   * of a serverless function, which is a cheap way to make the endpoint
   * expensive. Content-Length is checked first because it rejects the common
   * case without reading anything, and the body is measured again after
   * reading because that header is advisory and can simply be wrong.
   */
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
    return fail("We could not read that. Please try again.");
  }

  const db = getDb();

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(
      first?.message ?? "Please check the form.",
      400,
      String(first?.path?.[0] ?? ""),
    );
  }
  const input = parsed.data;
  const { emailCanonical, phoneE164, handles } = canonicalise(input);

  // Automated submissions are answered as though they succeeded. A bot told
  // which check it failed is a bot whose author knows what to change, and one
  // told nothing at all simply retries. Nothing is written, and the reason is
  // logged rather than returned.
  const automated = looksAutomated(input);
  if (automated) {
    console.warn("[campaign/register] rejected as automated:", automated);
    return NextResponse.json({
      ok: true,
      referralCode: null,
      name: input.fullName,
    });
  }

  // Netlify sets its own header; x-forwarded-for is the fallback and its first
  // entry is the client. Never trusted for anything but rate limiting and
  // review, because it is trivially spoofed.
  const ip =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.slug, MONICA_SLUG),
  });
  if (!campaign) return fail("That campaign does not exist.", 404);

  // The gate. Held server-side because the client one is only a courtesy.
  //
  // ?preview=open lifts it while developing. It is guarded on NODE_ENV, not on
  // a secret, so on a production build the condition is false before the
  // request is even read and no query string can reach past it. That is the
  // point: a bypass worth protecting is a bypass worth attacking.
  const preview =
    process.env.NODE_ENV !== "production" &&
    request.nextUrl.searchParams.get("preview") === "open";

  // CAMPAIGN_GATE_FORCED_OPEN is the deliberate pre-launch opening, set to work
  // through the real flow against the real database. Logged on every request it
  // admits, because a gate that is open for a reason still needs to be visible
  // in the logs of the days it was open.
  const gateOpen = preview || CAMPAIGN_GATE_FORCED_OPEN;

  if (
    CAMPAIGN_GATE_FORCED_OPEN &&
    campaign.startsAt &&
    campaign.startsAt.getTime() > Date.now()
  ) {
    console.warn(
      "[campaign/register] registering before the campaign opens: NEXT_PUBLIC_CAMPAIGN_GATE_OPEN is set",
    );
  }

  if (
    !gateOpen &&
    campaign.startsAt &&
    campaign.startsAt.getTime() > Date.now()
  ) {
    return fail(
      "Entries are not open yet. Come back when the campaign starts.",
      403,
    );
  }
  if (!gateOpen && campaign.status !== "active") {
    return fail("This campaign is not accepting registrations.", 403);
  }

  // The pause, checked after the date gate and before anything is written.
  // Not lifted by the pre-launch override: that exists to let the flow be
  // walked, and a pause is somebody deliberately stopping it.
  const paused = await pauseState();
  if (paused.paused) {
    return fail(
      paused.reason ?? "Registration is paused. Please try again shortly.",
      503,
    );
  }

  // A ceiling on how fast one address can register, counting ATTEMPTS rather
  // than successes.
  //
  // This used to count rows in `creators`, which meant only registrations that
  // succeeded consumed any budget. Every rejection was free, so the messages
  // that name which field is already taken could be probed without limit to
  // learn whether a given email, phone or handle belongs to somebody.
  //
  // See ATTEMPTS_PER_HOUR for why the ceiling is where it is.
  const recordAttempt = (outcome: string) =>
    db
      .insert(registrationAttempts)
      .values({ ip, outcome })
      .catch(() => {
        // Rate-limit bookkeeping must never be the reason a genuine
        // registration fails.
      });

  if (ip) {
    const recent = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(registrationAttempts)
      .where(
        and(
          eq(registrationAttempts.ip, ip),
          gt(
            registrationAttempts.createdAt,
            new Date(Date.now() - 60 * 60 * 1000),
          ),
        ),
      );
    if ((recent[0]?.n ?? 0) >= ATTEMPTS_PER_HOUR) {
      // Deliberately does NOT record an attempt.
      //
      // Recording one here made the counter feed itself: once an address
      // crossed the line, every retry from anyone behind it wrote another row
      // and pushed the newest timestamp forward, so the window could not drain
      // while people kept trying. The message says "try again later", which is
      // exactly what kept them locked out. A blocked window now expires on its
      // own an hour after the last real attempt.
      return fail(
        "Too many registration attempts from this connection in the last hour. Try again later.",
        429,
      );
    }
  }

  // The referral code arrives as a cookie from /join. It is passed straight
  // through to the database function, which resolves it, ignores one that
  // belongs to nobody, and ignores one that belongs to the person registering.
  const ref = request.cookies.get(REFERRAL_COOKIE)?.value?.trim() ?? "";

  // Minted here and returned once. Only its hash is stored, so this value
  // cannot be recovered later by us or by anybody who reads the database.
  const accessToken = newAccessToken();

  try {
    // One round trip, one transaction. This was four separate inserts over a
    // driver with no interactive transactions, which meant the creators row
    // committed before the handle rows were attempted: a collision on the
    // second left the first behind, holding an email and a phone number that
    // could never be released. Sending somebody else's email together with a
    // handle already taken was enough to stop that person registering.
    const result = await db.execute(sql`
      SELECT * FROM register_creator(
        ${MONICA_SLUG},
        ${input.fullName}, ${input.email}, ${emailCanonical},
        ${input.phone}, ${phoneE164}, ${input.contentNiche},
        ${input.audienceSize ?? null}, ${input.location ?? null},
        ${handles.x}, ${handles.instagram}, ${handles.tiktok},
        ${ref || null}, ${ip}, ${userAgent},
        ${newReferralCode()}, ${input.rulesVersion},
        ${input.marketingOptIn}, ${input.privacyVersion ?? null},
        ${hashAccessToken(accessToken)}
      )
    `);

    await recordAttempt("registered");

    const row = (result.rows?.[0] ?? {}) as {
      referral_code?: string;
      full_name?: string;
    };

    const referralCode = row.referral_code ?? null;

    /*
     * The email that makes the link recoverable.
     *
     * Until now the token was shown once on the success screen and the creator
     * was told to save it. That plan fails for the ordinary reason that people
     * close tabs, and the owner raised exactly this after testing: what happens
     * when they lose it. An email is the copy that survives the tab.
     *
     * Awaited rather than fired and forgotten. A serverless function can be
     * frozen the moment it returns a response, so an unawaited fetch is a mail
     * that silently never leaves. Ten seconds at worst, and sendEmailQuietly
     * swallows every failure: the registration has already committed, so
     * nothing the creator sees depends on the mail going.
     */
    if (referralCode) {
      await sendEmailQuietly(
        registrationEmail({
          to: input.email,
          fullName: row.full_name ?? input.fullName,
          personalLink: personalLink(accessToken),
          referralCode,
        }),
        `registration for ${emailCanonical}`,
      );
    }

    return NextResponse.json({
      ok: true,
      referralCode,
      name: row.full_name ?? input.fullName,
      // Still shown once on the success screen as well as emailed. The screen
      // is what somebody uses in the next thirty seconds; the email is what
      // they come back to in a week.
      accessToken,
    });
  } catch (error) {


    // The function raises these deliberately, so the field a person has to
    // change can be named without reading constraint names out of a driver
    // error. Every one of them rolled the whole registration back.
    await recordAttempt("failed");

    if (isPgError(error, PG.EMAIL_TAKEN, "email_taken")) {
      return fail("That email address is already registered.", 409, "email");
    }
    if (isPgError(error, PG.PHONE_TAKEN, "phone_taken")) {
      return fail("That phone number is already registered.", 409, "phone");
    }
    if (isPgError(error, PG.CAMPAIGN_NOT_FOUND, "campaign_not_found")) {
      return fail("That campaign does not exist.", 404);
    }
    if (/social_handle_one_per_creator_platform/.test(pgErrorMessage(error))) {
      return fail("You can only add one account per platform.", 400, "x");
    }

    console.error(
      "[campaign/register] unmapped",
      pgErrorCode(error),
      pgErrorMessage(error),
    );
    return fail("Something went wrong at our end. Please try again.", 500);
  }
}
