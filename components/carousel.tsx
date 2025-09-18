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
      className={`embla w-full flex items-center justify-center flex-col relative px-0 lg:px-8 ${className}`}
      // biome-ignore lint/a11y/noRedundantRoles: <explanation>
      // biome-ignore lint/a11y/useSemanticElements: <explanation>
      role="region"
      aria-label="Speaker carousel"
      aria-live="polite"
    >
      {/* Navigation Buttons - Positioned absolutely */}
      <div className="hidden lg:block">
        <div className="absolute left-2 lg:left-6 top-1/2 -translate-y-1/2 z-10">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="w-16 h-16 bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200"
          />
        </div>
        <div className="absolute right-2 lg:right-6 top-1/2 -translate-y-1/2 z-10">
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="w-16 h-16 bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200"
          />
        </div>
      </div>

      {/* Carousel Container */}
      <div
        className="overflow-hidden max-w-5xl mx-auto"
        ref={emblaRef}
        // biome-ignore lint/a11y/useSemanticElements: <explanation>
        role="group"
        aria-label="Speaker slides"
      >
        <div className="flex touch-pan-y touch-pinch-zoom">
          {speakers.map((speaker, index) => (
            <div
              className="flex-[0_0_100%] min-w-0 flex justify-center items-center px-2 md:px-4 h-full"
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
                <div className="bg-gradient-to-b from-[#0F377E] to-[#1B64E4] rounded-3xl p-4 md:p-6 w-full xl:max-w-3xl mx-auto shadow-2xl border border-white/10 flex items-center transition-all duration-300 hover:shadow-3xl hover:scale-[1.02] hover:border-white/20">
                  <div className="flex items-center md:justify-between justify-center gap-6 flex-col-reverse md:flex-row text-center md:text-start ">
                    {/* Text Content */}
                    <div className="text-white flex-1 basis-[60%] min-w-0 w-[70%] md:w-full">
                      <h2
                        className="text-2xl md:text-3xl lg:text-5xl font-medium mb-3 md:mb-5 uppercase tracking-tight line-clamp-2"
                      >
                        {speaker.name}
                      </h2>
                      <p
                        className="text-[#E9EBF8] font-light text-base md:text-lg lg:text-2xl italic mx-auto md:mx-0 leading-relaxed line-clamp-2"
                      >
                        {speaker.title}
                      </p>

                    </div>
                    {/* Speaker Image */}
                    <div className="basis-[40%] md:w-56 md:h-56 lg:w-72 lg:h-72 aspect-square rounded-2xl overflow-hidden ring-4 ring-white/20 flex-shrink-0 mx-auto">
                      <Image
                        src={speaker.image}
                        alt={`Portrait of ${speaker.name}, ${speaker.title}`}
                        width={340}
                        height={322}
                        quality={85}
                        sizes="(max-width: 768px) 160px, (max-width: 1024px) 320px, 340px"
                        className="h-full object-cover object-center transition-transform duration-300 hover:scale-105"
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
      <div className="block lg:hidden w-full my-3 px-3">
        <div className="flex justify-end gap-2">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="w-10 h-10 bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200"
          />
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="w-10 h-10 bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200"
          />
        </div>
      </div>
    </section>
  );
};

export default Speakers;
