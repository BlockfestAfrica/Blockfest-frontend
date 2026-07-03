import type { ReactNode } from "react";
import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";
import { Button } from "@/components/ui/button";

// Shared closing call-to-action band. Dark-blue background with a single gold
// button — gold reads as a pop, not a wall.
export function EventCta({
  flag,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  flag?: string;
  title: string;
  description: ReactNode;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <section className="py-12 lg:py-16 bg-gradient-to-br from-brand-blue-deep via-brand-blue-dark to-brand-blue-deep">
      <div className="max-w-3xl mx-auto px-4 lg:px-8 text-center">
        {flag && <span className="inline-block text-2xl mb-3">{flag}</span>}
        <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-white">
          {title}
        </h2>
        <p className="text-lg lg:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
          {description}
        </p>
        <Link href={ctaHref}>
          <Button
            variant="gold"
            className="rounded-full px-8 py-6 text-base lg:text-lg font-bold"
          >
            <span className="inline-flex items-center gap-2">
              {ctaLabel}
              <FaArrowRight />
            </span>
          </Button>
        </Link>
      </div>
    </section>
  );
}
