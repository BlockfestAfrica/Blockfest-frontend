import type { ComponentType } from "react";
import {
  BrainCircuit,
  Landmark,
  Palette,
  Rocket,
  Server,
  TrendingUp,
} from "lucide-react";
import { lagos2026Tracks, lagos2026Festival } from "@/lib/events";

// Icons paired to lagos2026Tracks by order (kept here so the data stays plain).
const trackIcons: ComponentType<{ className?: string }>[] = [
  BrainCircuit,
  Landmark,
  TrendingUp,
  Server,
  Palette,
  Rocket,
];

export function Lagos2026Section() {
  return (
    <section
      id="lagos-2026"
      className="section-y bg-ground border-t border-white/20"
    >
      <div className="container-page">
        {/* Theme banner */}
        <div className="mb-10 max-w-2xl lg:mb-14">
          <p className="eyebrow text-white/60">LAGOS · OCTOBER 22–24, 2026</p>
          <h2 className="text-display-sm mt-3 font-bold text-white">
            New Trade Routes:{" "}
            <span className="text-brand-blue-light">
              Bringing Africa Onchain
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Six tracks shaping the future of African tech, Web3 and AI.
          </p>
        </div>

        {/* Tracks — compact cards, icon inline with title */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lagos2026Tracks.map((track, i) => {
            const Icon = trackIcons[i];
            return (
              <div
                key={track.title}
                className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {track.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  {track.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Festival timeline — condensed */}
        <div className="mb-8 mt-14 max-w-2xl lg:mb-10 lg:mt-20">
          <h3 className="text-3xl font-bold text-white">
            A Festival, Not Just an Event
          </h3>
          {/* <p className="mt-4 text-base leading-relaxed text-white/60">
            Three weeks of programming. One unforgettable week in Lagos.
          </p> */}
          <p className="mt-4 text-base leading-relaxed text-white/60">
            One unforgettable weekend in Lagos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {lagos2026Festival.map((phase) => (
            <div
              key={phase.title}
              className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-white/90">
                  {phase.dates}
                </span>
                <span className="eyebrow text-white/60">{phase.location}</span>
              </div>
              <h4 className="mt-4 text-base font-bold leading-snug text-white">
                {phase.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {phase.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
