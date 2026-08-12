import Link from "next/link";
import { ArrowRight, Check, Crown, Presentation, Wrench } from "lucide-react";
import {
  EARLY_BIRD_ENDS,
  formatNaira,
  ticketGroups,
  tiersInGroup,
  TRANSFER_DEADLINE,
} from "@/lib/tickets";

/** Homepage ticket teaser — one entry point per pass family, priced from. */
const groupIcons = {
  presentation: Presentation,
  wrench: Wrench,
  crown: Crown,
} as const;

export function Tickets2026Section() {
  return (
    <section
      id="tickets"
      className="section-y bg-ground border-t border-white/20"
    >
      <div className="container-page">
        <div className="mb-10 max-w-2xl lg:mb-14">
          <p className="eyebrow text-white/60">
            EARLY BIRD · ENDS {EARLY_BIRD_ENDS.display.toUpperCase()}
          </p>
          <h2 className="text-display-sm mt-3 font-bold text-white">
            Three Days. Ten Passes.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Come for the conference, add the workshops, or take the room where
            deals get done.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ticketGroups.map((group) => {
            const tiers = tiersInGroup(group.id);
            const from = Math.min(...tiers.map((tier) => tier.price));
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
                      className="flex items-center gap-2 text-sm text-white/60"
                    >
                      <Check
                        className="h-4 w-4 shrink-0 text-brand-blue-light"
                        aria-hidden="true"
                      />
                      {tier.name}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex-grow" />

                <div className="mt-6 border-t border-white/20 pt-4">
                  <p className="text-xs uppercase tracking-wide text-white/60">
                    From
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-brand-gold">
                    {formatNaira(from)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href="/tickets"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
          >
            See all passes
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
