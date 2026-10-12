"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { control } from "@/components/shared/panel";
import { ROVV, rovvEntrySchema, rovvRoutes, type RovvEntryInput } from "@/lib/rovv";
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
 */

type Field = "fullName" | "email" | "tiktokHandle" | "tiktokUrl" | "referralCode" | "acceptedRules";
type Phase = "checking" | "upcoming" | "open" | "closed";
type Outcome = "created" | "updated" | "unchanged";

const FIELDS: Field[] = ["fullName", "email", "tiktokHandle", "tiktokUrl", "referralCode", "acceptedRules"];

const EMPTY = { fullName: "", email: "", tiktokHandle: "", tiktokUrl: "", referralCode: "" };

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
  const [done, setDone] = useState<{ outcome: Outcome; handle: string } | null>(null);
  const shownAt = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    shownAt.current = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const next = phaseNow();
      setPhase(next);
      // Once more at the boundary, for a page left open across midnight.
      const edge = new Date(next === "upcoming" ? ROVV.opensAt : ROVV.closesAt).getTime() + 1000 - Date.now();
      if (next !== "closed" && edge > 0) timer = setTimeout(tick, Math.min(edge, 86_400_000));
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  const set = (field: keyof typeof EMPTY) => (value: string) => {
    if (!started.current) {
      started.current = true;
      track(ROVV_EVENTS.entryStarted);
    }
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
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
    try {
      const response = await fetch("/api/campaigns/rovv/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok: true; outcome: Outcome }
        | { ok: false; message?: string; field?: string }
        | null;

      if (result && result.ok) {
        track(ROVV_EVENTS.entrySubmitted, { outcome: result.outcome });
        setDone({ outcome: result.outcome, handle: checked.data.tiktokHandle });
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
      if (response.status === 403) setPhase(phaseNow());
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "checking") {
    return <div className="min-h-[24rem]" aria-hidden="true" />;
  }

  if (phase !== "open") {
    return (
      <div className="rounded-2xl border border-line-2 bg-card-2 p-6 sm:p-8">
        <p className="text-lg font-semibold text-white">
          {phase === "upcoming" ? "Entries open at midnight on Tuesday 13 October, Lagos time." : "Entries are closed."}
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
          {phase === "upcoming"
            ? "Make your video and register on the ROVV app now, then come back here to enter."
            : `Entries closed at 11:59 PM on Sunday 18 October, Lagos time. Winners are emailed by Tuesday 20 October and listed on this page.`}
        </p>
      </div>
    );
  }

  if (done) {
    const heading =
      done.outcome === "updated"
        ? "Your entry is updated."
        : done.outcome === "unchanged"
          ? "Your entry is already in, exactly as you sent it."
          : "You're in.";
    return (
      <div role="status" className="rounded-2xl border border-green-400/30 bg-green-400/10 p-6 sm:p-8">
        <p className="flex items-center gap-3 text-xl font-bold text-white">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-300" aria-hidden="true" />
          {heading}
        </p>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-2">
          {done.outcome === "unchanged"
            ? "Nothing needed changing, so we have not emailed you again."
            : "We have emailed you a copy of your entry."}{" "}
          The team picks {ROVV.winners} winners by Tuesday 20 October. Keep your video public and tagged until
          Saturday 24 October.
        </p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
          Made a mistake? Send the form again before the close with the same email address and the TikTok username
          @{done.handle}, and the new details replace these.
        </p>
        <button
          type="button"
          onClick={() => setDone(null)}
          className="mt-5 inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
        >
          Change my entry
        </button>
      </div>
    );
  }

  const describedBy = (field: Field, hint = false) =>
    [hint ? `${field}-hint` : "", errors[field] ? `${field}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-6">
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
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email")}
            className={control}
            placeholder="you@example.com"
          />
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
        hint="On TikTok, tap Share on your video, then Copy link, and paste it here."
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
          aria-invalid={Boolean(errors.tiktokUrl)}
          aria-describedby={describedBy("tiktokUrl", true)}
          className={control}
          placeholder="https://www.tiktok.com/@yourname/video/…"
        />
      </Labelled>

      <Labelled
        label="ROVV referral code"
        htmlFor="referralCode"
        hint="Your own referral code from the ROVV app, after you register."
        error={errors.referralCode}
      >
        <input
          id="referralCode"
          name="referralCode"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          value={values.referralCode}
          onChange={(e) => set("referralCode")(e.target.value.toUpperCase())}
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
              aria-invalid={Boolean(errors.acceptedRules)}
              aria-describedby={errors.acceptedRules ? "acceptedRules-error" : undefined}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand-gold"
            />
            <span className="text-sm leading-relaxed text-ink-2">
              I am 18 or over and can attend Blockfest Africa 2026 in Lagos. My video is my own original work, public
              on TikTok, and tags {ROVV.rovvHandle} and {ROVV.blockfestHandle} with {ROVV.hashtag}. I have registered
              on the ROVV app. I accept the{" "}
              <Link href={rovvRoutes.rules} className="text-link underline underline-offset-2 hover:text-white">
                campaign rules
              </Link>
              , and I understand Blockfest Africa shares my name, email address, TikTok username and referral code
              with ROVV to confirm my registration, as the{" "}
              <Link href={rovvRoutes.privacy} className="text-link underline underline-offset-2 hover:text-white">
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
