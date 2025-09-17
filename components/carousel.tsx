"use client";
import type React from "react";
import { useCallback } from "react";
import type { EmblaOptionsType, EmblaCarouselType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { NextButton, PrevButton, usePrevNextButtons } from "./carouselbuttons";

type Speaker = {
  name: string;
  title: string;
  image: string;
};

type PropType = {
  speakers: Speaker[];
  options?: EmblaOptionsType;
};

const Speakers: React.FC<PropType> = (props) => {
  const { speakers, options } = props;
  const [emblaRef, emblaApi] = useEmblaCarousel(options, [Autoplay()]);

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

  return (
    <section className="embla w-full flex items-center justify-center flex-col relative px-0 lg:px-20">
      {/* Navigation Buttons - Positioned absolutely */}
      <div className="hidden lg:block">
        <div className="absolute left-4 lg:left-8 top-1/2 transform -translate-y-1/2 z-10">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="w-[100px] h-[100px] bg-[#D9D9D9] hover:bg-gray-300 rounded-full flex items-center justify-center  transition-colors duration-200"
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
      >
        <div className="flex touch-pan-y touch-pinch-zoom">
          {speakers.map((speaker, index) => (
            <div
              className="transform-gpu flex-[0_0_100%] min-w-0 flex justify-center items-center px-2 md:px-5"
              key={`${speaker.name}-${index}`}
            >
              {/* Speaker Card */}
              <div className="bg-gradient-to-b from-[#0F377E] to-[#1B64E4] rounded-3xl p-8 w-full xl:max-w-[839px] mx-auto h-fit md:h-fit flex items-center">
                <div className="flex items-center md:justify-between justify-center gap-6 flex-col-reverse md:flex-row text-center md:text-start">
                  {/* Text Content */}
                  <div className="text-white flex-1 basis-[60%]">
                    <h2 className="text-2xl lg:text-[57.65px] lg:leading-[68.05px] font-[350px] mb-2 uppercase">
                      {speaker.name}
                    </h2>
                    <p className="text-[#E9EBF8] font-light text-base lg:text-[26.49px] lg:leading-[32px] italic">
                      {speaker.title}
                    </p>
                  </div>

                  {/* Speaker Image */}
                  <div className="w-full md:w-80 md:h-80 basis-[40%] rounded-2xl overflow-hidden ">
                    <Image
                      src={speaker.image}
                      alt={`${speaker.name} - ${speaker.title}`}
                      width={340}
                      height={322}
                      sizes="(max-width: 768px) 160px, (max-width: 1024px) 320px, 340px"
                      priority
                      className=" md:object-cover object-center h-[350px] md:h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
