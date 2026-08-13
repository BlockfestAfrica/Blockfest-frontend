import Link from "next/link";
import { ArrowRight, Check, Crown, Presentation, Wrench } from "lucide-react";
import {
  EARLY_BIRD_ENDS,
  formatNaira,
  ticketGroups,
  tiersInGroup,
  ticketTiers,
  TRANSFER_DEADLINE,
} from "@/lib/tickets";

/**
 * Homepage ticket teaser.
 *
 * The three cards group passes by which DAYS they cover, not by price, so a
 * per-card "from" figure misleads: the Conference card starts at ₦7,500 but
 * contains CORPORATE CIRCLE at ₦150,000, and sat beside a VIP card whose "from"
 * was that same ₦150,000. The cards now answer "which days am I coming?" and a
 * single range answers "what does it cost?". /tickets owns the real pricing.
 */
const groupIcons = {
  presentation: Presentation,
  wrench: Wrench,
  crown: Crown,
} as const;

export function Tickets2026Section() {
  const prices = ticketTiers.map((tier) => tier.price);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);

  return (
    <section
      id="tickets"
      className="section-y bg-ground border-t border-white/20"
    >
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-white/60">
            EARLY BIRD · ENDS {EARLY_BIRD_ENDS.display.toUpperCase()}
          </p>
          <h2 className="text-display-sm mt-3 font-bold text-white">
            Three Days. Ten Passes.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            Come for the conference, add the workshops, or take the room where
            deals get done.
          </p>
          <p className="mt-4 text-base text-white/90">
            <span className="font-semibold text-brand-gold">
              {formatNaira(lowest)} to {formatNaira(highest)}
            </span>{" "}
            across {ticketTiers.length} passes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ticketGroups.map((group) => {
            const tiers = tiersInGroup(group.id);
            const Icon = groupIcons[group.icon];

            return (
              <div
                key={group.id}
                className="flex flex-col rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10"
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold text-white">{group.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {group.description}
                </p>

                <ul className="mt-4 flex flex-col gap-1.5">
                  {tiers.map((tier) => (
                    <li
                      key={tier.id}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/60"
                    >
                      <Check
                        className="h-4 w-4 shrink-0 text-brand-blue-light"
                        aria-hidden="true"
                      />
                      {tier.name}
                      {tier.bestSeller && (
                        <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-black">
                          Best seller
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href="/tickets"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
          >
            See all passes and prices
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="text-sm text-white/60">
            Non-refundable · transferable until {TRANSFER_DEADLINE.displayShort}
          </p>
        </div>
      </div>
    </section>
  );
}
