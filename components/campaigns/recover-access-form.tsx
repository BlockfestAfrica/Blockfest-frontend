"use client";

import { useState } from "react";
import { control, buttonClass } from "@/components/shared/panel";

/**
 * "Lost your link?" Closes #206, successor to #78.
 *
 * The response shown here is the uniform sentence the API always returns,
 * whether or not the typed address is registered, and the form shows it
 * exactly as received rather than composing its own success/failure copy.
 * A client-side branch on "was this address found" would defeat the whole
 * point of the endpoint answering uniformly.
 */
export function RecoverAccessForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setIsError(true);
      setMessage("Enter your email address.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setIsError(false);
    try {
      const response = await fetch("/api/campaigns/monica/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json();
      setIsError(!result.ok);
      setMessage(
        result.message ??
          (result.ok
            ? "If that address is registered, a link is on its way."
            : "We could not reach the server."),
      );
    } catch {
      setIsError(true);
      setMessage("We could not reach the server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="recover-email" className="sr-only">
        Your email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="recover-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className={`${control} sm:flex-1`}
        />
        <button
          type="submit"
          disabled={busy}
          className={buttonClass("primary", "w-full sm:w-auto")}
        >
          {busy ? "Sending…" : "Send my link"}
        </button>
      </div>
      {message && (
        <p
          className={`text-sm leading-relaxed ${isError ? "text-red-300" : "text-ink-2"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </form>
  );
}
