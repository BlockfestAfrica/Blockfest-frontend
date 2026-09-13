"use server";

import { cookies } from "next/headers";
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
export async function enterAsPending() {
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
  const holder = await creatorByToken(token);

  if (!holder) {
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
