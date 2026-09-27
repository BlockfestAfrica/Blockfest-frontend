"use client";

import { useState } from "react";
import { Pause, Play, ShieldCheck } from "lucide-react";

/** The notice, in the order it scrolls. Plain facts; no numbers, no names. */
export const INTEGRITY_NOTICE = [
  "We spotted suspicious votes and removed them",
  "Only verified, genuine votes count",
  "Every vote is reviewed before the Community Favourite is confirmed",
  "Thanks for keeping it fair",
] as const;

/**
 * A quiet moving notice above the count, shown once an owner has removed
 * votes from the round as fraud.
 *
 * The owner wanted voters to see that farming is noticed and acted on,
 * without a wall of detail: one line that moves, on the page where the
 * numbers dropped. It appears only when it is true (the count route says a
 * fraud removal happened), and it says nothing about how many, whose, or how
 * they were found.
 *
 * Moving text that runs longer than five seconds needs a way to stop it
 * (WCAG 2.2.2), so there is a pause button, and it also stops on hover.
 * Screen readers get the line once, as static text, rather than the two
 * scrolling copies. Anyone who asked for reduced motion gets the static line
 * instead of the scroll: the global rule would otherwise freeze it half way.
 */
export function IntegrityTicker() {
  const [paused, setPaused] = useState(false);
  const line = INTEGRITY_NOTICE.join(" · ");

  return (
    <div
      className="group mt-8 flex items-center gap-2 rounded-full border border-line-2 bg-card py-1 pl-4 pr-1"
    >
      <ShieldCheck className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
      <p className="sr-only">{line}.</p>
      {/* The scroll, faded at both ends so the words glide in and out. */}
      <div
        aria-hidden="true"
        className="min-w-0 flex-1 overflow-hidden motion-reduce:hidden [mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]"
      >
        <div
          className="flex w-max animate-[vote-ticker_32s_linear_infinite] group-hover:[animation-play-state:paused]"
          style={{ animationPlayState: paused ? "paused" : undefined }}
        >
          {[0, 1].map((copy) => (
            <span key={copy} className="whitespace-nowrap pr-12 text-sm text-ink-2">
              {INTEGRITY_NOTICE.map((part, index) => (
                <span key={part}>
                  {index > 0 && (
                    <span className="px-2 text-ink-4" aria-hidden="true">
                      ·
                    </span>
                  )}
                  {part}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <p
        aria-hidden="true"
        className="hidden min-w-0 flex-1 py-2 text-sm leading-relaxed text-ink-2 motion-reduce:block"
      >
        {line}.
      </p>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Play the notice" : "Pause the notice"}
        className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors duration-150 hover:bg-card-3 hover:text-white motion-reduce:hidden"
      >
        {paused ? (
          <Play className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Pause className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
