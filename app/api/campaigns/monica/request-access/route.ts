import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canonicalEmail } from "@/lib/campaign-registration";
import { requestAccessRecovery } from "@/lib/creator-recovery";
import { recoveryLink, recoveryRequestEmail } from "@/lib/email/templates";
import { sendEmailQuietly } from "@/lib/email/client";
import { readJsonBody, sameOrigin, throttleKey } from "@/lib/admin/request";
import { allowKeyStrict } from "@/lib/throttle";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Lost your link?" Closes #206, successor to #78.
 *
 * The one rule this route exists to hold: the answer must be exactly the
 * same sentence, in exactly the same amount of time, whether or not the
 * typed address belongs to anybody. Without that, this becomes a second
 * membership oracle of the kind the registration audit already found once
 * (#78's own history): "a link is on its way" and "nothing happened" told
 * an attacker which addresses are in the campaign in different words.
 *
 * Nothing this route does changes the working access link. It mints a
 * separate, short-lived, single-use token and mails a confirmation link;
 * the rotation itself happens only when that link is clicked and confirmed,
 * in the /recover/open and /recover/confirm routes. See lib/creator-recovery.ts.
 */

const schema = z.object({
  email: z.string().trim().min(3, "Enter your email address.").max(254),
});

/** The exact sentence, either way. Wording that differs is a second oracle. */
const UNIFORM_MESSAGE =
  "If that address is registered for Monica, a link to get back in is on its way. Check your inbox in a few minutes.";

/**
 * A floor under how fast this can possibly answer, so the two paths below,
 * one database write plus one outbound mail call versus neither, cannot be
 * told apart by a stopwatch. Set above what the slow path (an email round
 * trip to ZeptoMail) usually takes locally, so the fast path is what waits,
 * never the reverse.
 */
const TIMING_FLOOR_MS = 700;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function uniform() {
  return NextResponse.json({ ok: true, message: UNIFORM_MESSAGE });
}

export async function POST(request: NextRequest) {
  const started = Date.now();

  // Same guard the admin mutations carry: a cross-site page cannot drive a
  // signed-in visitor's browser into filing this on their behalf. It costs
  // nothing here, since the route needs no cookie to act, but there is no
  // reason to leave a state-changing POST unguarded by habit.
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, message: "Not allowed." },
      { status: 403 },
    );
  }

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
      { ok: false, message: parsed.error.issues[0]?.message ?? "Enter your email address." },
      { status: 400 },
    );
  }

  const ip = throttleKey(request);
  const emailCanonical = canonicalEmail(parsed.data.email);

  /*
   * Fails CLOSED, in both directions, deliberately unlike every other limit
   * in this codebase.
   *
   * Every other throttle guards a page view or a form that changes nothing
   * external if the limiter is briefly unmetered. This one gates a route
   * that sends mail through a paid provider to an address a stranger can
   * type. A database blip must not turn it into a mailer anybody can drive
   * without limit, so a throttle that cannot be read refuses rather than
   * allows. See allowKeyStrict.
   *
   * Keyed on the address AND the IP: an attacker cycling addresses behind
   * one connection is capped by the IP bucket, and an attacker spraying one
   * address from many connections, the actual "lock a creator out" and
   * "harvest whether X is registered" shapes, is capped by the address
   * bucket regardless of how many IPs they hold.
   */
  const ipOk = await allowKeyStrict(ip, "recover-request-ip", 20, 3600);
  const addressOk = await allowKeyStrict(
    emailCanonical,
    "recover-request-address",
    5,
    3600,
  );

  if (!ipOk || !addressOk) {
    // The throttled answer is also uniform and unrelated to registration,
    // so it costs the oracle nothing to observe: it fires the same way for
    // an address that exists and one that does not.
    await sleep(Math.max(0, TIMING_FLOOR_MS - (Date.now() - started)));
    return uniform();
  }

  try {
    const found = await requestAccessRecovery(parsed.data.email);

    if (found) {
      await sendEmailQuietly(
        recoveryRequestEmail({
          to: found.target.email,
          fullName: found.target.name,
          confirmLink: recoveryLink(found.token),
        }),
        "recovery request",
      );
    }
  } catch (error) {
    // A database or mail failure here must read exactly like "not
    // registered" from the outside: logged for us, never surfaced as a
    // different response shape or a different wait.
    logError("campaigns/monica/request-access", error);
  }

  await sleep(Math.max(0, TIMING_FLOOR_MS - (Date.now() - started)));
  return uniform();
}
