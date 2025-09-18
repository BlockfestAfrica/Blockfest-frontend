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

  // Dot navigation functionality
  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
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

  // Keyboard navigation
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
      className={`embla w-full flex items-center justify-center flex-col relative px-0 lg:px-20 ${className}`}
      role="region"
      aria-label="Speaker carousel"
      aria-live="polite"
    >
      {/* Navigation Buttons - Positioned absolutely */}
      <div className="hidden lg:block">
        <div className="absolute left-4 lg:left-8 top-1/2 transform -translate-y-1/2 z-10">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="w-[100px] h-[100px] bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200"
          />
        </div>

        <div className="absolute right-4 lg:right-8 top-1/2 transform -translate-y-1/2 z-10">
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="w-[100px] h-[100px] bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200"
          />
        </div>
      </div>

      {/* Carousel Container */}
      <div
        className="overflow-hidden w-full xl:max-w-5xl mx-auto"
        ref={emblaRef}
        role="group"
        aria-label="Speaker slides"
      >
        <div className="flex touch-pan-y touch-pinch-zoom min-h-[400px] md:min-h-[450px] lg:min-h-[500px]">
          {speakers.map((speaker, index) => (
            <div
              className="transform-gpu flex-[0_0_100%] min-w-0 flex justify-center items-center px-2 md:px-5 h-full"
              key={`${speaker.name}-${index}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${speakers.length}`}
            >
              {/* Speaker Card */}
              <Link
                href="/speakers"
                className="block w-full group cursor-pointer"
                aria-label={`View all speakers including ${speaker.name}`}
              >
                <div className="bg-gradient-to-b from-[#0F377E] to-[#1B64E4] rounded-3xl p-6 md:p-8 w-full xl:max-w-[839px] mx-auto min-h-[400px] md:min-h-[450px] lg:min-h-[500px] shadow-2xl border border-white/10 flex items-center transition-all duration-300 hover:shadow-3xl hover:scale-[1.02] hover:border-white/20">
                  <div className="flex items-center md:justify-between justify-center gap-6 flex-col-reverse md:flex-row text-center md:text-start w-full">
                    {/* Text Content */}
                    <div className="text-white flex-1 basis-[60%] flex flex-col justify-center min-h-[280px] md:min-h-[320px] lg:min-h-[360px]">
                      <div className="flex-1 flex flex-col justify-center">
                        <h2
                          className="text-2xl md:text-[35px] lg:text-[57.65px] lg:leading-[68.05px] font-medium mb-4 md:mb-6 uppercase tracking-tight line-clamp-3"
                          id={`speaker-${index}-name`}
                        >
                          {speaker.name}
                        </h2>
                        <p
                          className="text-[#E9EBF8] font-light text-base md:text-[20px] lg:text-[26.49px] lg:leading-[32px] italic line-clamp-4"
                          id={`speaker-${index}-title`}
                        >
                          {speaker.title}
                        </p>
                      </div>
                    </div>

                    {/* Speaker Image */}
                    <div className="w-full md:w-80 md:h-80 lg:w-96 lg:h-96 basis-[40%] rounded-2xl overflow-hidden ring-4 ring-white/20 flex-shrink-0">
                      <Image
                        src={speaker.image}
                        alt={`Portrait of ${speaker.name}, ${speaker.title}`}
                        width={384}
                        height={384}
                        quality={90}
                        sizes="(max-width: 768px) 280px, (max-width: 1024px) 320px, 384px"
                        priority={index === 0} // Only prioritize first image
                        loading={index === 0 ? "eager" : "lazy"}
                        className="w-full h-[280px] md:h-80 lg:h-96 object-cover object-center transition-transform duration-300 hover:scale-105"
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
          className="flex justify-center gap-2 mt-6 mb-4"
          role="tablist"
          aria-label="Speaker slides"
        >
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                index === selectedIndex
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
      <div className="block lg:hidden w-full my-4 px-5">
        <div className="flex justify-end gap-3">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="w-[50px] h-[50px] bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200"
          />
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="w-[50px] h-[50px] bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200"
          />
        </div>
      </div>
    </section>
  );
};

export default Speakers;
