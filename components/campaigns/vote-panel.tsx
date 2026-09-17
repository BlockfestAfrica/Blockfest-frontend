"use client";

import { useState } from "react";
import { buttonClass, control } from "@/components/shared/panel";

/**
 * One nominee's vote controls, on their shortlist card.
 *
 * The flow is the API's flow made visible: a button, then an email, then the
 * six digit code that email receives, then done. State lives in this panel
 * and nowhere else, because a vote is a thirty second errand: a person who
 * closes the tab mid-way casts again and the engine replaces their pending
 * vote with the new one, so there is nothing worth persisting.
 *
 * The server's answers are shown as they arrive. They are written to be
 * uniform on purpose, never confirming whether an address has already voted,
 * and this panel must not undo that by inventing its own more specific copy.
 */
export function VotePanel({
  roundId,
  nomineeId,
  nomineeName,
}: {
  roundId: string;
  nomineeId: string;
  nomineeName: string;
}) {
  const [step, setStep] = useState<"idle" | "email" | "code" | "done">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(path: string, payload: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return {
      ok: response.ok,
      result: (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      },
    };
  }

  async function sendCode() {
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { ok, result } = await post("/api/campaigns/monica/vote", {
        roundId,
        nomineeId,
        email: email.trim(),
      });
      if (!ok || !result.ok) {
        setError(result.message ?? "That did not work. Try again.");
        return;
      }
      setNotice(result.message ?? "Check your inbox for a six digit code.");
      setCode("");
      setStep("code");
    } catch {
      setError("We could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the six digit code from the email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { ok, result } = await post("/api/campaigns/monica/vote/verify", {
        roundId,
        email: email.trim(),
        code: code.trim(),
      });
      if (!ok || !result.ok) {
        setError(result.message ?? "That did not work. Try again.");
        return;
      }
      setStep("done");
    } catch {
      setError("We could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <p className="mt-4 border-t border-line pt-4 text-sm font-semibold text-green-300">
        Your vote is in.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      {step === "idle" && (
        <button
          type="button"
          onClick={() => setStep("email")}
          // Secondary, not gold: up to five of these share one screen, and
          // five primary buttons is zero primary buttons. Gold is saved for
          // the one action each flow ends on.
          className={buttonClass("secondary", "w-full")}
          aria-label={`Vote for ${nomineeName}`}
        >
          Vote
        </button>
      )}

      {step === "email" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <label
              htmlFor={`vote-email-${nomineeId}`}
              className="block text-sm font-semibold text-white"
            >
              Your email address
            </label>
            <input
              id={`vote-email-${nomineeId}`}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={control}
              placeholder="you@example.com"
            />
            <p className="text-sm text-ink-3">
              One vote per email address. We send a six digit code to confirm
              it.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className={buttonClass("primary", "w-full")}
          >
            {busy ? "Sending..." : "Email me a code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void confirmCode();
          }}
          className="space-y-3"
        >
          <p className="text-sm leading-relaxed text-ink-2">{notice}</p>
          <div className="space-y-2">
            <label
              htmlFor={`vote-code-${nomineeId}`}
              className="block text-sm font-semibold text-white"
            >
              Six digit code
            </label>
            <input
              id={`vote-code-${nomineeId}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={`${control} tracking-[0.3em]`}
              placeholder="000000"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className={buttonClass("primary", "w-full")}
          >
            {busy ? "Confirming..." : "Confirm my vote"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              // Back to the email step, which is also how a fresh code is
              // asked for: casting again replaces the pending vote and its
              // code, so this one affordance covers a typo, an expired code
              // and a changed mind.
              setCode("");
              setError("");
              setStep("email");
            }}
            className={buttonClass("quiet", "w-full")}
          >
            Start again
          </button>
        </form>
      )}
    </div>
  );
}
