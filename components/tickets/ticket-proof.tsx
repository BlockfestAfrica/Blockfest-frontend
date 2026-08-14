import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { blockfest2025Lagos } from "@/lib/events";

/**
 * Evidence, placed between the pitch and the price.
 *
 * A first-time buyer reaching the ten passes has been told what the event is
 * but shown no proof it happened. These are last year's audited figures from
 * lib/events.ts, so they roll over with the edition rather than ageing into a
 * lie, and the recap page is one tap away for anyone who wants to see it.
 */
const STATS = [
  { value: "12,000+", label: "attendees last year" },
  { value: "54", label: "countries represented" },
  { value: "20+", label: "speakers on stage" },
] as const;

export function TicketProof() {
  return (
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        <p className="eyebrow text-white/60">
          Lagos {blockfest2025Lagos.year}
        </p>
        <h2 className="text-display-sm mt-3 max-w-2xl font-bold text-white">
          The room you are buying into.
        </h2>

        <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block text-3xl font-bold tabular-nums text-brand-gold lg:text-4xl">
                  {stat.value}
                </span>
                <span className="mt-1 block text-sm text-white/60">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <Link
            href="/blockfest-2025"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            See last year in Lagos
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/blockfest-south-africa-2026"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            And Cape Town this year
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
