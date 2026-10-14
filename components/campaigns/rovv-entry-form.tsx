"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { control } from "@/components/shared/panel";
import { CONTACT_EMAIL } from "@/lib/constants";
import { ROVV, rovvEntrySchema, rovvRoutes, suggestEmail, type RovvEntryInput } from "@/lib/rovv";
import { ROVV_PRIVACY_VERSION } from "@/lib/rovv-privacy";
import { ROVV_RULES_VERSION } from "@/lib/rovv-rules";
import { ROVV_EVENTS, track } from "@/lib/sabilytics";

/**
 * The entry form for Rovv's campaign: the six things the brief asks for, the
 * consent box, an optional newsletter box, and Monica's two bot checks.
 *
 * Checked here with the same schema the server uses, so a typo is caught
 * without a round trip, and checked again there, where it counts. The
 * database is what holds one entry per person and per video, and the server's
 * answer is shown against the field it is about.
 *
 * Shown only while entries are open, decided in the browser after the first
 * paint (the page is built once and served for days, so a build-time answer
 * would be stale). Until then it holds its space and says nothing.
 *
 * ?test=1 opens it at any time as a test entry (0074): the server accepts
 * that only from a signed-in admin, and keeps it out of everything real. It
 * is how the owner walks the flow before entries open.
 *
 * What is typed is kept in this browser as a draft until it is sent, so
 * opening the rules, a reload, or an in-app browser rebuilding the page does
 * not throw it away. The consent box is never kept: it is ticked each time.
 */

type Field = "fullName" | "email" | "tiktokHandle" | "tiktokUrl" | "referralCode" | "acceptedRules";
type Phase = "checking" | "upcoming" | "open" | "closed";
type Outcome = "created" | "updated" | "unchanged";

const FIELDS: Field[] = ["fullName", "email", "tiktokHandle", "tiktokUrl", "referralCode", "acceptedRules"];

const EMPTY = { fullName: "", email: "", tiktokHandle: "", tiktokUrl: "", referralCode: "" };
type Values = typeof EMPTY;

const DRAFT_KEY = "rovv-entry-draft";
const DRAFT_HOURS = 24;
/** A send that has not answered in this long is given up on, and the person told what that means. */
const SEND_TIMEOUT_MS = 30_000;

/**
 * The draft, and when typing it began. The start time travels with it
 * because the route treats a form sent within MIN_HUMAN_FILL_MS of being
 * shown as a bot, answering "you're in" and saving nothing: a person who
 * comes back to a filled-in draft and only ticks the box would otherwise be
 * sent there. Timed from when they first typed, they never are.
 */
function readDraft(): { values: Values; startedAt: number } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { values?: Partial<Values>; savedAt?: number; startedAt?: number };
    if (!draft.values || !draft.savedAt || Date.now() - draft.savedAt > DRAFT_HOURS * 3_600_000) return null;
    const kept = Object.fromEntries(Object.entries(draft.values).filter(([, v]) => typeof v === "string"));
    const startedAt = typeof draft.startedAt === "number" ? draft.startedAt : draft.savedAt;
    return { values: { ...EMPTY, ...kept }, startedAt };
  } catch {
    return null;
  }
}

function writeDraft(values: Values | null, startedAt?: number) {
  try {
    if (values) {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ values, savedAt: Date.now(), startedAt: startedAt ?? Date.now() }));
    } else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // A browser that refuses storage still has a working form.
  }
}

function phaseNow(): Phase {
  const now = Date.now();
  if (now < new Date(ROVV.opensAt).getTime()) return "upcoming";
  if (now > new Date(ROVV.closesAt).getTime()) return "closed";
  return "open";
}

function Labelled({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: Field;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-white">
        {label}{" "}
        <span className="text-red-400" aria-hidden="true">
          *
        </span>
      </label>
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-sm leading-relaxed text-ink-4">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function RovvEntryForm() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [values, setValues] = useState(EMPTY);
  const [accepted, setAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [trap, setTrap] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ outcome: Outcome; handle: string; email: string; emailed: boolean } | null>(
    null,
  );
  const [test, setTest] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  /* The close has passed while somebody was mid-way through: they keep the
     form (the server judges a late entry), but nothing offers to change it. */
  const [pastClose, setPastClose] = useState(false);
  /* The last send could not email a copy, so the next one asks for it again. */
  const [needReceipt, setNeedReceipt] = useState(false);
  const shownAt = useRef(0);
  const started = useRef(false);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    shownAt.current = Date.now();
    const draft = readDraft();
    if (draft) {
      setValues(draft.values);
      // Timed from when they first typed, not from this reload.
      shownAt.current = Math.min(Date.now(), draft.startedAt);
    }
    if (new URLSearchParams(window.location.search).get("test") === "1") {
      setTest(true);
      setPhase("open");
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const next = phaseNow();
      /* Somebody halfway through the form when the close passes keeps it:
         the server is the judge of a late entry, and says so on Send. */
      setPhase((current) => (current === "open" && next === "closed" && started.current ? current : next));
      if (next === "closed") setPastClose(true);
      // Once more at the boundary, for a page left open across midnight.
      const edge = new Date(next === "upcoming" ? ROVV.opensAt : ROVV.closesAt).getTime() + 1000 - Date.now();
      if (next !== "closed" && edge > 0) timer = setTimeout(tick, Math.min(edge, 86_400_000));
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  // The success panel takes focus, so a screen reader hears it.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const set = (field: keyof typeof EMPTY) => (value: string) => {
    if (!started.current) {
      started.current = true;
      // A test is not a visitor; the funnel counts people.
      if (!test) track(ROVV_EVENTS.entryStarted);
    }
    setValues((v) => {
      const next = { ...v, [field]: value };
      writeDraft(next, shownAt.current || undefined);
      return next;
    });
    setErrors((e) => ({ ...e, [field]: undefined }));
    if (field === "email") setSuggestion(null);
  };

  const focusField = (field: Field) => {
    document.getElementById(field)?.focus();
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);

    const payload: RovvEntryInput = {
      ...values,
      acceptedRules: accepted as true,
      rulesVersion: ROVV_RULES_VERSION,
      privacyVersion: ROVV_PRIVACY_VERSION,
      marketingOptIn: marketing,
      hp_contact: trap,
      elapsedMs: shownAt.current === 0 ? undefined : Date.now() - shownAt.current,
    };
    // Not part of the schema: the route reads it beside it, and checks the admin.
    const body = { ...payload, ...(test ? { test: true } : {}), ...(needReceipt ? { resendReceipt: true } : {}) };

    const checked = rovvEntrySchema.safeParse(payload);
    if (!checked.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of checked.error.issues) {
        const field = issue.path[0] as Field;
        if (FIELDS.includes(field) && !next[field]) next[field] = issue.message;
      }
      setErrors(next);
      const first = FIELDS.find((f) => next[f]);
      if (first) focusField(first);
      else setFormError("Please check the form.");
      return;
    }

    setSubmitting(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetch("/api/campaigns/rovv/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as
        | { ok: true; outcome: Outcome; emailed?: boolean }
        | { ok: false; message?: string; field?: string; closed?: boolean | "before" | "after" }
        | null;

      if (result && result.ok) {
        if (!test) track(ROVV_EVENTS.entrySubmitted, { outcome: result.outcome });
        writeDraft(null);
        setNeedReceipt(result.emailed === false);
        setDone({
          outcome: result.outcome,
          handle: checked.data.tiktokHandle,
          email: checked.data.email,
          emailed: result.emailed !== false,
        });
        window.scrollTo({ top: (document.getElementById("enter")?.offsetTop ?? 0) - 80, behavior: "smooth" });
        return;
      }

      const message = result?.message ?? "Something went wrong and your entry was not saved. Please try again.";
      const field = result?.field as Field | undefined;
      if (field && FIELDS.includes(field)) {
        setErrors((e) => ({ ...e, [field]: message }));
        focusField(field);
      } else {
        setFormError(message);
      }
      if (result && !result.ok && result.closed && !test) setPhase(result.closed === "before" ? "upcoming" : "closed");
    } catch (error) {
      setFormError(
        error instanceof DOMException && error.name === "AbortError"
          ? "We didn't hear back in time, so your entry may or may not be saved. Check your inbox for our copy; if it is not there in a few minutes, send again. Sending twice is safe: it only updates your entry."
          : "We could not reach the server. Check your connection and send again. Sending twice is safe: it only updates your entry.",
      );
    } finally {
      clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  /* Before any of the phase states: an entry that was saved stays confirmed
     on screen, even if the close passes while the panel is up. */
  if (done) {
    const heading =
      done.outcome === "updated"
        ? "Your entry is updated."
        : done.outcome === "unchanged"
          ? "Your entry is already in, exactly as you sent it."
          : "You're in.";
    const stillOpen = phase === "open" && !pastClose;
    return (
      <div role="status" className="rounded-2xl border border-green-400/30 bg-green-400/10 p-6 sm:p-8">
        <p ref={doneRef} tabIndex={-1} className="flex items-center gap-3 text-xl font-bold text-white">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-300" aria-hidden="true" />
          {heading}
        </p>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-2">
          {done.outcome === "unchanged" ? (
            <>
              It is under <strong className="break-all text-white">{done.email}</strong>. Nothing needed changing, so we
              have not emailed you again.
            </>
          ) : done.emailed ? (
            <>
              We have emailed a copy to <strong className="break-all text-white">{done.email}</strong>. Not there in 15
              minutes? Check Spam and Promotions for mail from Blockfest Africa.
            </>
          ) : (
            <>
              Your entry is saved, but we could not email a copy to{" "}
              <strong className="break-all text-white">{done.email}</strong> just now. If that address is wrong, tap
              Change my entry and correct it.
            </>
          )}{" "}
          Winners are announced by {ROVV.winnersByLabel}. Keep your video public and tagged until Saturday 24 October.
        </p>
        {stillOpen && (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
            Made a mistake? Until the team has checked your entry, send the form again before the close with the same
            email address and the TikTok username @{done.handle}, and the new details replace these. After that, reply
            to our email.
          </p>
        )}
        {test && (
          <p className="mt-3 max-w-prose text-sm font-semibold leading-relaxed text-brand-gold">
            This was a test entry. It is in the console under Test, and nowhere real.
          </p>
        )}
        {stillOpen && (
          <button
            type="button"
            onClick={() => setDone(null)}
            className="mt-5 inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            Change my entry
          </button>
        )}
      </div>
    );
  }

  if (phase === "checking") {
    return (
      <div className="min-h-[24rem]">
        <p className="text-sm text-ink-3">Loading the entry form…</p>
      </div>
    );
  }

  if (phase !== "open") {
    return (
      <div className="rounded-2xl border border-line-2 bg-card-2 p-6 sm:p-8">
        <p className="text-lg font-semibold text-white">
          {phase === "upcoming"
            ? "Entries open on Tuesday 13 October at 12:00 AM, Lagos time: the moment Monday night ends."
            : "Entries are closed."}
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
          {phase === "upcoming" ? (
            <>
              Make your video and register on the ROVV app now (
              {ROVV.appLinks.android && (
                <a
                  href={ROVV.appLinks.android}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link underline underline-offset-2 hover:text-white"
                >
                  Google Play
                </a>
              )}
              {ROVV.appLinks.android && ROVV.appLinks.ios ? " or " : ""}
              {ROVV.appLinks.ios && (
                <a
                  href={ROVV.appLinks.ios}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link underline underline-offset-2 hover:text-white"
                >
                  App Store
                </a>
              )}
              ), then come back here to enter.
            </>
          ) : (
            `Entries closed at 11:59 PM on Sunday 18 October, Lagos time. Winners are announced by ${ROVV.winnersByLabel}, and listed on this page.`
          )}
        </p>
      </div>
    );
  }

  const describedBy = (field: Field, hint = false) =>
    [hint ? `${field}-hint` : "", errors[field] ? `${field}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6">
      {test && (
        <p role="status" className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-sm leading-relaxed text-ink-2">
          <strong className="font-semibold text-white">Test mode.</strong> This form is open for testing whatever the
          date. Entries sent from here are marked as tests: kept off the public page, out of the exports and the
          winner count, and deleted from the console in one go. It works only while you are signed in to the console.
        </p>
      )}
      {/* Off-screen, out of the tab order and hidden from assistive
          technology: a person never meets it and a script filling every
          input does. Named for nothing a password manager would fill. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="hp-contact-ref">Leave this field empty</label>
        <input
          id="hp-contact-ref"
          name="hp-contact-ref"
          type="text"
          tabIndex={-1}
          autoComplete="new-password"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Labelled label="Full name" htmlFor="fullName" error={errors.fullName}>
          <input
            id="fullName"
            name="fullName"
            autoComplete="name"
            value={values.fullName}
            onChange={(e) => set("fullName")(e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={describedBy("fullName")}
            className={control}
            placeholder="Ada Obi"
          />
        </Labelled>
        <Labelled label="Email address" htmlFor="email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={values.email}
            onChange={(e) => set("email")(e.target.value)}
            onBlur={() => setSuggestion(suggestEmail(values.email))}
            aria-required="true"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={[describedBy("email"), suggestion ? "email-suggestion" : ""].filter(Boolean).join(" ") || undefined}
            className={control}
            placeholder="you@example.com"
          />
          {/* Every email about the entry goes only here, so a likely typo is
              offered a fix where it is made. Never a refusal. */}
          {suggestion && (
            <p id="email-suggestion" className="text-sm text-amber-300">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => {
                  set("email")(suggestion);
                  setSuggestion(null);
                }}
                className="inline-flex min-h-11 cursor-pointer items-center break-all font-semibold underline underline-offset-2 hover:text-white"
              >
                {suggestion}
              </button>
              ?
            </p>
          )}
        </Labelled>
      </div>

      <Labelled
        label="TikTok username"
        htmlFor="tiktokHandle"
        hint="The account you posted the video from."
        error={errors.tiktokHandle}
      >
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-ink-4" aria-hidden="true">
            @
          </span>
          <input
            id="tiktokHandle"
            name="tiktokHandle"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={values.tiktokHandle}
            // The box shows its own @, so a typed one would read as two.
            onChange={(e) => set("tiktokHandle")(e.target.value.replace(/^\s*@+/, ""))}
            aria-required="true"
            aria-invalid={Boolean(errors.tiktokHandle)}
            aria-describedby={describedBy("tiktokHandle", true)}
            className={`${control} pl-9`}
            placeholder="yourname"
          />
        </div>
      </Labelled>

      <Labelled
        label="Link to your TikTok video"
        htmlFor="tiktokUrl"
        hint="On TikTok, open your video, tap Share, then Copy link, and paste it here. A short vm.tiktok.com link is fine."
        error={errors.tiktokUrl}
      >
        <input
          id="tiktokUrl"
          name="tiktokUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={values.tiktokUrl}
          onChange={(e) => set("tiktokUrl")(e.target.value)}
          aria-required="true"
          aria-invalid={Boolean(errors.tiktokUrl)}
          aria-describedby={describedBy("tiktokUrl", true)}
          className={control}
          placeholder="https://vm.tiktok.com/…"
        />
      </Labelled>

      <Labelled
        label="ROVV referral code"
        htmlFor="referralCode"
        hint="Your own referral code, from Referral Rewards in the ROVV app once you have registered. Type it exactly as the app shows it."
        error={errors.referralCode}
      >
        <input
          id="referralCode"
          name="referralCode"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={40}
          value={values.referralCode}
          onChange={(e) => set("referralCode")(e.target.value)}
          aria-required="true"
          aria-invalid={Boolean(errors.referralCode)}
          aria-describedby={describedBy("referralCode", true)}
          className={`${control} font-mono tracking-wider sm:max-w-xs`}
        />
      </Labelled>

      <div className="flex flex-col gap-6 border-t border-line-2 pt-6">
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              id="acceptedRules"
              type="checkbox"
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                setErrors((err) => ({ ...err, acceptedRules: undefined }));
              }}
              aria-required="true"
              aria-invalid={Boolean(errors.acceptedRules)}
              aria-describedby={errors.acceptedRules ? "acceptedRules-error" : undefined}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand-gold"
            />
            <span className="text-sm leading-relaxed text-ink-2">
              I am 18 or over and can attend Blockfest Africa 2026 in Lagos. My video is my own original work, public
              on TikTok, and tags {ROVV.rovvHandle} and {ROVV.blockfestHandle} with {ROVV.hashtag}. I have registered
              on the ROVV app. I accept the{" "}
              {/* A new tab, so reading them never loses what is typed here. */}
              <Link
                href={rovvRoutes.rules}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                campaign rules
              </Link>
              , and I understand Blockfest Africa shares my name, email address, TikTok username and referral code
              with ROVV to confirm my registration, as the{" "}
              <Link
                href={rovvRoutes.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                privacy notice
              </Link>{" "}
              explains.{" "}
              <span className="text-base font-bold leading-none text-red-400" aria-hidden="true">
                *
              </span>
            </span>
          </label>
          {errors.acceptedRules && (
            <p id="acceptedRules-error" role="alert" className="mt-2 pl-7 text-sm text-red-300">
              {errors.acceptedRules}
            </p>
          )}
        </div>

        {/* A separate question: hearing about future campaigns is not part
            of entering this one, so it never rides on the box above. */}
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand-gold"
            />
            <span className="text-sm leading-relaxed text-ink-2">
              Optional. Tell me about future Blockfest Africa campaigns and events by email.
            </span>
          </label>
          <p className="mt-2 pl-7 text-sm leading-relaxed text-ink-4">
            Leaving it unticked has no effect on your entry or your chances.
          </p>
        </div>

        {formError && (
          <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {formError}
          </p>
        )}

        <p className="text-sm leading-relaxed text-ink-4">
          Trouble entering? Write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-link underline underline-offset-2 hover:text-white">
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-150 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60 sm:self-start"
        >
          {submitting ? "Sending…" : "Send my entry"}
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </form>
  );
}
