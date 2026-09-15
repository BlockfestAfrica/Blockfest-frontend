"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Loader2, Lock } from "lucide-react";
import { hasPassed } from "@/lib/countdown";
import { CAMPAIGN_GATE_FORCED_OPEN, monicaRoutes } from "@/lib/campaigns";
import { MONICA_RULES_VERSION } from "@/lib/monica-rules";
import { MONICA_PRIVACY_VERSION } from "@/lib/monica-privacy";
import { toast } from "sonner";
import { control } from "@/components/shared/panel";
import { CAMPAIGN_EVENTS, track } from "@/lib/sabilytics";

type Field =
  | "fullName"
  | "email"
  | "phone"
  | "x"
  | "instagram"
  | "tiktok"
  | "monicaTag"
  | "referralCode"
  | "audienceSize"
  | "location"
  | "acceptedRules";

/**
 * The fields that actually render an error when one is set against them.
 *
 * The server names the field a 400 belongs to and the client shows it there.
 * That only works if something on the page is watching that name: three of
 * these once were not, so a creator whose Instagram handle contained a space
 * got a silent form and no way to discover why. Anything not listed here falls
 * back to the form-level message, which is worse placement but is never
 * nothing.
 */
const FIELDS_WITH_VISIBLE_ERRORS: ReadonlySet<Field> = new Set<Field>([
  "fullName",
  "email",
  "phone",
  "x",
  "instagram",
  "tiktok",
  "monicaTag",
  "referralCode",
  "audienceSize",
  "location",
  "acceptedRules",
]);

const EMPTY: Record<Field, string> = {
  fullName: "",
  email: "",
  phone: "",
  x: "",
  instagram: "",
  tiktok: "",
  monicaTag: "",
  referralCode: "",
  audienceSize: "",
  location: "",
  acceptedRules: "",
};

/*
 * The system's recipe, not a local twin of it. This file carried its own
 * input string, and by the time the design review looked it had drifted from
 * `control` on three counts: the softer border tier, the missing min-height
 * guarantee, and a gold focus border firing beside the global blue ring, the
 * exact double focus voice the craft pass removed from the system. A local
 * copy of a recipe is where the next drift starts, so there is no copy.
 */
const inputClass = control;

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
    /*
     * Separated by a rule rather than boxed.
     *
     * The form was one bordered card wrapping three more, which gave every
     * group the same weight and made a short form look like a long one. A
     * hairline and real space between groups reads faster and asks for less.
     */
    <section className="border-t border-line pt-8 first:border-0 first:pt-0">
      <h2 className="eyebrow text-brand-gold">{title}</h2>
      {hint && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-4">
          {hint}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Labelled({
  label,
  hint,
  error,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  /** Marks the field visibly, not just in the markup. */
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    /*
     * Four rows, shared with the field beside it.
     *
     * Two fields sit side by side and their labels, hints, inputs and errors
     * have to line up across the pair even though each part is a different
     * height in each column. This used to bottom-align the input with mt-auto,
     * which worked until an error appeared: the column carrying it grew, and
     * because the error sits below the input, that column's input ended up
     * higher than its neighbour's. The phone message wraps to two lines in a
     * half-width column, so the gap was visible rather than theoretical.
     *
     * Subgrid makes the two columns share the parent's row tracks, so each part
     * aligns with its opposite number whatever either one contains. The empty
     * divs matter: they hold a field's place in the hint and error rows so the
     * rows stay in step when only one column has either.
     *
     * Below sm the fields stack and none of this applies, so it is a plain
     * flex column there.
     */
    <div className="flex flex-col sm:row-span-4 sm:grid sm:grid-rows-subgrid sm:gap-0">
      {/* The asterisk sits beside the label rather than inside it. Inside, it
          becomes part of the field's accessible name, so the control announces
          itself as "Full name star" and every lookup by label has to know that.
          It is aria-hidden for the same reason: the input already carries the
          required attribute, which is what assistive technology reads, so this
          is purely the visible half and repeating it would be noise.

          Visible at all because the form sets noValidate to word its own
          messages, so the browser enforces nothing and nothing on screen told a
          creator which fields they could skip. */}
      <div className="flex items-baseline gap-1">
        <label
          htmlFor={htmlFor}
          className="block text-sm font-semibold text-white"
        >
          {label}
        </label>
        {required && (
          <span
            className="text-base font-bold leading-none text-red-400"
            aria-hidden="true"
          >
            *
          </span>
        )}
      </div>

      <div>{hint && <p className="mt-1 text-sm text-ink-4">{hint}</p>}</div>

      <div className="pt-2">{children}</div>

      <div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
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
export function RegistrationForm({
  opensAt,
  arrivedViaReferral = false,
  initialRef = "",
}: {
  opensAt: string;
  /**
   * True when they arrived carrying a referral: the /join cookie, or ?ref on
   * this page's own URL. Analytics only now. The referral field below is on
   * the page for everyone, so nothing renders or hides on this.
   */
  arrivedViaReferral?: boolean;
  /**
   * A code the server already knows, from the URL or the /join cookie. It
   * prefills the visible field, where the creator can see it and change it.
   */
  initialRef?: string;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [values, setValues] = useState<Record<Field, string>>(() => ({
    ...EMPTY,
    // Upper-cased defensively, so a prefill can never break the invariant the
    // input maintains as somebody types.
    referralCode: initialRef.toUpperCase(),
  }));
  const [accepted, setAccepted] = useState(false);
  /**
   * Optional, and false until somebody actively says otherwise. Refusing it
   * changes nothing about the entry, which is what keeps the campaign's own
   * lawful basis separate from this one.
   */
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    name: string;
    referralCode: string;
    accessToken: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedLink, setSavedLink] = useState(false);
  /** Filled only by something that fills every input it finds. */
  const [website, setWebsite] = useState("");
  /** When the form became fillable, for the timing check on the server. */
  const shownAt = useRef<number>(0);

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

    const isOpen = preview || CAMPAIGN_GATE_FORCED_OPEN || hasPassed(opensAt);
    setOpen(isOpen);
    setChecked(true);
    shownAt.current = Date.now();

    /*
     * Counted only when the form can actually be filled in.
     *
     * Firing on every load of this page would count everybody who arrived
     * before the campaign opened and saw a locked panel, and the funnel would
     * then show a conversion rate that is mostly a measure of how many people
     * came early.
     */
    if (isOpen) {
      track(CAMPAIGN_EVENTS.registerStarted);

      /*
       * Arrived through somebody's referral link, by either path: the /join
       * cookie or ?ref on the register URL itself.
       *
       * Passed down from the server, because the cookie /join sets is
       * httpOnly and document.cookie cannot see it. Reading it here would
       * have compiled, run, and silently never fired, which is the worst
       * shape for an analytics bug: the number is simply zero and looks like
       * a finding.
       */
      if (arrivedViaReferral) {
        track(CAMPAIGN_EVENTS.referralLinkUsed);
      }
    }
  }, [opensAt, arrivedViaReferral]);

  /**
   * A failure that belongs to the whole form rather than one field.
   *
   * Shown in both places on purpose. The inline banner persists, so somebody
   * who looks away and back still has the reason in front of them; the toast
   * is what carries it to a creator whose attention is at the bottom of a long
   * form, where a message rendered above the button is easy to miss entirely.
   */
  const failForm = (message: string) => {
    setFormError(message);
    toast.error(message);
  };

  /**
   * Move to the field a server error belongs to.
   *
   * Guarded because the id is not always an input: acceptedRules is a checkbox
   * rendered without one, and a field the page does not display reaches here
   * only if the set above ever falls out of step with the markup.
   */
  const focusField = (field: Field) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(field);
    if (!(el instanceof HTMLElement)) return;

    // Focus first, and guard both calls separately.
    //
    // This runs inside the submit handler's try block, so anything thrown here
    // is caught by it and reported as "we could not reach the server", which
    // would be a lie about a request that succeeded and came back with a
    // perfectly good field error. scrollIntoView is exactly the kind of call
    // that is missing in some environments, so it must not be able to take the
    // focus down with it, and neither may take the message down.
    try {
      el.focus({ preventScroll: true });
    } catch {
      // Focus is a courtesy. The inline message and the toast still stand.
    }
    try {
      el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    } catch {
      // Focus alone already brings most browsers to the field.
    }
  };

  const set = (field: Field) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /** The creator's own way back in. Built here because the token is only ever
   *  in memory on this screen. */
  const accessLink = useMemo(() => {
    if (!done?.accessToken) return "";
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}${monicaRoutes.enter}?t=${done.accessToken}`;
  }, [done]);

  const shareLink = useMemo(() => {
    if (!done?.referralCode) return "";
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}${monicaRoutes.join}?ref=${done.referralCode}`;
  }, [done]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setErrors({});

    // Checked here as well as on the server. noValidate means the browser
    // enforces nothing, so without this an empty name costs a round trip to be
    // told something the page already knew. The server still refuses the same
    // things; this only saves the wait.
    const missing = (
      [
        ["fullName", "Add your name."],
        ["email", "Add your email address."],
        [
          "phone",
          "Add your phone number, with country code if you are outside Nigeria.",
        ],
        ["monicaTag", "Enter your Monica username."],
      ] as const
    ).find(([field]) => !values[field].trim());

    if (missing) {
      setErrors({ [missing[0]]: missing[1] });
      return;
    }

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
            // Named `ref` on the wire because that is what /join's cookie and
            // the schema already call it. Always sent, even blank: an empty
            // string is how a deliberately cleared box suppresses the cookie
            // fallback instead of being silently re-credited from it.
            ref: values.referralCode.trim(),
            rulesVersion: MONICA_RULES_VERSION,
            marketingOptIn: marketing,
            privacyVersion: MONICA_PRIVACY_VERSION,
            // Both of these are the bot checks. They are spread in explicitly
            // rather than carried by ...values, because `values` is typed to
            // the visible fields only and silently omitted them: the checks
            // existed, were tested in isolation, and never ran on one real
            // request.
            hp_contact: website,
            // Zero means the mount effect has not run, which is not the same
            // as "submitted instantly" and must not be reported as it.
            elapsedMs:
              shownAt.current === 0 ? undefined : Date.now() - shownAt.current,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        const field = result.field as Field | undefined;
        if (field && FIELDS_WITH_VISIBLE_ERRORS.has(field)) {
          setErrors({ [field]: result.message });
          // Inline alone was not enough. The message renders beside its field,
          // which on a form this long can be well above the button that was
          // just pressed, so somebody sees the button settle and nothing else.
          // The toast says it out loud and the focus takes them to the field
          // it belongs to, which a toast on its own cannot do.
          toast.error(result.message);
          focusField(field);
        } else {
          // Either the server named no field, or it named one nothing on this
          // page displays. Both have to say something: a submit that returns
          // the button to its resting state and changes nothing else reads as
          // a broken site, and the creator leaves.
          failForm(result.message ?? "Something went wrong.");
        }
        return;
      }

      track(CAMPAIGN_EVENTS.registerCompleted);
      setDone({
        name: result.name,
        referralCode: result.referralCode ?? null,
        accessToken: result.accessToken ?? null,
      });
    } catch {
      failForm(
        "We could not reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!checked || !open) {
    return (
      <div className="rounded-xl border-l-2 border-line-3 bg-card p-6 pl-5 sm:p-8 sm:pl-6">
        <p className="flex items-center gap-2 text-base font-semibold text-white">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Entries are not open yet
        </p>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-3">
          Registration opens when the campaign starts on Wednesday 16
          September.
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
          <p className="mt-4 rounded-lg border border-line-2 bg-card-2 px-4 py-3 text-sm text-ink-4">
            Developing locally? Add{" "}
            <code className="text-ink-2">?preview=open</code> to this URL to
            work on the form before the campaign starts. The flag is compiled
            out of production builds.
          </p>
        )}
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-card p-6 sm:p-8">
        <p className="flex items-center gap-2 text-lg font-bold text-white">
          <Check className="h-5 w-5 text-brand-gold" aria-hidden="true" />
          You are in, {done.name.split(" ")[0]}
        </p>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-2">
          The first challenge is on the campaign page. Publish your entry on
          your own account, then come back and submit the link.
        </p>

        {/* Shown once, and genuinely once.
            Only a hash of this is stored, so nobody can read it back to the
            creator later, including us. That is deliberate: a secret we could
            replay is a secret that can be taken from us. The cost is that
            losing the link means asking for a new one, so the warning has to
            be unmissable rather than tucked under the fold. */}
        {/* A hairline card, not the amber warn bar: the owner ruled coloured
            containers out and the screen reads calmer for it. The warning
            weight lives in the headline type instead. */}
        {done.accessToken && (
          <div className="mt-6 rounded-xl border border-line-2 bg-card p-4 sm:p-5">
            <p className="text-base font-bold text-white">
              Save this link. It is shown once.
            </p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
              It opens your own page, where your points and entries live and
              where you will submit each entry. We store only a fingerprint of
              it, so we cannot send it to you again. Bookmark it, or send it to
              yourself now. If you do lose it, write to
              partnership@blockfestafrica.com from the address you registered
              with and we will issue a new one.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <code className="w-full min-w-0 flex-1 truncate rounded-lg border border-line-2 bg-ground px-4 py-3 text-sm text-white">
                {accessLink}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(accessLink);
                  setSavedLink(true);
                  toast.success("Your personal link is copied");
                }}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-line-2 px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-card-3"
              >
                {savedLink ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {savedLink ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {shareLink ? (
          <div className="mt-6">
            <p className="eyebrow text-ink-3">Your referral link</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
              Bring another creator in with this. Points land once they have
              their first approved entry, so it is worth sending to people who
              will actually post.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <code className="w-full min-w-0 flex-1 truncate rounded-lg border border-line-2 bg-ground px-4 py-3 text-sm text-white">
                {shareLink}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareLink);
                  setCopied(true);
                  // The button swaps to a tick, which says it worked but not
                  // what worked. On a screen where the only other action is
                  // "share this", naming the thing that landed on the
                  // clipboard is worth a line.
                  toast.success("Referral link copied");
                  track(CAMPAIGN_EVENTS.referralCopied);
                }}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-line-2 px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-card-3"
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
        ) : (
          // No code came back. Rather than render .../join?ref=null, say
          // nothing about referrals and point at the campaign. This is the
          // path a false positive on the bot checks lands on, and it must not
          // hand somebody a broken link dressed as a reward.
          <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-3">
            Your referral link will be on your dashboard shortly. If you do not
            see it, get in touch at partnership@blockfestafrica.com.
          </p>
        )}

        {/* Their own page, not the landing anchor. The stages list is
            read-only and registering ends with nothing to click there; the
            personal page holds the challenge, the submit box and their
            status, and landing on it once more makes it a bookmark. The
            anchor fallback only serves the rare state with no token. */}
        <a
          href={done.accessToken ? accessLink : `${monicaRoutes.landing}#stages`}
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-150 hover:bg-brand-gold-hover"
        >
          Open your page, the challenge is there
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-10">
      {/* Shown only while the gate has been opened ahead of the real date. A
          creator who finds this page early would otherwise register in good
          faith, share a referral code, and be quietly removed when the
          database is cleared before launch. Telling them costs one paragraph;
          not telling them costs somebody their referrals. */}
      {CAMPAIGN_GATE_FORCED_OPEN && !hasPassed(opensAt) && (
        <p
          role="status"
          className="rounded-lg border border-line-2 bg-card-2 px-4 py-3 text-sm leading-relaxed text-ink-2"
        >
          <strong className="font-semibold text-white">
            This is a test run.
          </strong>{" "}
          The campaign opens on Wednesday 16 September and everything registered
          before then is deleted beforehand. Please register again on launch day
          so your entry and referrals count.
        </p>
      )}
      {/* Not display:none, which some scripts skip, and not visibility:hidden
          either. It is pushed off-screen, taken out of the tab order and
          hidden from assistive technology, so a person never meets it and a
          script filling every input it finds does. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        {/* Named for nothing a password manager recognises. It was
            id/name="website" with the label "Website", which is exactly
            what autofill heuristics target, so a manager filling the form
            tripped the honeypot and the creator was told they had
            registered while nothing was written. autoComplete="new-password"
            and the ignore attributes are the belt to that braces. */}
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
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <Section title="About you">
        <div className="grid gap-5 sm:grid-cols-2 sm:grid-rows-[auto_auto_auto_auto] sm:gap-y-0">
          <Labelled
            label="Full name"
            htmlFor="fullName"
            required
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
          <Labelled label="Email" htmlFor="email" error={errors.email} required>
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

        <div className="grid gap-5 sm:grid-cols-2 sm:grid-rows-[auto_auto_auto_auto] sm:gap-y-0">
          <Labelled
            label="Phone number"
            htmlFor="phone"
            required
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
            label="Monica tag"
            htmlFor="monicaTag"
            required
            hint="Your username on Monica. This is how prize money reaches you, so check it."
            error={errors.monicaTag}
          >
            <input
              id="monicaTag"
              name="monicaTag"
              required
              value={values.monicaTag}
              onChange={(e) => set("monicaTag")(e.target.value)}
              className={inputClass}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="yourname"
            />
            {/* Plenty of creators arrive without a Monica account at all,
                and the tag is where prize money goes, so the way to get one
                lives beside the box that demands it. New tab: filling the
                rest of this form must survive the trip to the app store. */}
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              No Monica tag yet?{" "}
              <a
                href="https://monica.cash/"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                Get yours on Monica
              </a>
              : download the app, register, verify your identity, and your tag
              appears in your profile. Then come back and enter it here.
            </p>
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
            <div key={field}>
              <div className="flex items-center gap-0 rounded-lg border border-line bg-control transition-colors duration-150 focus-within:border-line-3">
                <span className="w-24 shrink-0 border-r border-line px-3 py-3 text-sm text-ink-3">
                  {label}
                </span>
                <span className="pl-3 text-ink-4" aria-hidden="true">
                  @
                </span>
                <input
                  id={field}
                  name={field}
                  aria-label={`${label} username`}
                  value={values[field]}
                  onChange={(e) => set(field)(e.target.value)}
                  className="w-full bg-transparent px-2 py-3 text-base text-white placeholder:text-ink-4"
                  placeholder="yourhandle"
                />
              </div>
              {/* Each row owns its own error. One shared slot showing only
                  errors.x meant a bad Instagram or TikTok handle was rejected
                  by the server and reported nowhere. */}
              {errors[field] && (
                <p role="alert" className="mt-2 text-sm text-red-300">
                  {errors[field]}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Optional" hint="Helps us understand who is taking part.">
        <div className="grid gap-5 sm:grid-cols-2 sm:grid-rows-[auto_auto_auto_auto] sm:gap-y-0">
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
          <Labelled
            label="Where you are"
            htmlFor="location"
            error={errors.location}
          >
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
        {/*
          * On the page for everyone, whatever brought them here.
          *
          * This used to hide when /join had set the referral cookie, on the
          * theory that the cookie made typing redundant. Hiding it also hid
          * the only place a code could be corrected or added late, and codes
          * travel as bare strings in WhatsApp messages and lost links far
          * more than as clicks. So the box always exists: prefilled when a
          * link carried the code in, empty otherwise, and what is in it is
          * what the server uses.
          *
          * Optional, and wrong codes are ignored rather than refused. A typo
          * here should cost the referrer their referral points, not cost the person
          * registering their place in the campaign.
          */}
        <div className="mt-6">
          <Labelled
            label="Referral code"
            htmlFor="referralCode"
            hint={
              initialRef
                ? "This came with the link that brought you here. Edit it if it is not the code you were given; whoever it belongs to gets the credit."
                : "Optional. If another creator gave you a code, enter it and they get the credit."
            }
            error={errors.referralCode}
          >
            <input
              id="referralCode"
              name="referralCode"
              value={values.referralCode}
              onChange={(e) =>
                set("referralCode")(e.target.value.toUpperCase())
              }
              className={inputClass}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              placeholder="R3WW9GHF"
            />
          </Labelled>
        </div>
      </Section>

      <div className="flex flex-col gap-6 border-t border-line-2 pt-8">
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              required
              onChange={(e) => {
                setAccepted(e.target.checked);
                setErrors((err) => ({ ...err, acceptedRules: undefined }));
              }}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand-gold"
            />
            <span className="text-sm leading-relaxed text-ink-2">
              I have read and accept the{" "}
              <Link
                href={monicaRoutes.rules}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                campaign rules
              </Link>{" "}
              , and I am 18 or over. Blockfest
              Africa may contact me about this campaign, and will handle my
              details as set out in the{" "}
              <Link
                href={monicaRoutes.privacy}
                className="text-link underline underline-offset-2 hover:text-white"
              >
                privacy notice
              </Link>
              .{" "}
              <span
                className="text-base font-bold leading-none text-red-400"
                aria-hidden="true"
              >
                *
              </span>
            </span>
          </label>
          {errors.acceptedRules && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {errors.acceptedRules}
            </p>
          )}
        </div>

        {/* Deliberately a second, separate question.
            Hearing about future campaigns is a different purpose from running
            this one, so it cannot ride on the agreement above: bundling them
            would make the consent worthless and take the campaign's own basis
            down with it. Unticked, never required, and saying no changes
            nothing, which is what the line under it says out loud. */}
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand-gold"
            />
            <span className="text-sm leading-relaxed text-ink-2">
              Optional. Tell me about future Blockfest Africa campaigns and
              events by email.
            </span>
          </label>
          <p className="mt-2 pl-7 text-sm leading-relaxed text-ink-4">
            Nothing to do with this campaign. Leaving it unticked has no effect
            on your entry or your chances, and you can stop the emails at any
            time.
          </p>
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
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-150 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60 sm:self-start"
        >
          {submitting ? "Registering…" : "Register for the campaign"}
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
