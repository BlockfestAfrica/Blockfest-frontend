"use client";
import type { EmblaOptionsType } from "embla-carousel";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Speakers from "../carousel";
import { Button } from "../ui/button";
import { SpeakersList, is2026Speaker, isPastSpeaker } from "@/lib/speakers";
import { isSpeakerFormOpen } from "@/lib/speaking";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

const HOMEPAGE_SPEAKER_COUNT = 12;

export function SpeakersSection() {
  const OPTIONS: EmblaOptionsType = { loop: true };

  const speakers2026 = SpeakersList.filter(is2026Speaker).sort(
    (a, b) =>
      Number(b.role === "special-guest") - Number(a.role === "special-guest")
  );
  const hasAnnouncedSpeakers = speakers2026.length > 0;

  const carouselSpeakers = hasAnnouncedSpeakers
    ? speakers2026
    : SpeakersList.filter(isPastSpeaker).slice(0, HOMEPAGE_SPEAKER_COUNT);

  useSubtleAnimations();

  return (
    <section className="section-y bg-ground border-t border-line-2">
      <div className="container-page">
        {/* baseline-last puts the link on the description's last line; items-end
            lined up the bottom of its 44px tap area instead, a line too high. */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-baseline-last sm:justify-between lg:mb-14">
          <div>
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
                ? "The founders, builders and voices taking the Blockfest Africa stage this October."
                : "Founders, policymakers and thought leaders who have shaped the conversation at Blockfest Africa."}
            </p>
          </div>
          {/* The whole lineup, named. Each card links to it too, but a card
              reads as "this speaker", and nothing said the page existed. */}
          <Link
            href={hasAnnouncedSpeakers ? "/speakers" : "/past-speakers"}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:text-white"
          >
            {hasAnnouncedSpeakers ? "See the full lineup" : "See every past speaker"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="scale-in">
          <Speakers speakers={carouselSpeakers} options={OPTIONS} />
        </div>
        {/* Two rows, one primary. Both buttons were gold, so the page asked
            for two things with equal weight; applying to speak is the ask,
            browsing the archive is the aside. The apply row follows the same
            switch as every other call-for-speakers link on the site. */}
        {(hasAnnouncedSpeakers || isSpeakerFormOpen) && (
          <div className="mt-10 overflow-hidden rounded-xl border border-line-2 bg-card-2">
            <div className="divide-y divide-line-2">
              {isSpeakerFormOpen && (
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-white">
                      Want to speak at Blockfest Africa 2026?
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-3">
                      Applications for the Lagos stage are open.
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="gold"
                    className="w-full rounded-full px-6 text-base font-semibold sm:w-auto sm:min-w-52"
                  >
                    <Link href="/call-for-speakers">Apply to Speak</Link>
                  </Button>
                </div>
              )}

              {/* Past speakers, only once there is a "before" to point back
                  to, i.e. once 2026 names exist. */}
              {hasAnnouncedSpeakers && (
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-white">
                      Curious who&apos;s spoken before?
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-3">
                      Browse every speaker from previous editions of Blockfest Africa.
                    </p>
                  </div>
                  <Link
                    href="/past-speakers"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-line-2 bg-card-3 px-6 text-base font-semibold text-white transition-colors hover:bg-white/20 sm:w-auto sm:min-w-52"
                  >
                    See Past Speakers
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}