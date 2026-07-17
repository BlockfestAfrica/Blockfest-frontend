import type { ComponentType } from "react";
import {
  LuBrainCircuit,
  LuLandmark,
  LuTrendingUp,
  LuServer,
  LuPalette,
  LuRocket,
} from "react-icons/lu";
import { lagos2026Tracks, lagos2026Festival } from "@/lib/events";

// Icons paired to lagos2026Tracks by order (kept here so the data stays plain).
const trackIcons: ComponentType<{ className?: string }>[] = [
  LuBrainCircuit,
  LuLandmark,
  LuTrendingUp,
  LuServer,
  LuPalette,
  LuRocket,
];

export function Lagos2026Section() {
  return (
    <section
      id="lagos-2026"
      className="relative py-12 lg:py-16 bg-gradient-to-b from-brand-navy-deep via-brand-navy to-black overflow-hidden"
    >
      {/* subtle dot grid, matching the hero */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 lg:px-8">
        {/* Theme banner */}
        <div className="text-center mb-8 lg:mb-10">
          <div className="inline-flex items-center gap-2 bg-brand-gold/15 rounded-full px-4 py-2 mb-4 border border-brand-gold/30">
            <span className="text-brand-gold font-semibold text-sm tracking-wide">
              LAGOS · OCTOBER 22–23, 2026
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3">
            New Trade Routes:{" "}
            <span className="text-brand-blue-light">Bringing Africa Onchain</span>
          </h2>
          <p className="text-white/60 text-base max-w-2xl mx-auto">
            Six tracks shaping the future of African tech, Web3 and AI.
          </p>
        </div>

        {/* Tracks — compact cards, icon inline with title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-10 lg:mb-14">
          {lagos2026Tracks.map((track, i) => {
            const Icon = trackIcons[i];
            return (
              <div
                key={track.title}
                className="bg-white/[0.04] rounded-xl p-4 lg:p-5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/15 text-brand-blue-light">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base lg:text-lg font-bold text-white">
                    {track.title}
                  </h3>
                </div>
                <p className="text-white/55 text-sm leading-relaxed">
                  {track.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Festival timeline — condensed */}
        <div className="text-center mb-6 lg:mb-8">
          <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            A Festival, Not Just an Event
          </h3>
          {/* <p className="text-white/60 text-base max-w-2xl mx-auto">
            Three weeks of programming. One unforgettable week in Lagos.
          </p> */}
          <p className="text-white/60 text-base max-w-2xl mx-auto">
            One unforgettable weekend in Lagos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 place-items-center">
          {lagos2026Festival.map((phase) => (
            <div
              key={phase.title}
              className="flex items-start gap-3 bg-white/[0.04] rounded-xl p-4 border border-white/10"
            >
              <div className="shrink-0 text-center">
                <span className="block text-brand-gold font-semibold text-xs whitespace-nowrap">
                  {phase.dates}
                </span>
                <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-white/40">
                  {phase.location}
                </span>
              </div>
              <div className="border-l border-white/10 pl-3">
                <h4 className="text-white font-semibold text-sm leading-snug">
                  {phase.title}
                </h4>
                <p className="text-white/50 text-xs leading-relaxed mt-0.5">
                  {phase.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
