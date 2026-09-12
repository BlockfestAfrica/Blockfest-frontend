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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { handleAuthCallback } = await import("@netlify/identity");
        const result = await handleAuthCallback();
        if (cancelled || !result) return;

        // An invite needs a password set before the account can be used again.
        if (result.type === "invite") {
          setInviteToken(result.token ?? null);
          setNotice(
            "You are invited. Set a password below to finish, then you are in.",
          );
          return;
        }
        window.location.href = "/admin";
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
        await identity.acceptInvite(inviteToken, password);
      } else {
        await identity.login(email.trim(), password);
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
          className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/70"
        >
          {notice}
        </p>
      )}

      {!inviteToken && (
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
            className="w-full rounded-lg border border-white/15 bg-ground px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-brand-gold focus:outline-none"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-semibold text-white">
          {inviteToken ? "Choose a password" : "Password"}
        </label>
        <input
          id="password"
          type="password"
          autoComplete={inviteToken ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-ground px-4 py-3 text-base text-white focus:border-brand-gold focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={busy || password.length === 0 || (!inviteToken && !email.trim())}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Please wait..." : inviteToken ? "Set password" : "Sign in"}
      </button>
    </form>
  );
}
