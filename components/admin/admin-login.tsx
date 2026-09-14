"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Signing in, and completing an invite.
 *
 * Both land here. An invite link from Netlify carries its token in the URL
 * fragment, and handleAuthCallback processes whatever is there: an invite, a
 * password recovery, or a confirmation. Without that call the invite link goes
 * nowhere and the account is never usable, which is the commonest way this
 * integration is got wrong.
 *
 * Every failure says the same thing. A wrong password, an address that was
 * never invited, and an address that was invited and later revoked are one
 * message, because anything else turns this page into a way to find out who the
 * admins are.
 *
 * After signing in the browser is sent to /admin with a full navigation rather
 * than a router push. The session is a cookie set by the Identity runtime, and
 * a client-side navigation would render the next page from a tree that was
 * built before it existed.
 */
export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * The invite token from the URL fragment.
   *
   * handleAuthCallback returns it for an invite and leaves `user` null, because
   * the account is not usable until a password is set. acceptInvite needs both
   * the token and the new password, so it has to be held between the callback
   * running on mount and the form being submitted.
   */
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  /**
   * A recovery link has ALREADY signed this browser in by the time the callback
   * resolves. handleRecoveryCallback calls setBrowserAuthCookies with a live
   * JWT before returning, so there is a real session here and the only thing
   * standing between it and the review queue is this component.
   *
   * The first version of this kept that session, reasoning that it belongs to
   * the real admin and dismissing it would be a lie about what happened. That
   * reasoning was wrong, and it made the whole gate decorative. The refusal was
   * three lines of React state, and nothing on the server knew the session was
   * mid-recovery, so an attacker who reached the mail did not have to argue
   * with this component at all: they typed /admin in the address bar and the
   * console rendered. requireAdmin resolved the real owner, because it really
   * was the owner's token. The real admin's password still worked and nothing
   * had changed, so the one signal the design leaned on, that using a link
   * would leave a trace, did not fire either.
   *
   * The shared inbox seeded as owner makes that reachable by anybody ever
   * forwarded a thread from partnerships, and GoTrue's recover endpoint is
   * mounted on this domain and live whether or not anything links to it.
   *
   * So the cookies go immediately. They are the half the server reads, and
   * without them requireAdmin denies, which is what turns this from a request
   * into a gate. The in-memory session stays only long enough to change the
   * password through it, and is then ended so the new password has to be
   * typed. Anyone holding the link is left with nothing but the ability to set
   * a password they will then have to use, which is exactly the trace the
   * design wanted and never had.
   */

  /**
   * Drop the credentials the server can see, keeping the in-memory session.
   *
   * The danger is entirely in the cookies: they are what requireAdmin reads and
   * what travels to /admin in another tab. The library's own session object
   * lives in JS and is what updateUser needs, so clearing the cookies is the
   * narrowest thing that closes the hole without breaking the password change
   * it exists to enable.
   */
  /**
   * Clear gotrue's persisted session, which the cookie drop does not touch.
   *
   * The library keeps the user and refresh token in localStorage under
   * gotrue.* / netlify* keys and arms a module-level timer that re-plants the
   * cookies from them at the refresh margin. Clearing the cookies without this
   * is undone within the hour. logout() stops the timer; this removes what it
   * would otherwise rebuild from.
   */
  function sweepLegacyStorage() {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("gotrue.") || key.startsWith("netlify")) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // A browser with storage blocked has nothing to clear.
    }
  }

  function dropServerVisibleSession() {
    try {
      for (const name of ["nf_jwt", "nf_refresh"]) {
        document.cookie = `${name}=; path=/; max-age=0; samesite=lax${
          window.location.protocol === "https:" ? "; secure" : ""
        }`;
      }
    } catch {
      // Nothing to clear, which is the safe direction.
    }
  }
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Strip any pre-deploy Identity credential out of both places the
        // first time an admin returns. The fragment token is in the URL, not
        // localStorage, so this cannot break the callback below.
        dropServerVisibleSession();
        sweepLegacyStorage();

        const { handleAuthCallback } = await import("@netlify/identity");
        const result = await handleAuthCallback();
        if (cancelled || !result) return;

        // Handled by name, never by falling through.
        //
        // Each callback type differs in whether the library has already
        // established a session: an invite has not, a recovery has. A default
        // that navigates to the queue gives a free session to every type that
        // does, including any the library adds later, so there is no default.
        if (result.type === "invite") {
          setInviteToken(result.token ?? null);
          setNotice(
            "You are invited. Set a password below to finish, then you are in.",
          );
          return;
        }

        if (result.type === "recovery") {
          dropServerVisibleSession();
          setRecovering(true);
          setNotice(
            /*
             * Truthful, unlike its first version, which said "Your old one no
             * longer works". A GoTrue recovery link changes nothing by itself;
             * the old password works until the new one is set, and telling a
             * locked-out admin otherwise sends them in circles.
             */
            "Set a new password to finish.",
          );
          return;
        }

        if (result.type === "confirmation" || result.type === "email_change") {
          /*
           * Confirmation signs the browser in too. The comment here used to say
           * an invite establishes no session and a recovery does, and then
           * treated confirmation as the harmless case. The library signs in on
           * confirmation as well, so it was a free session for anybody holding
           * a confirmation link.
           */
          dropServerVisibleSession();
          setNotice("That is confirmed. Sign in below.");
          return;
        }

        // An unrecognised type. Assume it established a session, because the
        // two that do outnumber the one that does not and a new one costs
        // nothing to be wrong about in this direction.
        dropServerVisibleSession();
        setNotice("That link is not one we recognise. Sign in below.");
      } catch {
        // A link that has expired or been used already. Say so once, plainly,
        // rather than leaving somebody on a page that appears to do nothing.
        if (!cancelled) {
          setNotice(
            "That link did not work. It may have expired or already been used. Ask for a new invite.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      const identity = await import("@netlify/identity");

      if (inviteToken) {
        // acceptInvite sets the password and signs the browser into gotrue.
        // That session is torn down at once: every path into the console now
        // ends at the same door, the exchange, so no link-established Identity
        // session is ever load-bearing.
        await identity.acceptInvite(inviteToken, password);
        await identity.logout().catch(() => {});
        dropServerVisibleSession();
        sweepLegacyStorage();

        setInviteToken(null);
        setBusy(false);
        setPassword("");
        setNotice("Password set. Sign in with it below.");
        return;
      } else if (recovering) {
        /*
         * Changed through the in-memory session, then ended.
         *
         * Sending them back to sign in with the password they just chose is
         * the point: it means holding the link alone is never enough to reach
         * the queue, and that using it leaves the account's password changed,
         * which is the trace somebody notices.
         */
        await identity.updateUser({ password });
        await identity.logout().catch(() => {});
        dropServerVisibleSession();
        sweepLegacyStorage();

        setRecovering(false);
        setBusy(false);
        setPassword("");
        setNotice("Password changed. Sign in with it below.");
        return;
      } else {
        /*
         * The exchange, not identity.login. This is the whole of #138: the
         * password goes to the server, which performs the Identity grant and
         * hands back an httpOnly session cookie. identity.login is never called
         * again, so nf_jwt, nf_refresh and the gotrue localStorage are never
         * created on the sign-in path and no admin credential sits where page
         * script can read it.
         */
        const response = await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });

        if (response.status === 429) {
          const body = await response.json().catch(() => ({}));
          const message =
            body.message ?? "Too many tries. Wait a few minutes, then try again.";
          setNotice(message);
          toast.error(message);
          setBusy(false);
          return;
        }

        if (!response.ok) {
          const message = "That did not work. Check the address and password.";
          setNotice(message);
          toast.error(message);
          setBusy(false);
          return;
        }

        // Full navigation, so the server tree renders with the new cookie.
        window.location.href = "/admin";
        return;
      }

      window.location.href = "/admin";
    } catch {
      // Deliberately one message for every cause.
      const message = "That did not work. Check the address and password.";
      setNotice(message);
      toast.error(message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-5">
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-line-2 bg-card-2 px-4 py-3 text-sm leading-relaxed text-ink-2"
        >
          {notice}
        </p>
      )}

      {!inviteToken && !recovering && (
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-semibold text-white">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line-2 bg-control px-4 py-3 text-base text-white placeholder:text-ink-3"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-semibold text-white">
          {inviteToken || recovering ? "Choose a password" : "Password"}
        </label>
        <input
          id="password"
          type="password"
          autoComplete={inviteToken || recovering ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line-2 bg-ground px-4 py-3 text-base text-white"
        />
      </div>

      <button
        type="submit"
        disabled={
          busy ||
          password.length === 0 ||
          (!inviteToken && !recovering && !email.trim())
        }
        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-150 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy
          ? "Please wait..."
          : inviteToken || recovering
            ? "Set password"
            : "Sign in"}
      </button>
    </form>
  );
}
