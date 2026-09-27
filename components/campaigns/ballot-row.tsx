"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import { buttonClass, control } from "@/components/shared/panel";
import {
  byPlatform,
  MARK_SLOT,
  MarkLink,
  platformLabel,
} from "@/components/shared/platform-marks";

type Step = "idle" | "email" | "code";

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
 * digit code that email receives, then done. Which row is open, and which
 * nominee a confirmed vote went to, belong to the ballot (BallotRows), not
 * to the row: the engine holds one pending vote per address and the code
 * does not name a nominee, so two rows mid-vote at once could confirm one
 * row's code in the other's form. Nothing is persisted, because a vote is a
 * thirty second errand and a person who closes the tab casts again.
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
  active,
  voted,
  onOpen,
  onClose,
  onVoted,
}: {
  roundId: string;
  nomineeId: string;
  name: string;
  links: { platform: string; url: string }[];
  /** Before the open and after the close the ballot lists, without buttons. */
  votingOpen: boolean;
  /** This row holds the ballot's one open form. */
  active: boolean;
  /** The server confirmed a vote for this nominee in this visit. */
  voted: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** The confirmed nominee as the server named it, and its words. */
  onVoted: (confirmedNomineeId: string, message: string) => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Another row opened: this one's form closes, with nothing sent.
  useEffect(() => {
    if (!active && step !== "idle") {
      setStep("idle");
      setCode("");
      setError("");
    }
  }, [active, step]);

  /* The button that was pressed disappears with the step it belonged to, so
     focus is handed on explicitly: to the field that is now the next thing
     to do, back to Vote on cancel, and to "Voted" once the vote is in.
     Never on first render, and never for a row closed by another row. */
  const moved = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const voteRef = useRef<HTMLButtonElement>(null);
  const votedRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (voted) votedRef.current?.focus();
    else if (step === "email") emailRef.current?.focus();
    else if (step === "code") codeRef.current?.focus();
    else voteRef.current?.focus();
  }, [step, voted]);
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
        nomineeId?: string;
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
      moved.current = true;
      setStep("idle");
      // The server says which nominee the code confirmed; this row is only
      // the likeliest answer when it could not look that up.
      onVoted(result.nomineeId || nomineeId, result.message ?? "Your vote is in.");
    } catch {
      setError("We could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const open = active && (step === "email" || step === "code");
  // The row's state on its left edge, as everywhere else in the system:
  // gold while a vote is in progress, green once it is in.
  const edge = voted
    ? "border-l-green-400/50"
    : open
      ? "border-l-brand-gold bg-card-2"
      : "border-l-transparent";

  return (
    <li className={`border-l-2 px-4 py-4 transition-colors duration-150 sm:px-5 ${edge}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
          {/* break-words: a registered name can be one long word, and this
              column is 144px on a 320px phone beside the button. */}
          <p className="break-words text-lg font-semibold leading-snug text-pretty text-white sm:min-w-0 sm:flex-1">
            {name}
          </p>
          {links.length > 0 && (
            <ul
              aria-label={`${name}'s entry`}
              // Phones: the marks sit left under the name, packed. From sm up
              // they take the fixed platform cells (MARK_SLOT).
              className="-mb-1 -ml-1 mt-2 flex sm:m-0 sm:grid sm:grid-cols-[repeat(3,2.75rem)]"
            >
              {/* Sorted X, Instagram, TikTok, so phones, which have no
                  cells, list them in the order the winners do. */}
              {byPlatform(links, (link) => link.platform).map((link) => (
                <li key={link.url} className={MARK_SLOT[link.platform] ?? ""}>
                  <MarkLink
                    platform={link.platform}
                    url={link.url}
                    label={`${name} on ${platformLabel(link.platform)}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {votingOpen && (
          <div className="shrink-0">
            {voted ? (
              // Same footprint as the Vote button it replaces, so the name
              // beside it never reflows; the green edge says the rest.
              // Focusable so focus has somewhere to land when the form it
              // was in goes away.
              <p
                ref={votedRef}
                tabIndex={-1}
                className="inline-flex min-h-12 min-w-24 items-center justify-center gap-2 text-sm font-semibold text-green-300"
              >
                <CircleCheck className="h-4 w-4" aria-hidden="true" />
                Voted
              </p>
            ) : open ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setCode("");
                  go("idle");
                  onClose();
                }}
                aria-label={`Cancel voting for ${name}`}
                className={buttonClass("quiet", "min-w-24")}
              >
                Cancel
              </button>
            ) : (
              <button
                ref={voteRef}
                type="button"
                onClick={() => {
                  onOpen();
                  go("email");
                }}
                aria-label={`Vote for ${name}`}
                className={buttonClass("secondary", "min-w-24")}
              >
                Vote
              </button>
            )}
          </div>
        )}
      </div>

      {open && step === "email" && (
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

      {open && step === "code" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void confirmCode();
          }}
          className="mt-4 space-y-2"
        >
          {/* Read as the code field's description: focus lands on the field,
              past this line, and it is the only place that tells a person
              who already voted that no new code will come. */}
          <p id={`vote-code-${nomineeId}-notice`} className="text-sm leading-relaxed text-ink-2">
            {notice}
          </p>
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
              aria-describedby={`vote-code-${nomineeId}-notice`}
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
              // Back to the email step, which is also how a fresh code is
              // asked for: casting again replaces the pending vote and its
              // code, so this covers a typo, an expired code and a changed
              // mind.
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
