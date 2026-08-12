import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
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
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        <div className="max-w-2xl">
          <h2 className="text-display-sm font-bold text-white">{title}</h2>
          <p className="mt-4 text-base leading-relaxed text-white/90">
            {description}
          </p>
          <div className="mt-8">
            <Button
              asChild
              variant="gold"
              className="rounded-full px-7 text-base font-semibold"
            >
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
