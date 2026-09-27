"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import { buttonClass, control } from "@/components/shared/panel";
import { PLATFORM_ICON } from "@/components/shared/platform-icon";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";

type Step = "idle" | "email" | "code" | "done";

/* From sm up each platform keeps its own column, so X lines up under X down
   the ballot even when a nominee has no Instagram. */
const SLOT: Record<string, string> = {
  x: "sm:col-start-1",
  instagram: "sm:col-start-2",
  tiktok: "sm:col-start-3",
};

/* The row's state on its left edge, as everywhere else in the system: gold
   while a vote is in progress, green once it is in. */
const EDGE: Record<Step, string> = {
  idle: "border-l-transparent",
  email: "border-l-brand-gold bg-card-2",
  code: "border-l-brand-gold bg-card-2",
  done: "border-l-green-400/50",
};

/**
 * One nominee on the ballot, and their vote.
 *
 * Replaces the card-per-nominee layout the owner called ugly: four mostly
 * empty boxes, "Week 1" printed on each, a wall of underlined platform links,
 * and a Vote pill as wide as the card. Now a nominee is one row of a single
 * ballot: the name leading, their entry as quiet platform marks, and a Vote
 * button at the row's right hand that opens the form underneath it.
 *
 * The flow is the API's flow made visible: Vote, then an email, then the six
 * digit code that email receives, then done. State lives in this row and
 * nowhere else, because a vote is a thirty second errand: a person who
 * closes the tab mid-way casts again and the engine replaces their pending
 * vote with the new one, so there is nothing worth persisting.
 *
 * The server's answers are shown as they arrive. They are written to be
 * uniform on purpose, never confirming whether an address has already voted,
 * and this row must not undo that by inventing its own more specific copy.
 */
export function BallotRow({
  roundId,
  nomineeId,
  name,
  links,
  votingOpen,
}: {
  roundId: string;
  nomineeId: string;
  name: string;
  links: { platform: string; url: string }[];
  /** Before the open and after the close the ballot lists, without buttons. */
  votingOpen: boolean;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /* The button that was pressed disappears with the step it belonged to, so
     focus is handed on explicitly: to the field that is now the next thing
     to do, or back to Vote on cancel. Never on first render. */
  const moved = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const voteRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!moved.current) return;
    if (step === "email") emailRef.current?.focus();
    if (step === "code") codeRef.current?.focus();
    if (step === "idle") voteRef.current?.focus();
  }, [step]);
  const go = (next: Step) => {
    moved.current = true;
    setError("");
    setStep(next);
  };

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
      go("code");
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
      go("done");
    } catch {
      setError("We could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const open = step === "email" || step === "code";

  return (
    <li
      className={`border-l-2 px-4 py-4 transition-colors duration-150 sm:px-5 ${EDGE[step]}`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
          <p className="text-lg font-semibold leading-snug text-pretty text-white sm:min-w-0 sm:flex-1">
            {name}
          </p>
          {links.length > 0 && (
            <ul
              aria-label={`${name}'s entry`}
              // Phones: the marks sit left under the name, packed. From sm up
              // they take the fixed platform columns above.
              className="-mb-1 -ml-1 mt-2 flex sm:m-0 sm:grid sm:grid-cols-[repeat(3,2.75rem)]"
            >
              {links.map((link) => {
                const platform = link.platform as CampaignPlatform;
                const Icon = PLATFORM_ICON[platform];
                const label = platformLabels[platform] ?? link.platform;
                return (
                  <li key={link.url} className={SLOT[platform] ?? ""}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={`${name} on ${label} (opens in a new tab)`}
                      title={`Open on ${label}`}
                      // A 44px target around a 36px chip: the chip is the
                      // HandleChip language (rounded-full, line-2, icon), the
                      // extra ring of space is the tap target.
                      className="group inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:text-white"
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line-2 transition-colors duration-150 group-hover:border-line-3 group-hover:bg-card-3">
                        {Icon ? (
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <span className="text-xs font-semibold">{label}</span>
                        )}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {votingOpen && (
          <div className="shrink-0">
            {step === "idle" && (
              <button
                ref={voteRef}
                type="button"
                onClick={() => go("email")}
                aria-label={`Vote for ${name}`}
                className={buttonClass("secondary", "min-w-24")}
              >
                Vote
              </button>
            )}
            {open && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setCode("");
                  go("idle");
                }}
                aria-label={`Cancel voting for ${name}`}
                className={buttonClass("quiet", "min-w-24")}
              >
                Cancel
              </button>
            )}
            {step === "done" && (
              // Same footprint as the Vote button it replaces, so the name
              // beside it never reflows; the green edge says the rest.
              <p className="inline-flex min-h-12 min-w-24 items-center justify-center gap-2 text-sm font-semibold text-green-300">
                <CircleCheck className="h-4 w-4" aria-hidden="true" />
                Voted
              </p>
            )}
          </div>
        )}
      </div>

      {/* Always present, so the confirmation is announced when it lands. */}
      <p aria-live="polite" className="sr-only">
        {step === "done" ? `Your vote for ${name} is in.` : ""}
      </p>

      {step === "email" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
          className="mt-4 space-y-2"
        >
          <label
            htmlFor={`vote-email-${nomineeId}`}
            className="block text-sm font-semibold text-white"
          >
            Your email address
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={emailRef}
              id={`vote-email-${nomineeId}`}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={`vote-email-${nomineeId}-hint`}
              className={`${control} sm:flex-1`}
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={busy}
              className={buttonClass("primary", "w-full sm:w-auto")}
            >
              {busy ? "Sending..." : "Email me a code"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <p id={`vote-email-${nomineeId}-hint`} className="text-sm text-ink-3">
            A confirmed vote cannot be changed.
          </p>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void confirmCode();
          }}
          className="mt-4 space-y-2"
        >
          <p className="text-sm leading-relaxed text-ink-2">{notice}</p>
          <label
            htmlFor={`vote-code-${nomineeId}`}
            className="block pt-1 text-sm font-semibold text-white"
          >
            Six digit code
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={codeRef}
              id={`vote-code-${nomineeId}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={`${control} tracking-[0.3em] sm:flex-1`}
              placeholder="000000"
            />
            <button
              type="submit"
              disabled={busy}
              className={buttonClass("primary", "w-full sm:w-auto")}
            >
              {busy ? "Confirming..." : "Confirm my vote"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCode("");
              go("email");
            }}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            Start again
          </button>
        </form>
      )}
    </li>
  );
}
