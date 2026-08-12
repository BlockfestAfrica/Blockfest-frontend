"use client";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { EmblaOptionsType, EmblaCarouselType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
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
  autoplayDelay?: number;
};

const Speakers: React.FC<PropType> = (props) => {
  const {
    speakers,
    options,
    className = "",
    showDots = true,
    autoplayDelay = 4000,
  } = props;

  const [emblaRef, emblaApi] = useEmblaCarousel(options, [
    Autoplay({ delay: autoplayDelay, stopOnInteraction: false }),
  ]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const onNavButtonClick = useCallback((emblaApi: EmblaCarouselType) => {
    const autoplay = emblaApi?.plugins()?.autoplay;
    if (!autoplay) return;

    const resetOrStop =
      autoplay.options.stopOnInteraction === false
        ? autoplay.reset
        : autoplay.stop;

    resetOrStop();
  }, []);

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi, onNavButtonClick);

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

  useEffect(() => {
    if (!emblaApi) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        emblaApi.scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        emblaApi.scrollNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [emblaApi]);

  return (
    <section
      className={`embla w-full flex items-center justify-center flex-col relative ${className}`}
      // biome-ignore lint/a11y/noRedundantRoles: <explanation>
      // biome-ignore lint/a11y/useSemanticElements: <explanation>
      role="region"
      aria-label="Speaker carousel"
      aria-live="polite"
    >
      {/* Navigation Buttons - Positioned absolutely */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="absolute left-0 xl:left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors duration-300 hover:bg-white/20 disabled:opacity-50"
          />
        </div>
        <div className="absolute right-0 xl:right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors duration-300 hover:bg-white/20 disabled:opacity-50"
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
              className="md:flex-[0_0_75%] flex-[0_0_50%] lg:flex-[0_0_90%] xl:flex-[0_0_100%] min-w-0 flex items-stretch justify-center px-2 md:px-8"
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
                <div className="mx-auto flex h-full w-full max-w-4xl flex-col justify-center rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10 md:p-8">
                  <div className="flex items-center justify-center md:justify-between gap-6 flex-col-reverse md:flex-row text-center md:text-left">
                    <div className="flex min-w-0 flex-1 basis-full flex-col items-center text-white md:basis-[60%] md:items-start">
                      <h2 className="text-2xl md:text-3xl xl:text-5xl font-bold uppercase tracking-tight leading-tight">
                        {speaker.name}
                      </h2>
                      <p className="mt-3 text-sm md:text-lg xl:text-2xl leading-relaxed text-white/60 md:mt-4">
                        {speaker.title}
                      </p>
                    </div>
                    <div className="md:basis-[40%] basis-auto w-[250px] h-[250px]  md:w-[250px] md:h-[250px] lg:w-[300px] lg:h-[300px]  xl:w-[350px] xl:h-[350px] aspect-square rounded-xl overflow-hidden border border-white/20 flex-shrink-0 mx-auto md:mx-0">
                      <Image
                        src={speaker.image}
                        alt={`Portrait of ${speaker.name}, ${speaker.title}`}
                        width={640}
                        height={640}
                        sizes="(max-width: 640px) 250px, (max-width: 768px) 250px, (max-width: 1024px) 300px, (max-width: 1280px) 320px, 320px"
                        className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                        style={{ objectPosition: "center 15%" }}
                        aria-describedby={`speaker-${index}-name speaker-${index}-title`}
                        // Only the first slide is above the fold; the rest wait.
                        priority={index === 0}
                        loading={index === 0 ? "eager" : "lazy"}
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
        <div
          className="hidden md:flex justify-center gap-2 mt-5"
          role="tablist"
          aria-label="Speaker slides"
        >
          {scrollSnaps.map((_, index) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              key={index}
              // The dot stays 12px; the hit area around it is a full 44px.
              className="flex min-h-11 w-6 shrink-0 items-center justify-center"
              onClick={() => scrollTo(index)}
              role="tab"
              aria-selected={index === selectedIndex}
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

      {/* Mobile Navigation Buttons - Below the card */}
      <div className="block lg:hidden w-full mt-4">
        <div className="flex justify-center gap-4">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors duration-300 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors duration-300 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
    </section>
  );
};

export default Speakers;