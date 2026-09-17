"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  CREATOR_PENDING_COOKIE,
  CREATOR_SESSION_COOKIE,
} from "@/lib/creator-access";
import {
  creatorByToken,
  pendingCookieOptions,
  sessionCookieOptions,
} from "@/lib/creator-session";
import { monicaRoutes } from "@/lib/campaigns";
import { allowKey } from "@/lib/throttle";

/**
 * Turn a claim into a session.
 *
 * This is the only thing in the campaign that signs a creator in, and it is a
 * POST, which is the whole point of the change. Next checks the Origin of a
 * server action against the host before the body runs, so this cannot be driven
 * from another site the way a link can.
 *
 * The token is read back from the cookie rather than passed in from the page.
 * A hidden form field would put a live credential into the HTML of a page that
 * also loads a third party analytics script, which is the same mistake in a
 * different place.
 */
export async function enterAsPending(form: FormData) {
  /*
   * The enrolment the page actually displayed, carried in the form.
   *
   * Without it there is a gap between render and tap: the page names account A,
   * the pending cookie is swapped for token B in another tab before the tap
   * lands, and the person who confirmed "I am A" is signed in as B. An
   * enrolment id is not a credential, so putting it in the HTML costs nothing,
   * and comparing it here means the session established is exactly the one the
   * person read the name of.
   */
  const shown = String(form.get("enrolment") ?? "").trim();

  /*
   * The same budget as /enter, because this action also resolves a token
   * against the database and a cookie an attacker can plant themselves is not
   * a gate. The confirm PAGE's render stays unthrottled and that is accepted:
   * it is one indexed hash lookup per view, the same weight as any public
   * page, and 32 random bytes leave an enumerator nothing to enumerate.
   */
  const who = (await headers()).get("x-nf-client-connection-ip")?.trim() ?? "";
  // Its own bucket since the day-one audit: sharing "enter" with the GET
  // halved the launch-morning budget that number was calibrated for, and
  // let unauthenticated GETs drain the confirm action's allowance.
  if (!(await allowKey(who, "enter-confirm", 600, 3600))) {
    redirect(`${monicaRoutes.enterConfirm}?s=unavailable`);
  }

  const jar = await cookies();
  const token = jar.get(CREATOR_PENDING_COOKIE)?.value?.trim() ?? "";

  /*
   * Resolved again here, not trusted from the render.
   *
   * The page that drew the button read the database a moment ago, but a moment
   * is enough for an admin to reissue the link, which rotates the hash and
   * should invalidate what is sitting in this cookie. Checking at the point of
   * use rather than the point of display is what makes that true.
   */
  /*
   * A Neon blip at the exact moment somebody taps the confirm button must not
   * throw out of the action into a bare Next error page. It reads as the site
   * breaking on the one tap that mattered, on launch morning.
   */
  let holder: Awaited<ReturnType<typeof creatorByToken>> = null;
  let unavailable = false;
  try {
    holder = await creatorByToken(token);
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    redirect(`${monicaRoutes.enterConfirm}?s=unavailable`);
  }

  if (!holder || holder.enrolmentId !== shown) {
    jar.delete({ name: CREATOR_PENDING_COOKIE, path: pendingCookieOptions().path });
    redirect(`${monicaRoutes.enterConfirm}?s=expired`);
  }

  jar.set(CREATOR_SESSION_COOKIE, token, sessionCookieOptions());
  jar.delete({ name: CREATOR_PENDING_COOKIE, path: pendingCookieOptions().path });

  redirect(monicaRoutes.me);
}

/** Drop the claim without acting on it. */
export async function discardPending() {
  const jar = await cookies();
  jar.delete({ name: CREATOR_PENDING_COOKIE, path: pendingCookieOptions().path });
  redirect(monicaRoutes.landing);
}

/**
 * End the session on this device.
 *
 * The gap this closes: the confirm page treats two creators sharing a phone
 * as the ordinary case, yet once a session existed nothing could end it short
 * of clearing site data by hand, for ninety sliding days. The emailed link
 * signs the owner straight back in, so leaving costs one tap to return; the
 * clearing Set-Cookie carries the session cookie's own path or it would be
 * a no-op, same rule as the pending delete above.
 */
export async function signOut() {
  const jar = await cookies();
  jar.delete({ name: CREATOR_SESSION_COOKIE, path: sessionCookieOptions().path });
  redirect(monicaRoutes.landing);
}
