"use client";
import { Montserrat } from "next/font/google";

import Image from "next/image";
import React from "react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
export function WhyAttendSection() {
  useSubtleAnimations();

  return (
    <section
      className="flex flex-col items-center justify-center px-2.5 py-20 lg:py-[80px] lg:px-[70px] bg-gradient-to-b from-[#1A3461] to-[#005DFF]"
      id="about"
    >
      <h2 className="font-[350px] text-4xl lg:text-[69.65px] lg:leading-[82px] tracking-[-5%] mb-[40px] lg:my-[50px] text-white fade-in-on-scroll">
        Why Attend<span className="text-[#F2CB45]">?</span>
      </h2>
      <div className="scale-in">
        <FeaturesComp />
      </div>
    </section>
  );
}

function FeaturesComp() {
  const categories = [
    {
      image: "/images/super.webp",
      header: "Africa's Web3 SuperBowl",
      text: "Blockchain Africa is not just an event, it's a movement. When Africa throws a party, the world tunes in. Get ready for Web3 like never before.",
    },
    {
      image: "/images/img2.webp",
      header: "Live Panels & Masterclasses",
      text: "Hear from the continent's boldest builders, creators, and thinkers. Dive into sessions that go beyond talk but straight into action.",
    },
    {
      image: "/images/founders.webp",
      header: "Founders, Creators & Communities",
      text: "From your first NFT to your next big Web3 project, Blockfest connects the minds shaping Africa’s digital frontier.",
    },
    {
      image: "/images/become.webp",
      header: "Buidl • Bridge • Become",
      text: "These aren't just themes , they're a roadmap to unlocking Africa's blockchain potential.",
    },
    {
      image: "/images/starts.webp",
      header: "Your Web3 Journey Starts Here",
      text: " Whether you're a curious newcomer or a seasoned pro, Blockfest is your gateway to the future of Africa's digital economy.",
    },
    {
      image: "/images/builders.webp",
      header: "For Builders, Dreamers & Doers",
      text: "Web3 isn’t for someday. It’s now. Join a community of disruptors turning vision into products, code, and movements.",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mx-10 md:mx-5 lg:mx-0">
        {categories.map((category, index) => (
          <div
            key={`${category.header}-${index}`}
            className="flex flex-col md:flex-row items-stretch gap-x-0 lg:gap-x-4 bg-white rounded-[11px] lg:rounded-[20px] shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden "
          >
            {/* Image Section */}
            <div className="w-full md:w-[40%] flex">
              <div className="relative w-full h-[200px] md:h-auto flex-1 overflow-hidden rounded-l-[11px] lg:rounded-l-[20px] md:rounded-r-none">
                <Image
                  src={category.image}
                  alt={`${category.header} - Blockfest Africa benefit`}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 40vw, 300px"
                  loading="lazy"
                  className="object-cover object-center scale-115"
                />
              </div>
            </div>

            {/* Content Section */}
            <div className="flex flex-col  justify-center flex-1 text-left p-4 ">
              <h3 className="text-[#1B64E4] font-medium text-[21px] xl:text-[41.03px] leading-[21.91px] xl:leading-[42.74px] xl:mb-2">
                {category.header}
              </h3>
              <p
                className={`${montserrat.className} text-[#808080] text-[9px] xl:text-[17.1px] xl:leading-[1.2] font-medium w-[90%]`}
              >
                {category.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
