"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
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
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        {/* Header */}
        <div className="mb-10 max-w-2xl lg:mb-14">
          <p className="eyebrow fade-in-on-scroll text-white/60">
            2025 was massive
          </p>
          <h2 className="text-display-sm fade-in-on-scroll mt-3 font-bold text-white">
            Building on Our Success
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {displayStats.map((stat, index) => (
            <div
              key={stat.label}
              className={`rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10 stagger-animation stagger-${
                index + 1
              }`}
            >
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="mt-2 text-base font-medium text-white/90">
                {stat.label}
              </p>
              <p className="mt-1 text-sm text-white/60">{stat.subtext}</p>
            </div>
          ))}
        </div>

        {/* Social Proof Row */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/60">
          <div className="flex items-center gap-2">
            <FaXTwitter className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Twitter / X</span>
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
        <div className="mt-6">
          <Link
            href="/blockfest-2025"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/60 underline underline-offset-4 transition-colors hover:text-white"
          >
            <span>See Full 2025 Recap</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
