"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Copy, Lock } from "lucide-react";
import { hasPassed } from "@/lib/countdown";
import { monicaRoutes } from "@/lib/campaigns";
import { MONICA_RULES_VERSION } from "@/lib/monica-rules";
import { track } from "@/lib/sabilytics";

type Field =
  | "fullName"
  | "email"
  | "phone"
  | "x"
  | "instagram"
  | "tiktok"
  | "contentNiche"
  | "audienceSize"
  | "location"
  | "acceptedRules";

const EMPTY: Record<Field, string> = {
  fullName: "",
  email: "",
  phone: "",
  x: "",
  instagram: "",
  tiktok: "",
  contentNiche: "",
  audienceSize: "",
  location: "",
  acceptedRules: "",
};

const inputClass =
  "w-full rounded-lg border border-white/15 bg-ground px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-brand-gold focus:outline-none";

/** A titled group of fields, so the form reads as three short asks. */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="eyebrow text-white/60">{title}</h2>
      {hint && (
        <p className="mt-2 text-sm leading-relaxed text-white/50">{hint}</p>
      )}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
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
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-white"
      >
        {label}
      </label>
      {hint && <p className="mt-1 text-sm text-white/50">{hint}</p>}
      {/* mt-auto so two fields side by side line up even when one hint wraps
          to two lines and the other does not. Trimming the copy to match would
          fix today's pair and break on the next one. */}
      <div className="mt-auto pt-2">{children}</div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The registration form.
 *
 * Fails closed, like the join control on the landing page. The campaign pages
 * are statically prerendered, so the opening date cannot be read at build time
 * without freezing the answer into the HTML. The check runs after mount, and
 * until it has run the form is not rendered at all. A reader with no
 * JavaScript, a failed hydration, or a crawler gets the locked notice rather
 * than a form they could fill in a day early.
 *
 * That is presentation, not protection. The endpoint refuses early
 * registrations regardless of what this component decides, because anyone who
 * can read the page source can find the URL.
 *
 * Validation here is a courtesy to save a round trip on a typo. The server
 * parses everything again and its answer wins: field errors coming back from it
 * are shown against the field it names, because "something went wrong" sends a
 * creator away and they do not return.
 */
export function RegistrationForm({ opensAt }: { opensAt: string }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [values, setValues] = useState<Record<Field, string>>(EMPTY);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    name: string;
    referralCode: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // ?preview=open unlocks the form before the campaign starts, so the flow
    // can be worked on and reviewed. It is guarded on NODE_ENV rather than on
    // a secret, which means it is not a backdoor that needs protecting: Next
    // substitutes the value at build time, so in a production build this
    // whole branch is `false && ...` and the bundler removes it. There is no
    // query string that reaches it on the live site.
    const preview =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("preview") === "open";

    setOpen(preview || hasPassed(opensAt));
    setChecked(true);
  }, [opensAt]);

  const set = (field: Field) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const shareLink = useMemo(() => {
    if (!done) return "";
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}${monicaRoutes.join}?ref=${done.referralCode}`;
  }, [done]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setErrors({});

    if (!accepted) {
      setErrors({ acceptedRules: "You need to accept the campaign rules." });
      return;
    }
    if (!values.x && !values.instagram && !values.tiktok) {
      setErrors({ x: "Add at least one account you will be publishing from." });
      return;
    }

    setSubmitting(true);
    try {
      const preview =
        process.env.NODE_ENV !== "production" &&
        new URLSearchParams(window.location.search).get("preview") === "open";

      const response = await fetch(
        `/api/campaigns/monica/register${preview ? "?preview=open" : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            audienceSize: values.audienceSize || undefined,
            location: values.location || undefined,
            acceptedRules: true,
            rulesVersion: MONICA_RULES_VERSION,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        if (result.field)
          setErrors({ [result.field as Field]: result.message });
        else setFormError(result.message ?? "Something went wrong.");
        return;
      }

      track("campaign_registered", { campaign: "monica-money-story" });
      setDone({ name: result.name, referralCode: result.referralCode });
    } catch {
      setFormError(
        "We could not reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!checked || !open) {
    return (
      <div className="rounded-xl border border-white/20 bg-white/5 p-6 sm:p-8">
        <p className="flex items-center gap-2 text-base font-semibold text-white">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Entries are not open yet
        </p>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-white/60">
          Registration opens when the campaign starts on Monday 14 September.
          Read the{" "}
          <Link
            href={monicaRoutes.rules}
            className="text-link underline underline-offset-2 hover:text-white"
          >
            campaign rules
          </Link>{" "}
          in the meantime, so you are ready to go on day one.
        </p>
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/50">
            Developing locally? Add{" "}
            <code className="text-white/80">?preview=open</code> to this URL to
            work on the form before the campaign starts. The flag is compiled
            out of production builds.
          </p>
        )}
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-brand-gold/40 bg-brand-gold/5 p-6 sm:p-8">
        <p className="flex items-center gap-2 text-lg font-bold text-white">
          <Check className="h-5 w-5 text-brand-gold" aria-hidden="true" />
          You are in, {done.name.split(" ")[0]}
        </p>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-white/70">
          The first challenge is on the campaign page. Publish your entry on
          your own account, then come back and submit the link.
        </p>

        <div className="mt-6">
          <p className="eyebrow text-white/60">Your referral link</p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/60">
            Bring another creator in with this. Points land once they have their
            first approved entry, so it is worth sending to people who will
            actually post.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <code className="flex-1 truncate rounded-lg border border-white/20 bg-ground px-4 py-3 text-sm text-white">
              {shareLink}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(shareLink);
                setCopied(true);
                track("campaign_referral_copied", {
                  campaign: "monica-money-story",
                });
              }}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <Link
          href={monicaRoutes.landing}
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
        >
          See the first challenge
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-10 rounded-2xl border border-white/20 bg-white/5 p-6 sm:p-8"
    >
      <Section title="About you">
        <div className="grid gap-5 sm:grid-cols-2">
          <Labelled
            label="Full name"
            htmlFor="fullName"
            error={errors.fullName}
          >
            <input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              value={values.fullName}
              onChange={(e) => set("fullName")(e.target.value)}
              className={inputClass}
              placeholder="Ada Obi"
            />
          </Labelled>
          <Labelled label="Email" htmlFor="email" error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={(e) => set("email")(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </Labelled>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Labelled
            label="Phone number"
            htmlFor="phone"
            hint="Country code if you are outside Nigeria."
            error={errors.phone}
          >
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={values.phone}
              onChange={(e) => set("phone")(e.target.value)}
              className={inputClass}
              placeholder="0803 000 0000"
            />
          </Labelled>
          <Labelled
            label="What do you make?"
            htmlFor="contentNiche"
            hint="Comedy, finance, tech, lifestyle."
            error={errors.contentNiche}
          >
            <input
              id="contentNiche"
              name="contentNiche"
              required
              value={values.contentNiche}
              onChange={(e) => set("contentNiche")(e.target.value)}
              className={inputClass}
              placeholder="Finance explainers"
            />
          </Labelled>
        </div>
      </Section>

      <Section
        title="Where you will publish"
        hint="At least one. Entries have to come from an account listed here, so add the ones you will actually post from."
      >
        <div className="flex flex-col gap-3">
          {(
            [
              ["x", "X"],
              ["instagram", "Instagram"],
              ["tiktok", "TikTok"],
            ] as const
          ).map(([field, label]) => (
            // The platform sits inside the field rather than in a label column
            // beside it, so the three rows line up as one control instead of
            // three mismatched ones.
            <div
              key={field}
              className="flex items-center gap-0 overflow-hidden rounded-lg border border-white/15 bg-ground focus-within:border-brand-gold"
            >
              <span className="w-24 shrink-0 border-r border-white/15 px-3 py-3 text-sm text-white/60">
                {label}
              </span>
              <span className="pl-3 text-white/30" aria-hidden="true">
                @
              </span>
              <input
                id={field}
                name={field}
                aria-label={`${label} username`}
                value={values[field]}
                onChange={(e) => set(field)(e.target.value)}
                className="w-full bg-transparent px-2 py-3 text-base text-white placeholder:text-white/30 focus:outline-none"
                placeholder="yourhandle"
              />
            </div>
          ))}
        </div>
        {errors.x && (
          <p role="alert" className="text-sm text-red-300">
            {errors.x}
          </p>
        )}
      </Section>

      <Section title="Optional" hint="Helps us understand who is taking part.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Labelled
            label="Audience size"
            htmlFor="audienceSize"
            hint="Roughly, across your accounts."
            error={errors.audienceSize}
          >
            <input
              id="audienceSize"
              name="audienceSize"
              inputMode="numeric"
              value={values.audienceSize}
              onChange={(e) =>
                set("audienceSize")(e.target.value.replace(/\D/g, ""))
              }
              className={inputClass}
              placeholder="5000"
            />
          </Labelled>
          <Labelled label="Where you are" htmlFor="location">
            <input
              id="location"
              name="location"
              autoComplete="address-level2"
              value={values.location}
              onChange={(e) => set("location")(e.target.value)}
              className={inputClass}
              placeholder="Lagos, Nigeria"
            />
          </Labelled>
        </div>
      </Section>

      <div className="flex flex-col gap-6 border-t border-white/15 pt-8">
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                setErrors((err) => ({ ...err, acceptedRules: undefined }));
              }}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand-gold"
            />
            <span className="text-sm leading-relaxed text-white/70">
              I have read and accept the{" "}
              <Link
                href={monicaRoutes.rules}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                campaign rules
              </Link>{" "}
              (version {MONICA_RULES_VERSION}), and I am 18 or over. Blockfest
              Africa may contact me about this campaign.
            </span>
          </label>
          {errors.acceptedRules && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {errors.acceptedRules}
            </p>
          )}
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
          >
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60 sm:self-start"
        >
          {submitting ? "Registering..." : "Register for the campaign"}
          {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
