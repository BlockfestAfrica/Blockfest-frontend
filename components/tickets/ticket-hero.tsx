"use client";

import { useEffect, useState } from "react";
import { Calendar, MapPin } from "lucide-react";
import { calculateTimeLeft, type TimeLeft } from "@/lib/countdown";
import { blockfest2026Lagos } from "@/lib/events";
import {
  EARLY_BIRD_ENDS,
  formatNaira,
  lowestTicketPrice,
} from "@/lib/tickets";
import { TicketCTA } from "./ticket-cta";

const units = (timeLeft: TimeLeft) => [
  { value: timeLeft.days, label: "days" },
  { value: timeLeft.hours, label: "hrs" },
  { value: timeLeft.minutes, label: "min" },
  { value: timeLeft.seconds, label: "sec" },
];

/** Early bird countdown — renders dashes until mounted to keep SSR stable. */
function EarlyBirdCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calculateTimeLeft(EARLY_BIRD_ENDS.iso)
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(EARLY_BIRD_ENDS.iso));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-end gap-5 sm:gap-7">
      {units(timeLeft).map((unit) => (
        <div key={unit.label}>
          <span className="block text-2xl font-bold tabular-nums text-white sm:text-3xl">
            {mounted ? String(unit.value).padStart(2, "0") : "--"}
          </span>
          <span className="eyebrow mt-1 block text-white/60">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TicketHero() {
  return (
    <section className="section-y bg-ground">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          {/* Where and when, before anything else */}
          <div className="max-w-2xl lg:col-span-7">
            <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1 text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {blockfest2026Lagos.date.displayDate}
              </span>
              <span className="hidden text-white/20 sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {blockfest2026Lagos.location.venue}
              </span>
              <span className="hidden text-white/20 sm:inline" aria-hidden="true">
                ·
              </span>
              <span>Three days</span>
            </p>

            <h1 className="text-display mt-5 font-bold uppercase text-white">
              Secure Your Seat
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
              Africa&apos;s leading convention across AI, Web3, venture capital,
              technology, culture and careers.
            </p>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2">
              <span className="eyebrow text-white/90">
                Early bird ends {EARLY_BIRD_ENDS.display}
              </span>
            </div>
          </div>

          {/*
            The clock and the action, kept as one platform-grade panel.

            Panel, not a card: it wraps the primary CTA rather than being
            clickable itself, so it deliberately omits the card recipe's
            `transition-colors duration-300 hover:bg-white/10` tail — a
            container that lights up on hover but does nothing is a phantom
            affordance. Same treatment as the CTA panels in home/sponsorship,
            home/partners and home/faq. The hover tail belongs to repeating
            grid cards (ticket-about, ticket-policy, ideal-audience).
          */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-white/20 bg-white/5 p-6">
              <p className="eyebrow text-white/60">Early bird closes in</p>

              <div className="mt-4">
                <EarlyBirdCountdown />
              </div>

              <TicketCTA
                source="Tickets Hero"
                className="mt-6 w-full sm:w-auto px-8"
              >
                Get your ticket
              </TicketCTA>

              <p className="mt-4 text-xs text-white/60">
                Passes from{" "}
                <span className="font-semibold text-brand-gold">
                  {formatNaira(lowestTicketPrice)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
