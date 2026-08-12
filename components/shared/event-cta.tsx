import type { ReactNode } from "react";
import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";
import { Button } from "@/components/ui/button";

// Shared closing call-to-action band on the site's dark ground, with the one
// gold button that makes gold mean "this is the action".
export function EventCta({
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description: ReactNode;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <section className="py-12 lg:py-16 bg-ground">
      <div className="max-w-3xl mx-auto px-4 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-white">
          {title}
        </h2>
        <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
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
