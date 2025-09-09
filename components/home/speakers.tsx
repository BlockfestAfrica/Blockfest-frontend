// import { EmblaOptionsType } from "embla-carousel";
// import Speakers from "../carousel";
import React from "react";

export function SpeakersSection() {
  // const OPTIONS: EmblaOptionsType = { loop: true }
  // const SLIDES = [
  //   {
  //     name: "Nduka Blessing",
  //     title: "CEO SOLUTIONS",
  //     image: "/images/speaker.webp",
  //   },
  //   {
  //     name: "John Smith",
  //     title: "CTO INNOVATIONS",
  //     image: "/images/speaker.webp",
  //   }
  // ]

  return (
    <section
      className="flex flex-col items-center justify-center lg:py-[80px] lg:px-[70px] py-14 px-5"
      id="speakers"
    >
      <h2 className="font-medium text-4xl lg:text-5xl lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] my-[25px] lg:my-[50px] text-black">
        Our Speakers
      </h2>

      {/* Revealing Soon Design */}
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-[#1B64E4] to-[#3D7BE8] rounded-3xl p-8 lg:p-12 text-center text-white shadow-2xl">
          <div className="mb-6">
            <div className="w-24 h-24 lg:w-32 lg:h-32 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center">
              <div className="text-4xl lg:text-5xl">🎤</div>
            </div>
            <h3 className="text-3xl lg:text-5xl font-bold mb-4">
              <span className="text-[#F2CB45]">Revealing Soon!</span>
            </h3>
            <p className="text-lg lg:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
              An incredible lineup of Africa&apos;s most influential Web3
              leaders and innovators.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
            <div className="flex items-center gap-2 text-[#F2CB45] font-semibold">
              <div className="w-2 h-2 bg-[#F2CB45] rounded-full animate-pulse"></div>
              <span>Industry Leaders</span>
            </div>
            <div className="flex items-center gap-2 text-[#F2CB45] font-semibold">
              <div className="w-2 h-2 bg-[#F2CB45] rounded-full animate-pulse delay-300"></div>
              <span>Tech Innovators</span>
            </div>
            <div className="flex items-center gap-2 text-[#F2CB45] font-semibold">
              <div className="w-2 h-2 bg-[#F2CB45] rounded-full animate-pulse delay-500"></div>
              <span>Global Experts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Original carousel code commented out */}
      {/* <Speakers speakers={SLIDES} options={OPTIONS} /> */}
    </section>
  );
}
