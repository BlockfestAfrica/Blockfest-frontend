"use client";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmblaOptionsType, EmblaCarouselType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import Link from "next/link";
import { NextButton, PrevButton, usePrevNextButtons } from "./carouselbuttons";

type Speaker = {
  name: string;
  title: string;
  image: string;
};

type PropType = {
  speakers: Speaker[];
  options?: EmblaOptionsType;
  className?: string;
  showDots?: boolean;
};

// Below this many slides, Embla's loop mode doesn't have enough real slides
// to generate convincing clones — the wraparound math breaks and it can get
// stuck showing one slide regardless of Next/Prev. A bounded (non-looping)
// carousel below this threshold is the correct, working behavior anyway:
// with 2 items there's nothing meaningful to "loop" through.
const MIN_SLIDES_TO_LOOP = 4;

const Speakers: React.FC<PropType> = (props) => {
  const {
    speakers,
    options,
    className = "",
    showDots = true,
  } = props;

  const rootRef = useRef<HTMLElement>(null);

  const canLoop = speakers.length >= MIN_SLIDES_TO_LOOP;
  const emblaOptions = useMemo<EmblaOptionsType>(
    () => ({ ...options, loop: canLoop ? (options?.loop ?? false) : false }),
    [options, canLoop]
  );

  /*
   * Moves only when someone moves it: arrows, dots, swipe or the arrow keys.
   *
   * It used to advance itself every four seconds, which obliged a Pause button
   * under it (auto-moving content needs a way to stop it, WCAG 2.2.2). The
   * button sat alone below the dots and read as clutter, and a slideshow that
   * turns while someone is reading a name is the thing being paused anyway.
   * With no autoplay there is nothing to pause, so neither is needed.
   */
  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi);

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi]
  );

  const onInit = useCallback((emblaApi: EmblaCarouselType) => {
    setScrollSnaps(emblaApi.scrollSnapList());
  }, []);

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    onInit(emblaApi);
    onSelect(emblaApi);
    emblaApi.on("reInit", onInit).on("reInit", onSelect).on("select", onSelect);
  }, [emblaApi, onInit, onSelect]);

  /**
   * Arrow keys move the carousel only while focus is inside it.
   *
   * This was bound to `document` and called preventDefault unconditionally, so
   * pressing Left or Right anywhere on the page scrolled the carousel and ate
   * the keystroke — including caret movement inside form fields.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!emblaApi || !root) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        emblaApi.scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        emblaApi.scrollNext();
      }
    };

    root.addEventListener("keydown", handleKeyDown);
    return () => root.removeEventListener("keydown", handleKeyDown);
  }, [emblaApi]);

  return (
    <section
      ref={rootRef}
      className={`embla w-full flex items-center justify-center flex-col relative ${className}`}
      // biome-ignore lint/a11y/noRedundantRoles: <explanation>
      // biome-ignore lint/a11y/useSemanticElements: <explanation>
      role="region"
      aria-label="Speaker carousel"
      aria-roledescription="carousel"
    >
      {/* Navigation Buttons - Positioned absolutely */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="absolute left-0 xl:left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-line-2 bg-card-3 text-white transition-colors duration-300 hover:bg-white/20 disabled:opacity-50"
          />
        </div>
        <div className="absolute right-0 xl:right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-line-2 bg-card-3 text-white transition-colors duration-300 hover:bg-white/20 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Carousel Container */}
      <div
        className="w-full overflow-hidden px-4 md:px-6"
        ref={emblaRef}
        // biome-ignore lint/a11y/useSemanticElements: <explanation>
        role="group"
        aria-label="Speaker slides"
      >
        <div className="flex touch-pan-y touch-pinch-zoom">
          {speakers.map((speaker, index) => (
            <div
              // Phones get one card, near full width. At 50% the card content
              // box was 91px and everything inside it overflowed.
              className="flex-[0_0_90%] md:flex-[0_0_100%] min-w-0 flex items-stretch justify-center px-1.5 md:px-8"
              key={`${speaker.name}-${index}`}
              // biome-ignore lint/a11y/useSemanticElements: <explanation>
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${speakers.length}`}
            >
              <Link
                href="/speakers"
                className="block group cursor-pointer w-full"
                aria-label={`View all speakers including ${speaker.name}`}
              >
                <div className="mx-auto flex h-full w-full max-w-4xl flex-col justify-center rounded-xl border border-line-2 bg-card-2 p-6 transition-colors duration-300 hover:bg-card-3 md:p-8">
                  <div className="flex items-center justify-center md:justify-between gap-6 flex-col-reverse md:flex-row text-center md:text-left">
                    {/* basis-0 + flex-1 so the text takes whatever the portrait
                        leaves. The old md:basis-[60%] against the portrait's
                        42% over-committed the row by 8% plus the gap. */}
                    <div className="flex w-full min-w-0 flex-1 basis-full flex-col items-center text-white md:w-auto md:basis-0 md:items-start">
                      {/* 3xl moved from md to lg: at 768px the widest names were
                          wider than their own column. */}
                      <h2 className="text-xl min-[360px]:text-2xl lg:text-3xl xl:text-5xl font-bold uppercase tracking-tight leading-tight wrap-break-word">
                        {speaker.name}
                      </h2>
                      <p className="mt-3 text-sm md:text-lg xl:text-2xl leading-relaxed text-ink-3 md:mt-4">
                        {speaker.title}
                      </p>
                    </div>
                    {/* Sized fluidly and capped, never pinned. The old fixed
                        250px frame was wider than the card that held it, so the
                        portrait spilled across its neighbours on phones. Height
                        comes from aspect-square, so the frame is always square:
                        the previous fixed w/h pairs fought basis-[40%] and left
                        it 147x238 at md and 315x333 at xl. */}
                    <div className="basis-auto w-full max-w-60 md:basis-[46%] md:w-auto md:max-w-75 xl:max-w-85 aspect-square shrink-0 overflow-hidden rounded-xl border border-line-2 mx-auto md:mx-0">
                      <Image
                        src={speaker.image}
                        alt={`Portrait of ${speaker.name}, ${speaker.title}`}
                        width={640}
                        height={640}
                        sizes="(max-width: 767px) 240px, (max-width: 1279px) 300px, 340px"
                        className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                        style={{ objectPosition: "center 15%" }}
                        // Nothing here is preloaded. This carousel sits four
                        // sections below the fold on the homepage, and marking
                        // the first slide priority put a second image preload
                        // in the head competing with the actual LCP element.
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Dot Indicators */}
      {showDots && scrollSnaps.length > 1 && (
        // Plain buttons in a group, not a tablist: there are no tabpanels here,
        // and the tab pattern promises a keyboard model this does not implement.
        <div
          className="hidden md:flex justify-center gap-2 mt-5"
          role="group"
          aria-label="Choose speaker slide"
        >
          {scrollSnaps.map((_, index) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              key={index}
              // The dot stays 12px; the hit area around it is a full 44px.
              className="flex min-h-11 w-6 shrink-0 items-center justify-center"
              onClick={() => scrollTo(index)}
              aria-current={index === selectedIndex}
              aria-label={`Go to slide ${index + 1}: ${speakers[index]?.name}`}
            >
              <span
                className={`block h-3 w-3 rounded-full transition-colors duration-300 ${index === selectedIndex
                  ? "bg-brand-blue-light"
                  : "bg-white/20 hover:bg-white/60"
                  }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Below-card controls, below lg only: wider screens have the arrows
          beside the card. Dots don't fit on a phone with 12 slides, so phones
          get a counter instead and are otherwise left with no sense of
          position at all. */}
      <div className="mt-4 flex w-full items-center justify-center lg:hidden">
        <div className="flex items-center gap-4">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-line-2 bg-card-3 text-white transition-colors duration-300 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {scrollSnaps.length > 1 && (
            <p className="text-sm tabular-nums text-ink-3 md:hidden">
              <span className="sr-only">Slide </span>
              {selectedIndex + 1} of {scrollSnaps.length}
            </p>
          )}
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-line-2 bg-card-3 text-white transition-colors duration-300 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
    </section>
  );
};

export default Speakers;