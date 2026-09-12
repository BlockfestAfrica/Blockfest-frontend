import type { ReactNode } from "react";

/**
 * The few shapes every campaign and admin screen is built from.
 *
 * These pages were card after identical card: rounded-xl, border-white/20,
 * bg-white/5, every one the same weight. Nothing drew the eye, so a page read
 * as an undifferentiated list and you had to read all of it to find the one
 * thing you came for.
 *
 * The fix is not more boxes. It is fewer: most content sits directly on the
 * background, and a border is spent only where something genuinely needs
 * separating. Where emphasis is needed it comes from an accent edge and the
 * gold the rest of the site already uses, not from another grey rectangle.
 */

type Tone = "plain" | "quiet" | "accent" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  /* No chrome at all. The default, and most content should use it. */
  plain: "",
  /* A hairline, for something that is genuinely a separate object. */
  quiet: "rounded-xl border border-white/12 bg-white/[0.03]",
  /* The one thing on the page to act on. */
  accent: "rounded-xl border-l-2 border-brand-gold bg-brand-gold/[0.07] pl-5",
  /* Something to read before continuing. */
  warn: "rounded-xl border-l-2 border-amber-400/70 bg-amber-400/[0.06] pl-5",
  danger: "rounded-xl border-l-2 border-red-400/70 bg-red-400/[0.06] pl-5",
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
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/55">
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
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border-t border-white/15 pt-4">
      <p className="eyebrow text-white/45">{label}</p>
      <p className="mt-2 text-4xl font-bold tabular-nums leading-none text-white">
        {value}
      </p>
      {hint && <p className="mt-2 text-sm text-white/45">{hint}</p>}
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
  tone?: "neutral" | "good" | "bad" | "gold";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-white/20 text-white/65",
    good: "border-green-400/40 bg-green-400/10 text-green-300",
    bad: "border-red-400/40 bg-red-400/10 text-red-300",
    gold: "border-brand-gold/40 bg-brand-gold/10 text-brand-gold",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
