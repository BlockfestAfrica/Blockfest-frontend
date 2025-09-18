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
            className="w-12 h-12 xl:w-16 xl:h-16 bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
          />
        </div>
        <div className="absolute right-0 xl:right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="w-12 h-12 xl:w-16 xl:h-16 bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
          />
        </div>
      </div>

      {/* Carousel Container */}
      <div
        className="overflow-hidden w-full max-w-6xl mx-auto px-4 md:px-6"
        ref={emblaRef}
        // biome-ignore lint/a11y/useSemanticElements: <explanation>
        role="group"
        aria-label="Speaker slides"
      >
        <div className="flex touch-pan-y touch-pinch-zoom">
          {speakers.map((speaker, index) => (
            <div
              className="flex-[0_0_100%] min-w-0 flex justify-center items-center px-2 md:px-4"
              key={`${speaker.name}-${index}`}
              // biome-ignore lint/a11y/useSemanticElements: <explanation>
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${speakers.length}`}
            >
              <Link
                href="/speakers"
                className="block group cursor-pointer"
                aria-label={`View all speakers including ${speaker.name}`}
              >
                <div className="bg-gradient-to-b from-[#0F377E] to-[#1B64E4] rounded-3xl p-6 md:p-8 w-full max-w-4xl mx-auto shadow-2xl border border-white/10 transition-all duration-300 hover:shadow-3xl hover:scale-[1.02] hover:border-white/20">
                  <div className="flex items-center justify-center md:justify-between gap-6 flex-col-reverse md:flex-row text-center md:text-left ">
                    {/* Text Content */}
                    <div className="text-white flex-1 md:basis-[60%] min-w-0 basis-full">
                      <h2 className="text-xl md:text-3xl lg:text-4xl xl:text-5xl font-medium mb-3 md:mb-5 uppercase tracking-tight leading-tight">
                        {speaker.name}
                      </h2>
                      <p className="text-[#E9EBF8] font-light text-sm md:text-lg lg:text-xl xl:text-2xl italic leading-relaxed">
                        {speaker.title}
                      </p>
                    </div>
                    {/* Speaker Image */}
                    <div className="md:basis-[40%] basis-full w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 xl:w-64 xl:h-64 aspect-square rounded-2xl overflow-hidden ring-4 ring-white/20 flex-shrink-0 mx-auto">
                      <Image
                        src={speaker.image}
                        alt={`Portrait of ${speaker.name}, ${speaker.title}`}
                        width={300}
                        height={300}
                        quality={90}
                        sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, (max-width: 1024px) 192px, (max-width: 1280px) 224px, 256px"
                        className="w-full h-full object-cover object-top transition-transform duration-300 hover:scale-105"
                        style={{ objectPosition: "center 15%" }}
                        aria-describedby={`speaker-${index}-name speaker-${index}-title`}
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
          className="flex justify-center gap-2 mt-5 mb-3"
          role="tablist"
          aria-label="Speaker slides"
        >
          {scrollSnaps.map((_, index) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${index === selectedIndex
                  ? "bg-blue-600 scale-125"
                  : "bg-gray-300 hover:bg-gray-400"
                }`}
              onClick={() => scrollTo(index)}
              role="tab"
              aria-selected={index === selectedIndex}
              aria-label={`Go to slide ${index + 1}: ${speakers[index]?.name}`}
            />
          ))}
        </div>
      )}

      {/* Mobile Navigation Buttons - Below the card */}
      <div className="block lg:hidden w-full mt-4 mb-2">
        <div className="flex justify-center gap-4">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="w-12 h-12 bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="w-12 h-12 bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </section>
  );
};

export default Speakers;
