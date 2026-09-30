"use client";

import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { partnerPaths } from "@/lib/partner-paths";
import { trackButtonClick } from "@/lib/sabilytics";

/**
 * One card per way to partner, each with the button that starts it.
 *
 * Sponsoring is the money path, so its button alone is gold; the other three
 * are the same outlined button, so four calls to action do not compete. The
 * three email buttons share the words "Email us" and are told apart for a
 * screen reader by `label`, which starts with the same words.
 */
export function PartnerPaths({
  location,
  headingLevel = "h3",
}: {
  /** Where the buttons sit, for the click events. */
  location: string;
  /** The card titles' level: h3 under a page's h2, h4 under a section's h3. */
  headingLevel?: "h3" | "h4";
}) {
  const Title = headingLevel;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {partnerPaths.map((path) => {
        const primary = path.id === "sponsor";
        const Icon = path.href.startsWith("mailto:") ? Mail : ArrowRight;
        return (
          <li
            key={path.id}
            className="flex flex-col rounded-2xl border border-line-2 bg-card p-5"
          >
            <Title className="text-lg font-semibold text-white">{path.title}</Title>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-3">
              {path.blurb}
            </p>
            <Link
              href={path.href}
              aria-label={path.label}
              onClick={() => trackButtonClick(`Partner path: ${path.id}`, location)}
              className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors duration-200 ${
                primary
                  ? "bg-brand-gold text-black hover:bg-brand-gold-hover"
                  : "border border-line-2 text-white hover:bg-card-3"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {path.action}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
