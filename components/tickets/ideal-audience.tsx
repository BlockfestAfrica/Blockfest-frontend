import {
  Briefcase,
  Code,
  GraduationCap,
  Landmark,
  Megaphone,
  Mic,
  Network,
  Palette,
  PenTool,
  Rocket,
  TrendingUp,
} from "lucide-react";
import { idealAudience } from "@/lib/tickets";

const audienceIcons = {
  rocket: Rocket,
  code: Code,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
  network: Network,
  palette: Palette,
  landmark: Landmark,
  megaphone: Megaphone,
  "pen-tool": PenTool,
  mic: Mic,
  "graduation-cap": GraduationCap,
} as const;

export function IdealAudience() {
  return (
    <section
      id="who-its-for"
      className="section-y bg-ground border-t border-white/20"
    >
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <h2 className="text-display-sm font-bold text-white">
            Who It&apos;s For
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            The people shaping what Africa ships next.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {idealAudience.map((audience) => {
            const Icon = audienceIcons[audience.icon];
            return (
              <div
                key={audience.title}
                className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10"
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-bold text-white lg:text-lg">
                  {audience.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {audience.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
