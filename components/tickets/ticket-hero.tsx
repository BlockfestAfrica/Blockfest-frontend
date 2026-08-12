"use client";

import { useEffect, useState } from "react";
import { IoCalendarClearOutline, IoLocationOutline } from "react-icons/io5";
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
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      {units(timeLeft).map((unit) => (
        <div key={unit.label} className="text-center">
          <span className="block text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {mounted ? String(unit.value).padStart(2, "0") : "--"}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-white/60">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TicketHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-black to-ground py-14 lg:py-20">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-gold/15 border border-brand-gold/30 rounded-full px-5 py-2 mb-6">
          <span className="text-brand-gold font-semibold text-xs sm:text-sm tracking-wide uppercase">
            Early bird ends {EARLY_BIRD_ENDS.display}
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
          Secure Your Seat
        </h1>

        <p className="text-white/60 text-base sm:text-lg max-w-2xl mx-auto mb-8">
          Africa&apos;s leading convention across AI, Web3, venture capital,
          technology, culture and careers.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-white/60 text-sm mb-10">
          <span className="inline-flex items-center gap-2">
            <IoCalendarClearOutline className="text-base text-white/60" aria-hidden="true" />
            {blockfest2026Lagos.date.displayDate}
          </span>
          <span className="hidden sm:inline text-white/60">·</span>
          <span className="inline-flex items-center gap-2">
            <IoLocationOutline className="text-base text-white/60" aria-hidden="true" />
            {blockfest2026Lagos.location.venue}
          </span>
          <span className="hidden sm:inline text-white/60">·</span>
          <span>Three days</span>
        </div>

        <div className="inline-flex flex-col items-center gap-5 rounded-xl border border-white/20 bg-white/5 px-8 py-7">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">
            Early bird closes in
          </p>
          <EarlyBirdCountdown />
          <TicketCTA source="Tickets Hero" className="w-full sm:w-auto px-8">
            Get your ticket
          </TicketCTA>
          <p className="text-white/60 text-xs">
            Passes from {formatNaira(lowestTicketPrice)}
          </p>
        </div>
      </div>
    </section>
  );
}
