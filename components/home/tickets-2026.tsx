import Link from "next/link";
import { FaArrowRight, FaCheck } from "react-icons/fa6";
import {
  EARLY_BIRD_ENDS,
  formatNaira,
  ticketGroups,
  tiersInGroup,
  TRANSFER_DEADLINE,
} from "@/lib/tickets";

/** Homepage ticket teaser — one entry point per pass family, priced from. */
export function Tickets2026Section() {
  return (
    <section
      id="tickets"
      className="relative overflow-hidden bg-gradient-to-b from-black via-brand-navy-deep to-brand-navy py-12 lg:py-16"
    >
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 lg:px-8">
        <div className="mb-8 text-center lg:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/15 px-4 py-2">
            <span className="text-xs font-semibold tracking-wide text-brand-gold sm:text-sm">
              EARLY BIRD · ENDS {EARLY_BIRD_ENDS.display.toUpperCase()}
            </span>
          </div>
          <h2 className="mb-3 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Three Days. Ten Passes.
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/60">
            Come for the conference, add the workshops, or take the room where
            deals get done.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {ticketGroups.map((group) => {
            const tiers = tiersInGroup(group.id);
            const from = Math.min(...tiers.map((tier) => tier.price));

            return (
              <div
                key={group.id}
                className="flex flex-col rounded-xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07] lg:p-6"
              >
                <h3 className="text-lg font-bold text-white lg:text-xl">
                  {group.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {group.description}
                </p>

                <ul className="mt-4 flex flex-col gap-1.5">
                  {tiers.map((tier) => (
                    <li
                      key={tier.id}
                      className="flex items-center gap-2 text-sm text-white/65"
                    >
                      <FaCheck className="shrink-0 text-[10px] text-brand-blue-light" />
                      {tier.name}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex-grow" />

                <p className="text-xs uppercase tracking-wide text-white/35">
                  From
                </p>
                <p className="text-2xl font-bold tabular-nums text-brand-gold">
                  {formatNaira(from)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Link
            href="/tickets"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold px-8 py-3.5 font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
          >
            See all passes
            <FaArrowRight className="text-xs" />
          </Link>
          <p className="mt-3 text-xs text-white/40">
            Non-refundable · transferable until {TRANSFER_DEADLINE.displayShort}
          </p>
        </div>
      </div>
    </section>
  );
}
