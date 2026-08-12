"use client";
import { useState, useEffect } from "react";
import { IoCalendarClearOutline } from "react-icons/io5";
import { FaArrowRight } from "react-icons/fa";
import { Button } from "../ui/button";
import Link from "next/link";
import { useUmami } from "@/lib/hooks/use-umami";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import {
  blockfest2026SouthAfrica,
  blockfest2026Lagos,
  type BlockfestEvent,
} from "@/lib/events";
import { calculateTimeLeft, type TimeLeft } from "@/lib/countdown";
import { EARLY_BIRD_ENDS } from "@/lib/tickets";
import "./subtle-animations.css";

const flagFor = (countryCode: string) =>
  countryCode === "ZA" ? "🇿🇦" : "🇳🇬";

/** Upcoming event card with a live countdown and a tickets CTA. */
function UpcomingEventCard({
  event,
  onTicketsClick,
}: {
  event: BlockfestEvent;
  onTicketsClick: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calculateTimeLeft(event.date.start)
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(event.date.start));
    }, 1000);
    return () => clearInterval(timer);
  }, [event.date.start]);

  const units = [
    { val: timeLeft.days, label: "d" },
    { val: timeLeft.hours, label: "h" },
    { val: timeLeft.minutes, label: "m" },
    { val: timeLeft.seconds, label: "s" },
  ];

  return (
    <div className="relative rounded-2xl lg:rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-brand-blue via-brand-blue to-brand-blue-dark border-2 border-white/20">
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand-gold text-black text-xs font-bold px-4 py-1 rounded-full">
        NEXT EVENT
      </div>

      <div className="text-center">
        <div className="text-4xl mb-3">{flagFor(event.location.countryCode)}</div>
        <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">
          {event.location.city}
        </h3>
        <p className="text-white/70 text-sm mb-4">{event.location.country}</p>

        <div className="flex items-center justify-center gap-2 text-white/80 font-semibold mb-4">
          <IoCalendarClearOutline className="text-lg" />
          <span>{event.date.displayDate}</span>
        </div>

        {/* Compact Countdown */}
        <div className="flex justify-center gap-3 mb-6">
          {units.map((unit) => (
            <div key={unit.label} className="text-center">
              <span className="text-lg lg:text-xl font-bold text-white tabular-nums">
                {mounted ? String(unit.val).padStart(2, "0") : "--"}
              </span>
              <span className="text-[10px] text-white/50 ml-0.5">
                {unit.label}
              </span>
            </div>
          ))}
        </div>

        <Link href="/tickets" className="block" onClick={onTicketsClick}>
          <Button className="w-full font-semibold text-sm lg:text-base rounded-full py-5 bg-brand-gold text-black hover:bg-brand-gold-hover">
            Get Tickets
          </Button>
        </Link>

        <p className="mt-3 text-xs text-white/50">
          Early bird ends {EARLY_BIRD_ENDS.display}
        </p>
      </div>
    </div>
  );
}

/** Completed event card — celebrates the edition and links to its recap. */
function RecapEventCard({ event }: { event: BlockfestEvent }) {
  return (
    <div className="relative rounded-2xl lg:rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-white/10 via-brand-blue/20 to-brand-navy-deep border border-white/20">
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white/90 text-black text-xs font-bold px-4 py-1 rounded-full">
        THAT&apos;S A WRAP
      </div>

      <div className="text-center">
        <div className="text-4xl mb-3">{flagFor(event.location.countryCode)}</div>
        <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">
          {event.location.city}
        </h3>
        <p className="text-white/70 text-sm mb-4">{event.location.country}</p>

        <div className="flex items-center justify-center gap-2 text-white/80 font-semibold mb-4">
          <IoCalendarClearOutline className="text-lg" />
          <span>{event.date.displayDate}</span>
        </div>

        <p className="text-white/60 text-sm mb-6 min-h-[2.5rem]">
          A wrap on the South Africa roadshow. Relive the moments.
        </p>

        <Link href={event.recapUrl ?? "/"} className="block">
          <Button className="w-full font-semibold text-sm lg:text-base rounded-full py-5 bg-white/20 text-white hover:bg-white/30">
            <span className="inline-flex items-center gap-2">
              View Recap <FaArrowRight className="text-xs" />
            </span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function HeroSection2026() {
  const { trackButtonClick, trackRegistration } = useUmami();

  useSubtleAnimations();

  const handleLagosTickets = () => {
    trackButtonClick("Get Tickets", "Hero Section - Lagos");
    trackRegistration("hero-cta-lagos");
  };

  return (
    <section className="relative w-full flex items-center justify-center bg-gradient-to-b from-[#000000] via-brand-navy to-brand-navy-deep py-12 lg:py-16 overflow-hidden">
      {/* Grid pattern overlay - subtle dots */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
        {/* Main Content */}
        <div className="text-center mb-8 lg:mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-brand-gold/15 rounded-full px-5 py-2.5 mb-6 border border-brand-gold/30 fade-in-on-scroll">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-gold opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-gold" />
            </span>
            <span className="text-brand-gold font-semibold text-sm lg:text-base">
              TICKETS ARE LIVE
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 scale-in">
            Blockf<span className="text-brand-blue">3</span>st Africa{" "}
            <span className="text-brand-gold">&apos;26</span>
          </h1>

          {/* Tagline */}
          <p className="text-lg sm:text-xl lg:text-2xl text-white/90 font-medium mb-4 lg:mb-6 fade-in-on-scroll">
            New Trade Routes:{" "}
            <span className="text-white">Bringing Africa Onchain</span>
          </p>

          {/* Description */}
          <p className="text-white/60 text-sm sm:text-base lg:text-lg max-w-3xl mx-auto mb-6 lg:mb-8 fade-in-on-scroll">
            Three days of building, networking and dealmaking with{" "}
            <span className="text-white font-semibold">5,000+</span> founders,
            engineers, investors and policymakers. Fresh off the{" "}
            <span className="text-brand-blue-light">South Africa</span> roadshow,
            the main event lands in{" "}
            <span className="text-brand-blue-light">Lagos this October</span>.
          </p>
        </div>

        {/* Event Cards — Lagos (next) + South Africa (recap) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 max-w-4xl mx-auto slide-in-right">
          <UpcomingEventCard
            event={blockfest2026Lagos}
            onTicketsClick={handleLagosTickets}
          />
          <RecapEventCard event={blockfest2026SouthAfrica} />
        </div>

        {/* Recap Links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mt-8">
          <Link
            href="/blockfest-south-africa-2026"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm lg:text-base"
          >
            <span>🇿🇦 South Africa &apos;26 recap →</span>
          </Link>
          <Link
            href="/blockfest-2025"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm lg:text-base"
          >
            <span>🇳🇬 Lagos 2025 recap →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
