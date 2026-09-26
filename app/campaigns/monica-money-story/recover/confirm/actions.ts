"use server";

import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  CREATOR_LEGACY_SESSION_COOKIE,
  CREATOR_RECOVERY_PENDING_COOKIE,
  CREATOR_SESSION_COOKIE,
} from "@/lib/creator-access";
import {
  recoveryPendingCookieOptions,
  sessionCookieOptions,
  soleCookie,
} from "@/lib/creator-session";
import {
  confirmAccessRecovery,
  recoveryHolderByToken,
} from "@/lib/creator-recovery";
import { monicaRoutes } from "@/lib/campaigns";
import { allowKey } from "@/lib/throttle";
import { personalLink, reissueEmail } from "@/lib/email/templates";
import { sendEmailQuietly } from "@/lib/email/client";

/**
 * Turn a confirmed recovery claim into a rotated session. Closes #206.
 *
 * This is the only thing that rotates the access token outside the admin
 * console, and it is a POST for the same reason #78 made the entry link's
 * sign-in a POST: Next checks the Origin of a server action against the
 * host before the body runs, so a link, a forward, or a mail prefetcher
 * cannot drive this. Requesting recovery changes nothing; this action is
 * the only thing that does.
 */
export async function confirmRecovery(form: FormData) {
  // The enrolment the page actually displayed. Without it there is the same
  // gap #78's enterAsPending closes: the page names account A, the pending
  // cookie is swapped for a token naming B in another tab before the tap
  // lands, and the person who confirmed "I am A" is signed in as B.
  const shown = String(form.get("enrolment") ?? "").trim();

  const who = (await headers()).get("x-nf-client-connection-ip")?.trim() ?? "";
  if (!(await allowKey(who, "recover-confirm", 300, 3600))) {
    redirect(`${monicaRoutes.recoverConfirm}?s=unavailable`);
  }

  const jar = await cookies();
  // The same raw-header read the page made, so the two cannot disagree about
  // which of two planted values they are looking at: see soleCookie.
  const token =
    soleCookie((await headers()).get("cookie"), CREATOR_RECOVERY_PENDING_COOKIE) ??
    "";

  /*
   * Re-checked at the point of use rather than trusted from the render, the
   * same discipline #78 applies to the entry link: a moment is enough for
   * this exact token to have expired or already been used elsewhere.
   */
  let holder: Awaited<ReturnType<typeof recoveryHolderByToken>> = null;
  let unavailable = false;
  try {
    holder = await recoveryHolderByToken(token);
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    redirect(`${monicaRoutes.recoverConfirm}?s=unavailable`);
  }

  if (!holder || holder.enrolmentId !== shown) {
    jar.delete({
      name: CREATOR_RECOVERY_PENDING_COOKIE,
      path: recoveryPendingCookieOptions().path,
    });
    redirect(`${monicaRoutes.recoverConfirm}?s=expired`);
  }

  let confirmed: Awaited<ReturnType<typeof confirmAccessRecovery>> = null;
  try {
    confirmed = await confirmAccessRecovery(token);
  } catch {
    redirect(`${monicaRoutes.recoverConfirm}?s=unavailable`);
  }

  if (!confirmed) {
    // The window closed between the check above and this update, e.g. two
    // tabs racing the same confirmation. Treated as expired: retrying means
    // asking for a fresh link.
    jar.delete({
      name: CREATOR_RECOVERY_PENDING_COOKIE,
      path: recoveryPendingCookieOptions().path,
    });
    redirect(`${monicaRoutes.recoverConfirm}?s=expired`);
  }

  jar.set(CREATOR_SESSION_COOKIE, confirmed.accessToken, sessionCookieOptions());
  // Whoever the pre-prefix cookie named is signed out by this swap, as the
  // page said, and if it was this account it names a token just rotated.
  jar.delete({ name: CREATOR_LEGACY_SESSION_COOKIE, path: "/" });
  jar.delete({
    name: CREATOR_RECOVERY_PENDING_COOKIE,
    path: recoveryPendingCookieOptions().path,
  });

  /*
   * After the response, not before: the creator does not wait on ZeptoMail
   * to reach their own page. This is also the only durable copy of the new
   * link that leaves this request. Without it, the moment the session
   * cookie in this one browser is lost, the creator is back to exactly the
   * trap the admin reissue route's own comments name: nothing left able to
   * get them back in. Reusing reissueEmail rather than a new template is
   * deliberate, since it is the same fact reissuing a link always states.
   */
  const mailTo = confirmed.email;
  const mailName = confirmed.name;
  const mailLink = personalLink(confirmed.accessToken);
  after(async () => {
    await sendEmailQuietly(
      reissueEmail({ to: mailTo, fullName: mailName, personalLink: mailLink }),
      "recovery confirmed",
    );
  });

  redirect(monicaRoutes.me);
}

/** Drop the claim without acting on it. */
export async function discardRecoveryPending() {
  const jar = await cookies();
  jar.delete({
    name: CREATOR_RECOVERY_PENDING_COOKIE,
    path: recoveryPendingCookieOptions().path,
  });
  redirect(monicaRoutes.landing);
}
