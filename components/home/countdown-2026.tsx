"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { blockfest2026Johannesburg, blockfest2026Lagos } from "@/lib/events";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetDate: string): TimeLeft {
  const difference = new Date(targetDate).getTime() - new Date().getTime();

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

interface CountdownTimerProps {
  targetDate: string;
  eventName: string;
  location: string;
  isPrimary?: boolean;
}

function CountdownTimer({
  targetDate,
  eventName,
  location,
  isPrimary = false,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calculateTimeLeft(targetDate)
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const isExpired =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="text-center">
      <div
        className={`${
          isPrimary
            ? "bg-white/20 border-white/30"
            : "bg-gray-800/80 border-gray-700"
        } border rounded-lg lg:rounded-xl px-2 py-2 sm:px-3 lg:px-4 lg:py-3 min-w-[50px] sm:min-w-[60px] lg:min-w-[80px]`}
      >
        <span className="text-xl sm:text-2xl lg:text-4xl font-bold text-white">
          {mounted ? String(value).padStart(2, "0") : "--"}
        </span>
      </div>
      <span className="text-[10px] sm:text-xs lg:text-sm text-white/70 mt-1 block">
        {label}
      </span>
    </div>
  );

  return (
    <div
      className={`rounded-2xl lg:rounded-3xl p-6 lg:p-8 ${
        isPrimary
          ? "bg-gradient-to-br from-brand-blue to-brand-blue-deep border-2 border-white/20"
          : "bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700"
      }`}
    >
      {isPrimary && (
        <div className="text-center mb-4">
          <span className="bg-brand-gold text-black text-xs font-bold px-3 py-1 rounded-full">
            NEXT EVENT
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl lg:text-2xl font-bold text-white mb-1">
          {eventName}
        </h3>
        <p className="text-white/70">{location}</p>
      </div>

      {isExpired ? (
        <div className="text-center py-4">
          <p className="text-2xl lg:text-3xl font-bold text-white">
            Event Day! 🎉
          </p>
          <p className="text-white/80 mt-2">Join us today!</p>
        </div>
      ) : (
        <div className="flex justify-center gap-2 lg:gap-4">
          <TimeUnit value={timeLeft.days} label="Days" />
          <TimeUnit value={timeLeft.hours} label="Hours" />
          <TimeUnit value={timeLeft.minutes} label="Mins" />
          <TimeUnit value={timeLeft.seconds} label="Secs" />
        </div>
      )}
    </div>
  );
}

export function Countdown2026Section() {
  useSubtleAnimations();

  const joburg = blockfest2026Johannesburg;
  const lagos = blockfest2026Lagos;

  return (
    <section className="py-16 lg:py-24 bg-black relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-blue/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-brand-blue-light/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-5 lg:px-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4 fade-in-on-scroll">
            Countdown to <span className="text-brand-blue-light">2026</span>
          </h2>
          <p className="text-white/60 text-base lg:text-lg max-w-2xl mx-auto">
            Two epic events. Two incredible cities. One movement reshaping
            Africa&apos;s web3 future.
          </p>
        </div>

        {/* Dual Countdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 scale-in">
          <CountdownTimer
            targetDate={joburg.date.start}
            eventName={joburg.date.displayDate}
            location={`${joburg.location.city}, ${joburg.location.country}`}
            isPrimary={true}
          />
          <CountdownTimer
            targetDate={lagos.date.start}
            eventName={lagos.date.displayDate}
            location={`${lagos.location.city}, ${lagos.location.country}`}
            isPrimary={false}
          />
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 mt-10">
          <Link
            href="#sponsorship"
            className="inline-flex items-center gap-2 bg-brand-gold text-black px-6 py-3 rounded-full font-semibold hover:bg-brand-gold-hover transition-colors"
          >
            Become a Sponsor
          </Link>
          <Link
            href="/blockfest-2025"
            className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-full font-semibold hover:bg-white/20 transition-colors border border-white/20"
          >
            View 2025 Highlights
          </Link>
        </div>
      </div>
    </section>
  );
}
