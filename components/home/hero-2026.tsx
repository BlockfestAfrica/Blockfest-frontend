"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, CalendarPlus, MapPin } from "lucide-react";
import { Button } from "../ui/button";
import { trackButtonClick } from "@/lib/sabilytics";
import { blockfest2026Lagos } from "@/lib/events";
import { calculateTimeLeft, type TimeLeft } from "@/lib/countdown";
import { EARLY_BIRD_ENDS } from "@/lib/tickets";
import { ICS_PATH } from "@/lib/calendar";

/** Days remaining until early bird closes, rendered as a line of type. */
function EarlyBirdLine() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calculateTimeLeft(EARLY_BIRD_ENDS.iso)
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(
      () => setTimeLeft(calculateTimeLeft(EARLY_BIRD_ENDS.iso)),
      60_000
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="text-sm text-white/60">
      <span className="font-semibold tabular-nums text-brand-gold">
        {mounted ? timeLeft.days : "--"} days
      </span>{" "}
      left on early bird pricing
    </p>
  );
}

export function HeroSection2026() {

  return (
    <section className="relative isolate overflow-hidden bg-ground">
      {/* The room, on the night. Everything else sits on top of it. */}
      <Image
        src="/images/home/img4.jpg"
        alt=""
        fill
        priority
        // priority alone did not put fetchpriority on the preload, so the LCP
        // image queued behind everything else the browser found first.
        fetchPriority="high"
        // The photograph sits under a heavy scrim, so detail that costs bytes
        // is never seen. 60 keeps it clean and drops ~45KB at phone widths.
        quality={60}
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Scrim: keeps the type legible without flattening the photograph. */}
      <div
        className="absolute inset-0 bg-ground/80 md:bg-gradient-to-r md:from-ground/95 md:via-ground/60 md:to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-16 sm:pb-20 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="max-w-3xl">
          {/* Where and when, before anything else */}
          <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1 text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {blockfest2026Lagos.location.venue}
            </span>
            <span className="hidden text-white/20 sm:inline" aria-hidden="true">
              /
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {blockfest2026Lagos.date.displayDate}
            </span>
          </p>

          <h1 className="text-display mt-5 font-bold uppercase text-white">
            Blockf<span className="text-brand-blue-light">3</span>st
            <br />
            Africa <span className="text-brand-gold">&rsquo;26</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-2xl">
            New Trade Routes: Bringing Africa Onchain
          </p>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60">
            Three days of building, networking and dealmaking with 5,000+
            founders, engineers, investors and policymakers.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              asChild
              variant="gold"
              className="rounded-full px-7 text-base font-semibold"
            >
              <Link href="/tickets">
                Get Tickets
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              className="rounded-full border border-white/20 bg-white/10 px-7 text-base font-semibold text-white hover:bg-white/20"
            >
              <Link href="#lagos-2026">See the programme</Link>
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <EarlyBirdLine />
            <a
              href={ICS_PATH}
              onClick={() => trackButtonClick("Add to calendar", "Hero")}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white/60 hover:text-white"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Add to calendar
            </a>
          </div>
        </div>
      </div>

      {/* Cape Town is history now, so it gets a line rather than equal billing. */}
      <div className="relative border-t border-white/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 lg:px-8">
          <p className="text-sm text-white/60">
            The South Africa roadshow is a wrap.
          </p>
          <div className="flex flex-wrap items-center gap-x-6">
            <Link
              href="/blockfest-south-africa-2026"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white"
            >
              Cape Town &rsquo;26 recap
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              href="/blockfest-2025"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white"
            >
              Lagos 2025 recap
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
