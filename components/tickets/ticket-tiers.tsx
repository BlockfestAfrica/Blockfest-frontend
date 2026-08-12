import { FaCheck } from "react-icons/fa6";
import {
  formatNaira,
  ticketGroups,
  tiersInGroup,
  type TicketTier,
} from "@/lib/tickets";
import { TicketCTA } from "./ticket-cta";

function TierCard({ tier }: { tier: TicketTier }) {
  return (
    <div
      className={`relative flex flex-col rounded-xl p-6 lg:p-7 transition-colors duration-300 ${
  tier.featured
   ? "bg-white/10 border border-brand-gold/40"
   : "bg-white/5 border border-white/20 hover:bg-white/20"
  }`}
    >
      {tier.featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
          Most popular
        </span>
      )}

      <h3 className="text-lg lg:text-2xl font-bold text-white">{tier.name}</h3>
      <p className="mt-1 text-xs uppercase tracking-wide text-white/60">
        {tier.days}
      </p>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-bold text-white tabular-nums">
          {formatNaira(tier.price)}
        </span>
        {tier.standardPrice && (
          <span className="text-base text-white/60 line-through tabular-nums">
            {formatNaira(tier.standardPrice)}
          </span>
        )}
      </div>
      {tier.standardPrice && (
        <p className="mt-1.5 text-xs font-semibold text-brand-gold">
          {tier.discountLabel
            ? `Early bird · ${tier.discountLabel}`
            : "Discounted rate"}
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-2.5">
        {tier.includes.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <FaCheck className="mt-1 shrink-0 text-[11px] text-brand-blue-light" />
            <span className="text-sm leading-relaxed text-white/60">
              {item}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-white/20 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60">
          Best for
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          {tier.bestFor}
        </p>
      </div>

      <div className="mt-6 flex-grow" />

      <TicketCTA
        source={`Tickets Page - ${tier.name}`}
        variant={tier.featured ? "gold" : "outline"}
        className="w-full"
      >
        Get {tier.name}
      </TicketCTA>
    </div>
  );
}

export function TicketTiers() {
  return (
    <section
      id="tiers"
      className="relative bg-ground border-t border-white/20 py-14 lg:py-20"
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white lg:text-5xl">
            Choose Your Pass
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/60">
            Ten passes across three days.
          </p>
        </div>

        <div className="flex flex-col gap-14 lg:gap-16">
          {ticketGroups.map((group) => (
            <div key={group.id}>
              <div className="mb-7">
                <h3 className="text-2xl font-bold text-white lg:text-3xl">
                  {group.title}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
                  {group.description}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {tiersInGroup(group.id).map((tier) => (
                  <TierCard key={tier.id} tier={tier} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
