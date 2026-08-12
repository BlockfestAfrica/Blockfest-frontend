"use client";
import type { EmblaOptionsType } from "embla-carousel";
import Speakers from "../carousel";
import { Button } from "../ui/button";
import { SpeakersList } from "@/lib/speakers";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import { toast } from "sonner";
import "./subtle-animations.css";

/* The homepage carousel is a taster; /speakers has the full list. Rendering all
   33 was a third of the page's DOM and 33 portraits on first load. */
const HOMEPAGE_SPEAKER_COUNT = 12;

export function SpeakersSection() {
  const OPTIONS: EmblaOptionsType = { loop: true };
  const featured = SpeakersList.slice(0, HOMEPAGE_SPEAKER_COUNT);

  useSubtleAnimations();

  return (
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        {/* Header sits on the same left edge as the hero headline. */}
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-white/60">OUR SPEAKERS</p>
          <h2 className="text-display-sm mt-3 font-bold text-white fade-in-on-scroll">
            They&apos;ve Graced Our Stage
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            Founders, policymakers and thought leaders who have shaped the
            conversation at Blockfest Africa
          </p>
        </div>

        {/* Speaker carousel */}
        <div className="scale-in">
          <Speakers speakers={featured} options={OPTIONS} />
        </div>

        {/* 2026 Speaker CTA */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg text-white/90">
            Want to speak at Blockf3st Africa 2026?
          </p>
          <Button
            type="button"
            variant="gold"
            onClick={() => toast("Coming soon!")}
            className="cursor-pointer rounded-full px-7 text-base font-semibold"
          >
            Apply to Speak
          </Button>
        </div>
      </div>
    </section>
  );
}
