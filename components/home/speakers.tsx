"use client";
import type { EmblaOptionsType } from "embla-carousel";
import Link from "next/link";
import Speakers from "../carousel";
import { Button } from "../ui/button";
import { SpeakersList, is2026Speaker, isPastSpeaker } from "@/lib/speakers";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

const HOMEPAGE_SPEAKER_COUNT = 12;

export function SpeakersSection() {
  const OPTIONS: EmblaOptionsType = { loop: true };

  const speakers2026 = SpeakersList.filter(is2026Speaker);
  const hasAnnouncedSpeakers = speakers2026.length > 0;

  // Before any 2026 names are announced, the carousel falls back to past
  // speakers so the section isn't empty — same as it's always worked. The
  // moment the first speaker gets `cohort: "2026"` in the data file, this
  // switches over on its own.
  const carouselSpeakers = hasAnnouncedSpeakers
    ? speakers2026
    : SpeakersList.filter(isPastSpeaker).slice(0, HOMEPAGE_SPEAKER_COUNT);

  useSubtleAnimations();

  return (
    <section className="section-y bg-ground border-t border-line-2">
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-ink-3">
            {hasAnnouncedSpeakers ? "2026 SPEAKERS" : "OUR SPEAKERS"}
          </p>
          <h2 className="text-display-sm mt-3 font-bold text-white fade-in-on-scroll">
            {hasAnnouncedSpeakers
              ? "Meet the 2026 Lineup"
              : "They've Graced Our Stage"}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-3">
            {hasAnnouncedSpeakers
              ? "The founders, builders and voices taking the Blockfest Africa stage this October"
              : "Founders, policymakers and thought leaders who have shaped the conversation at Blockfest Africa"}
          </p>
        </div>

        <div className="scale-in">
          <Speakers speakers={carouselSpeakers} options={OPTIONS} />
        </div>
        <div className="mt-10 overflow-hidden rounded-xl border border-line-2 bg-card-2">
          <div className="divide-y divide-line-2">
            {/* Past speakers — only makes sense once there's a "before" to point
      back to, i.e. once 2026 names exist. Its own row, not its own card. */}
            {hasAnnouncedSpeakers && (
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-white">
                    Curious who&apos;s spoken before?
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-3">
                    Browse every speaker across previous editions of Blockfest Africa.
                  </p>
                </div>
                <div className="w-full md:w-55">
                  <Button
                    asChild
                    variant="gold"
                    className="w-full rounded-full px-4 text-base font-semibold"
                  >
                    <Link href="/past-speakers">See Past Speakers</Link>
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
              <p className="text-lg text-ink">
                Want to speak at Blockfest Africa 2026?
              </p>
              <div className="w-full md:w-55">
                <Button
                  asChild
                  variant="gold"
                  className="w-full rounded-full px-4 text-base font-semibold"
                >
                  <Link href="/call-for-speakers">Apply to Speak</Link>
                </Button>
                {/* volunteering has ended */}
                {/* <Button
        asChild
        variant="outline"
        className="w-full rounded-full px-4 text-base font-semibold"
      >
        <Link href="/volunteer">Apply to Volunteer</Link>
      </Button> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}