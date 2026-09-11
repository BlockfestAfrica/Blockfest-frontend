import { randomBytes } from "node:crypto";
import { and, eq, gt, or, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import {
  campaignCreators,
  campaigns,
  creators,
  creatorSocialHandles,
  getDb,
  referrals,
} from "@/lib/db/client";
import {
  canonicalise,
  looksAutomated,
  REFERRAL_COOKIE,
  registrationSchema,
} from "@/lib/campaign-registration";
import { MONICA_SLUG } from "@/lib/campaigns";

/** postgres.js and the Neon driver need sockets; neither runs on the edge. */
export const runtime = "nodejs";

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
  let body: unknown;
  try {
    body = await request.json();
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

  if (
    !preview &&
    campaign.startsAt &&
    campaign.startsAt.getTime() > Date.now()
  ) {
    return fail(
      "Entries are not open yet. Come back when the campaign starts.",
      403,
    );
  }
  if (!preview && campaign.status !== "active") {
    return fail("This campaign is not accepting registrations.", 403);
  }

  // A ceiling on how fast one address can register, deliberately generous.
  // Nigerian mobile carriers put very large numbers of subscribers behind few
  // addresses, so a tight per-IP limit would turn away real creators sharing a
  // carrier NAT while barely inconveniencing anyone with a VPN. This is here to
  // stop a runaway script, not to identify people, and the honeypot and timing
  // checks above are what actually carry the load.
  if (ip) {
    const recent = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(creators)
      .where(
        and(
          eq(creators.registrationIp, ip),
          gt(creators.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
        ),
      );
    if ((recent[0]?.n ?? 0) >= 15) {
      return fail(
        "Too many registrations from this connection in the last hour. Try again later.",
        429,
      );
    }
  }

  // Who sent them, if anyone. An unknown code is discarded rather than
  // rejected: the visitor did nothing wrong and should not be blocked by
  // somebody else's bad link.
  const ref = request.cookies.get(REFERRAL_COOKIE)?.value?.trim() ?? "";
  const referrer = ref
    ? await db.query.campaignCreators.findFirst({
        where: and(
          eq(campaignCreators.campaignId, campaign.id),
          eq(campaignCreators.referralCode, ref),
        ),
      })
    : undefined;

  // Self-referral, caught before the insert because the identifiers are the
  // same person's rather than a database-level clash.
  if (referrer) {
    const self = await db.query.creators.findFirst({
      where: or(
        eq(creators.emailCanonical, emailCanonical),
        eq(creators.phoneE164, phoneE164),
      ),
    });
    if (self && self.id === referrer.creatorId) {
      return fail("You cannot refer yourself.", 400, "ref");
    }
  }

  try {
    const [creator] = await db
      .insert(creators)
      .values({
        fullName: input.fullName,
        email: input.email,
        emailCanonical,
        phone: input.phone,
        phoneE164,
        contentNiche: input.contentNiche,
        audienceSize: input.audienceSize ?? null,
        location: input.location ?? null,
        registrationIp: ip,
        registrationUserAgent: userAgent,
      })
      .returning();

    const entries = Object.entries(handles).filter(([, v]) => v) as [
      "x" | "instagram" | "tiktok",
      string,
    ][];
    if (entries.length > 0) {
      await db.insert(creatorSocialHandles).values(
        entries.map(([platform, handle]) => ({
          creatorId: creator.id,
          platform,
          handle,
          handleNormalized: handle,
        })),
      );
    }

    const [enrolment] = await db
      .insert(campaignCreators)
      .values({
        campaignId: campaign.id,
        creatorId: creator.id,
        referralCode: newReferralCode(),
      })
      .returning();

    if (referrer && referrer.id !== enrolment.id) {
      // Recorded now, paid later. Points land only once the referred creator
      // has an approved entry, so that fifty throwaway signups are worth
      // nothing until fifty real pieces of content exist.
      await db.insert(referrals).values({
        campaignId: campaign.id,
        referrerCampaignCreatorId: referrer.id,
        referredCampaignCreatorId: enrolment.id,
        // The code as it was actually used, so a dispute about who referred
        // whom can be answered from the row rather than from inference.
        codeUsed: ref,
      });
    }

    return NextResponse.json({
      ok: true,
      referralCode: enrolment.referralCode,
      name: creator.fullName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Translate the constraint that fired into the field a person can fix.
    if (/social_handle_unique/.test(message)) {
      return fail(
        "One of those accounts is already registered. If it is yours, you have already entered.",
        409,
        "x",
      );
    }
    if (
      /creator_email_canonical|email/.test(message) &&
      /unique|duplicate/i.test(message)
    ) {
      return fail("That email address is already registered.", 409, "email");
    }
    if (/phone/.test(message) && /unique|duplicate/i.test(message)) {
      return fail("That phone number is already registered.", 409, "phone");
    }
    if (/unique|duplicate/i.test(message)) {
      return fail("Some of those details are already registered.", 409);
    }

    console.error("[campaign/register]", message);
    return fail("Something went wrong at our end. Please try again.", 500);
  }
}
