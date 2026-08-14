import {
  formatNaira,
  ticketGroups,
  tiersInGroup,
  type TicketTier,
} from "@/lib/tickets";
import { TicketCTA } from "./ticket-cta";
import { CalendarDays, Check, Crown, Presentation, Wrench, X } from "lucide-react";

function TierCard({ tier }: { tier: TicketTier }) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 transition-colors duration-300 ${
        tier.featured || tier.bestSeller
          ? "border-brand-blue bg-white/10 hover:bg-white/20"
          : "border-white/20 bg-white/5 hover:bg-white/20"
      }`}
    >
      {/* A row rather than one absolute badge, so a tier carrying both labels
          sets them side by side instead of stacking them on top of each other. */}
      {(tier.featured || tier.bestSeller) && (
        <div className="absolute -top-3 left-6 right-6 flex flex-wrap items-center gap-2">
          {tier.featured && (
            <span className="eyebrow rounded-full bg-brand-gold px-3 py-1 text-black">
              Most popular
            </span>
          )}
          {tier.bestSeller && (
            <span className="eyebrow rounded-full bg-brand-blue px-3 py-1 text-white">
              Best seller
            </span>
          )}
        </div>
      )}

      <h3 className="text-lg font-bold text-white lg:text-2xl">{tier.name}</h3>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-bold tabular-nums text-white">
          {formatNaira(tier.price)}
        </span>
        {tier.standardPrice && (
          <span className="text-base tabular-nums text-white/60 line-through">
            {formatNaira(tier.standardPrice)}
          </span>
        )}
      </div>
      {tier.standardPrice && (
        <p className="mt-2 text-xs font-semibold text-brand-gold">
          {tier.discountLabel
            ? `Early bird · ${tier.discountLabel}`
            : "Team discount · not an early bird rate"}
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {/* Days lead, and in brighter type than the rest: which days a pass
            covers is the first thing a buyer needs to settle, and it used to
            sit above the price as an eyebrow where it read as a subtitle
            rather than as part of what the ticket gets you. */}
        {tier.days.map((day) => (
          <li key={day.label} className="flex items-start gap-3">
            <CalendarDays
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
              aria-hidden="true"
            />
            <span className="text-sm leading-relaxed">
              <span className="font-semibold text-white/90">{day.label}</span>
              <span className="block text-white/60">{day.date}</span>
            </span>
          </li>
        ))}
        {tier.includes.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue-light"
              aria-hidden="true"
            />
            <span className="text-sm leading-relaxed text-white/60">
              {item}
            </span>
          </li>
        ))}
        {tier.excludes?.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <X className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
            <span className="text-sm leading-relaxed text-white/60">
              <span className="sr-only">Not included: </span>
              Does not include {item.charAt(0).toLowerCase() + item.slice(1)}
            </span>
          </li>
        ))}
      </ul>

      {tier.note && (
        <p className="mt-5 rounded-md border border-white/20 bg-white/5 p-3 text-xs leading-relaxed text-white/60">
          {tier.note}
        </p>
      )}

      <div className="mt-6 border-t border-white/20 pt-4">
        <p className="eyebrow text-white/60">Best for</p>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          {tier.bestFor}
        </p>
      </div>

      <div className="mt-auto pt-6">
        <TicketCTA
          source={`Tickets Page - ${tier.name}`}
          variant={tier.featured ? "gold" : "outline"}
          className="w-full"
        >
          Get {tier.name}
        </TicketCTA>
      </div>
    </div>
  );
}

const groupIcons = {
  presentation: Presentation,
  wrench: Wrench,
  crown: Crown,
} as const;

export function TicketTiers() {
  return (
    <section id="tiers" className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <h2 className="text-display-sm font-bold text-white">
            Choose Your Pass
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            Ten passes across three days.
          </p>
        </div>

        <div className="flex flex-col gap-14 lg:gap-16">
          {ticketGroups.map((group) => {
            const Icon = groupIcons[group.icon];
            return (
              <div key={group.id}>
                <div className="mb-6 max-w-2xl">
                  <h3 className="flex items-center gap-3 text-2xl font-bold text-white lg:text-3xl">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {group.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">
                    {group.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {tiersInGroup(group.id).map((tier) => (
                    <TierCard key={tier.id} tier={tier} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
