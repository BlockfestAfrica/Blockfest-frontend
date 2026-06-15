"use client";
import type { EmblaOptionsType } from "embla-carousel";
import Speakers from "../carousel";
import { SpeakersList } from "@/lib/speakers";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { toast } from "sonner";
import "./subtle-animations.css";

export function SpeakersSection() {
  const OPTIONS: EmblaOptionsType = { loop: true };

  useSubtleAnimations();

  return (
    <section className="flex flex-col items-center justify-center py-12 lg:py-16 px-4 lg:px-8 bg-gradient-to-b from-brand-blue-deep to-black relative overflow-hidden">
      <div className="relative z-10 text-center mb-8 w-full max-w-4xl px-2">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-4 border border-white/10">
          <span className="text-white font-semibold text-sm">
            OUR SPEAKERS
          </span>
        </div>
        <h2 className="font-bold text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-white fade-in-on-scroll">
          They&apos;ve Graced Our Stage
        </h2>
        <p className="text-white/70 text-base lg:text-lg mt-4 max-w-2xl mx-auto">
          World-class thought leaders, founders, and policymakers who have shaped
          the conversation at Blockfest Africa
        </p>
      </div>

      {/* Speaker carousel */}
      <div className="relative z-10 scale-in">
        <Speakers speakers={SpeakersList} options={OPTIONS} />
      </div>

      {/* 2026 Speaker CTA */}
      <div className="relative z-10 mt-10 text-center">
        <p className="text-white/80 text-lg mb-4">
          Want to speak at Blockf3st Africa 2026?
        </p>
        <button
          type="button"
          onClick={() => toast("Coming soon!")}

          className="inline-flex items-center gap-2 bg-brand-gold text-black px-6 py-3 rounded-full font-semibold hover:bg-brand-gold-hover transition-colors cursor-pointer"
        >
          Apply to Speak
        </button>
      </div>
    </section>
  );
}
