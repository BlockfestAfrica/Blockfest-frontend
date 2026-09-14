import type { ReactNode } from "react";

/**
 * The few shapes every campaign and admin screen is built from.
 *
 * These pages were card after identical card: rounded-xl, border-line-2,
 * bg-card-2, every one the same weight. Nothing drew the eye, so a page read
 * as an undifferentiated list and you had to read all of it to find the one
 * thing you came for.
 *
 * The fix is not more boxes. It is fewer: most content sits directly on the
 * background, and a border is spent only where something genuinely needs
 * separating. Where emphasis is needed it comes from an accent edge and the
 * gold the rest of the site already uses, not from another grey rectangle.
 */

type Tone = "plain" | "quiet" | "accent" | "warn" | "danger";

/*
 * The fill percentages here are the fix for "everything is grey boxes", and the
 * old numbers are worth recording because they looked reasonable.
 *
 * Composited over --color-ground #0A1628, quiet at white/[0.03] resolves to
 * rgb(17,31,44) and accent at gold/[0.07] to rgb(26,35,42). Nine, four and two
 * out of 255 apart. The one block on a page meant to be acted on was the same
 * box as the one meant to be background, and a 2px edge was carrying the entire
 * hierarchy. On a phone outdoors it carried nothing.
 *
 * At 12% the gold lands around rgb(38,44,44), roughly ten times the separation,
 * and the edge goes to 4px so it does real work rather than decorative work.
 */
const TONES: Record<Tone, string> = {
  /* No chrome at all. The default, and most content should use it. */
  plain: "",
  /* A hairline, for something that is genuinely a separate object. */
  quiet: "rounded-xl border border-line bg-card",
  /* The one thing on the page to act on. */
  accent: "rounded-xl border-l-4 border-brand-gold bg-brand-gold/[0.12] pl-5",
  /* Something to read before continuing. */
  warn: "rounded-xl border-l-4 border-amber-400 bg-amber-400/[0.12] pl-5",
  danger: "rounded-xl border-l-4 border-red-400 bg-red-400/[0.12] pl-5",
};

export function Panel({
  tone = "quiet",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  const padding = tone === "plain" ? "" : "p-5 sm:p-6";
  return (
    <div className={`${TONES[tone]} ${padding} ${className}`.trim()}>
      {children}
    </div>
  );
}

/**
 * A card with a filled header strip.
 *
 * For the one block on a page that is the reason for the visit. An edge and a
 * tint can separate an object from its background; they cannot say "start
 * here". A filled bar can, and it gives the persistent facts, the week and the
 * time left, somewhere to live that stays put while the body below changes
 * between open, submitted, paused and closed.
 *
 * Deliberately not a new tone on Panel. A tone is a treatment applied to one
 * box; this is two boxes with different rules about what goes in each, and
 * flattening that into a string would mean every caller re-deciding where the
 * divide falls.
 */
export function HeadedPanel({
  head,
  className = "",
  children,
}: {
  /** Sits in the filled strip. Dark text: the strip is gold. */
  head: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-brand-gold/30 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-brand-gold px-5 py-3 text-black sm:px-6">
        {head}
      </div>
      <div className="bg-brand-gold/[0.06] p-5 sm:p-6">{children}</div>
    </section>
  );
}

/**
 * A heading with its label above it.
 *
 * The eyebrow carries the category so the heading itself can be short. Two
 * short lines scan faster than one long one, and it means a section can be
 * found by glancing down the left edge.
 */
export function SectionHeading({
  label,
  title,
  hint,
  className = "",
}: {
  label?: string;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <p className="eyebrow text-brand-gold">{label}</p>}
      <h2
        className={`${label ? "mt-2" : ""} text-xl font-bold text-white sm:text-2xl`}
      >
        {title}
      </h2>
      {hint && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A single number worth looking at.
 *
 * No box. A rule above it and the number set large, so points and entries read
 * as figures rather than as two more cards in a stack of cards.
 */
export function Stat({
  label,
  value,
  hint,
  /**
   * Whether to draw the rule above the figure.
   *
   * On by default. Turned off when a row of figures shares one rule drawn by
   * the container, because three separate short rules at different heights read
   * as three disconnected fragments rather than one row of numbers.
   */
  rule = true,
}: {
  label: string;
  value: string | number;
  hint?: string;
  rule?: boolean;
}) {
  return (
    <div className={rule ? "border-t border-line-2 pt-4" : ""}>
      <p className="eyebrow text-ink-4">{label}</p>
      {/* Smaller on a phone. Four of these at 36px filled most of a narrow
          screen before any data, and a four digit total in a 104px column was
          already tight. */}
      <p className="mt-2 text-3xl font-bold tabular-nums leading-none text-white sm:text-4xl">
        {value}
      </p>
      {hint && <p className="mt-2 text-sm text-ink-4">{hint}</p>}
    </div>
  );
}

/**
 * A short status word, coloured by meaning.
 *
 * Small and consistent, so a list of them can be scanned down rather than read
 * across.
 */
export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "bad" | "gold" | "warn";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-line-2 text-ink-3",
    good: "border-green-400/40 bg-green-400/10 text-green-300",
    bad: "border-red-400/40 bg-red-400/10 text-red-300",
    /* Waiting on a human. Red means rejected or blocked everywhere else in
       the spine, so a queue count wearing red read as an error rather than
       as work; amber is the colour of "somebody should look". */
    warn: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    gold: "border-brand-gold/40 bg-brand-gold/10 text-brand-gold",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs tabular-nums font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ===========================================================================
 * The structural layer.
 *
 * Everything above is a surface: a thing you put content on. What the admin
 * screens were missing is an OBJECT: a bounded, named job with a beginning and
 * an end, so a screen reads as three things to do rather than eleven anonymous
 * blocks separated by margin.
 *
 * Deliberately built without a fill. A recessed panel over #0A1628 lands three
 * to ten values apart out of 255, which is the exact defect recorded in the
 * tone table above and rejected once already. So the boundary is a coloured
 * left edge and two hairlines, which survive a phone in sunlight where a 3%
 * fill does not.
 * ========================================================================= */

/** The spacing scale. Reaching for a fifth value means a new object, not a new gap. */
const GAP = {
  /** Inside a control group: a label and its input. */
  tight: "space-y-2",
  /** Between controls in the same job. */
  related: "space-y-4",
  /** Between the parts of a job. */
  section: "space-y-6",
  /** Between jobs. */
  page: "space-y-10",
} as const;

export const SPACING = GAP;

/**
 * A contained section: one functional unit, visibly one thing.
 *
 * The dashboard complaint was "disconnected looking table and data on the
 * screen", and its cause was sections separated by nothing but vertical
 * margin, so every h2 floated on the ground with its content loose beneath
 * it. This is the one containment treatment both signed-in surfaces use: a
 * hairline and a fill two values off the ground, which is the same language
 * the form controls already speak, and not the recessed tone-on-tone panel
 * that was rejected for landing invisible.
 */
export function SectionCard({
  id,
  title,
  aside,
  children,
  className = "",
}: {
  id: string;
  title?: ReactNode;
  /** A small right-aligned affordance beside the title, usually a link. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={title ? `${id}-title` : undefined}
      className={`rounded-xl border border-line bg-card p-5 sm:p-6 ${className}`}
    >
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${id}-title`} className="text-xl font-bold text-white">
            {title}
          </h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

type JobState = "todo" | "now" | "done";

/**
 * The edge carries the state, because it is the only always-visible part.
 *
 * Gold means this is the thing to do now. Green means it is done. Neutral means
 * it is waiting on something else.
 */
const JOB_EDGE: Record<JobState, string> = {
  todo: "border-l-white/15",
  now: "border-l-brand-gold",
  done: "border-l-green-400/50",
};

/**
 * One job: a bounded piece of work with a name and an outcome.
 *
 * The header rail says what it is and where it stands. The body is how you do
 * it. The foot is what does it. A screen built from these reads as a list of
 * jobs, which is what an operations console is.
 */
export function JobCard({
  id,
  step,
  title,
  hint,
  status,
  state = "todo",
  foot,
  children,
}: {
  /** Anchors the section, so a job can be linked to. */
  id: string;
  /** The small label above the title: when this is done, or which step it is. */
  step?: string;
  title: string;
  hint?: string;
  /** Where this job stands, shown in the rail. */
  status?: ReactNode;
  state?: JobState;
  /** The controls that perform the job. Separated by a rule. */
  foot?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      // scroll-mt clears the sticky console bar when a job is linked to.
      className={`scroll-mt-24 border-l-2 pl-4 sm:pl-5 ${JOB_EDGE[state]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
        <div className="min-w-0">
          {step && (
            <p
              className={`eyebrow ${
                state === "now" ? "text-brand-gold" : "text-ink-4"
              }`}
            >
              {step}
            </p>
          )}
          <h2
            id={`${id}-title`}
            className={`${step ? "mt-1" : ""} text-lg font-bold text-pretty text-white sm:text-xl`}
          >
            {title}
          </h2>
        </div>
        {status && <div className="shrink-0">{status}</div>}
      </div>

      {hint && (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">
          {hint}
        </p>
      )}

      {children && <div className="mt-4">{children}</div>}

      {foot && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {foot}
        </div>
      )}
    </section>
  );
}

/**
 * The top of a screen: what it is, then the figures, then what to do here.
 *
 * Both admin screens spent their h1 on a datum, "Week 5" and "417 joined", with
 * their own name demoted to a 12px eyebrow. A number is not a title, and the
 * figure was repeated four lines below in the stat row anyway.
 */
export function PageHeader({
  context,
  title,
  hint,
  children,
}: {
  /** Where you are, small and above. */
  context?: string;
  title: string;
  hint?: string;
  /** A row of Stat, usually. */
  children?: ReactNode;
}) {
  return (
    <header>
      {context && <p className="eyebrow text-brand-gold">{context}</p>}
      <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-pretty text-white">
        {title}
      </h1>
      {hint && (
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">
          {hint}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}

/**
 * A labelled field.
 *
 * There were seven controls across the two screens whose only visible
 * identification was a placeholder, which disappears on the first keystroke.
 * Two of them sat side by side and one of them was the prize money: once a
 * number and a sentence are typed, nothing says which box is the amount.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={GAP.tight}>
      <label htmlFor={id} className="block text-sm font-semibold text-white">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink-2">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The one input recipe.
 *
 * Never contains outline-none. globals.css defines a single site-wide
 * focus-visible ring and its own comment forbids removing it, and eighteen
 * controls removed it anyway: Tailwind's utilities layer sits after base, so
 * `focus:outline-none` silently deletes the only focus indicator the product
 * has. With no fills anywhere, that ring is the only thing saying where you are
 * in a form.
 */
export const control =
  "w-full min-h-12 rounded-lg border border-line-2 bg-control px-4 py-3 text-base text-ink placeholder:text-ink-4 transition-colors duration-150";

/**
 * A native select needs its own colours declared.
 *
 * The option list is drawn by the operating system, not the page, so on Windows
 * in dark mode an undeclared select renders dark text on dark and is unreadable.
 */
// One fill for every control, options included: the inset token reads as
// "type or choose here" and the dropdown no longer jumps to a second surface.
export const selectControl = `${control} cursor-pointer [&>option]:bg-control [&>option]:text-white`;

type Intent =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "success"
  | "dangerFill";

const INTENT: Record<Intent, string> = {
  primary: "bg-brand-gold text-black hover:bg-brand-gold-hover",
  secondary: "border border-line-2 text-white hover:bg-card-3",
  quiet: "text-ink-2 hover:text-white hover:bg-card-2",
  danger: "border border-red-400/40 text-red-300 hover:bg-red-400/15",
  /* The green and red the decide moments hand-rolled four times over. */
  success: "bg-green-400/15 text-green-300 hover:bg-green-400/25",
  dangerFill: "bg-red-400/15 text-red-300 hover:bg-red-400/25",
};

/**
 * Button classes, exported as a string as well as a component.
 *
 * Two controls on the winners screen must stay anchors: they are GETs that
 * download a file, and somebody attaches that file to an email, which needs a
 * real link. Without a class-only export those two get hand-rolled and drift.
 */
export function buttonClass(intent: Intent = "secondary", className = ""): string {
  /*
   * 150ms, not 300: a button pressed dozens of times a shift must feel
   * instant, and 300ms reads as the interface thinking about it. The press
   * scale is the tactile half: confirmation the click was heard, never below
   * 0.97 so it stays felt rather than watched. Transform and colour only,
   * both compositor-cheap.
   */
  return `inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${INTENT[intent]} ${className}`.trim();
}

/**
 * A group of choices that says what it is grouping.
 *
 * A bare row of pills is a set of buttons with no name, which a screen reader
 * reads as four unrelated controls and a person reads as four unrelated
 * controls that happen to be adjacent.
 */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="eyebrow text-ink-4">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={on}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ${
                on
                  ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
                  : "border-line-2 text-ink-2 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
