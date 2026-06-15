"use client";
import Link from "next/link";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { FaArrowRight } from "react-icons/fa";
import "./subtle-animations.css";

const displayStats = [
  { value: "15K+", label: "Registrations", subtext: "2025" },
  { value: "12K+", label: "Attendees", subtext: "2025" },
  { value: "20+", label: "Speakers", subtext: "Industry Leaders" },
  { value: "54+", label: "Countries", subtext: "Represented" },
];

export function Stats2026Section() {
  useSubtleAnimations();

  return (
    <section className="relative bg-gradient-to-r from-brand-blue via-brand-blue-dark to-brand-blue-deep py-12 lg:py-16 overflow-hidden">
      <div className="relative z-10 max-w-6xl mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6 lg:mb-10">
          <p className="text-white/40 text-xs sm:text-sm uppercase tracking-[0.2em] mb-2 fade-in-on-scroll">
            2025 was massive
          </p>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white fade-in-on-scroll">
            Building on Our Success
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-5 mb-6">
          {displayStats.map((stat, index) => (
            <div
              key={stat.label}
              className={`bg-white/10 rounded-lg lg:rounded-xl p-3 sm:p-4 lg:p-5 text-center border border-white/10 hover:bg-white/[0.12] transition-all duration-300 stagger-animation stagger-${
                index + 1
              }`}
            >
              <p className="font-bold text-xl sm:text-2xl lg:text-3xl xl:text-4xl text-white mb-0.5">
                {stat.value}
              </p>
              <p className="font-medium text-xs sm:text-sm lg:text-base text-white/90">
                {stat.label}
              </p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-white/50">
                {stat.subtext}
              </p>
            </div>
          ))}
        </div>

        {/* Social Proof Row */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6 text-white/70 text-xs sm:text-sm lg:text-base mb-4 lg:mb-6">
          <div className="flex items-center gap-2">
            <span className="text-[#1DA1F2]">𝕏</span>
            <span>2.2M+ Impressions</span>
          </div>
          <div className="flex items-center gap-2">
            <span>7.2K Livestream Viewers</span>
          </div>
          <div className="flex items-center gap-2">
            <span>5+ Countries</span>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/blockfest-2025"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors font-semibold underline underline-offset-4"
          >
            <span>See Full 2025 Recap</span>
            <FaArrowRight className="text-sm" />
          </Link>
        </div>
      </div>
    </section>
  );
}
