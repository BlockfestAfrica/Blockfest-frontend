"use client";

import Image from "next/image";
import { CiGlobe } from "react-icons/ci";
import React, { useState, useEffect } from "react";
import { FaXTwitter } from "react-icons/fa6";
import Link from "next/link";
import { SpeakersList } from "@/lib/speakers";
import { gotham } from "@/lib/fonts";
import { SpeakersGridSkeleton } from "./skeleton";

export function SpeakersGrid() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time - in real app this might be an API call
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <SpeakersGridSkeleton />;
  }

  return (
    <section className="flex flex-col items-center justify-center lg:py-[30px] lg:px-[70px] py-8 px-4 sm:px-6">
      <h2 className="font-medium text-3xl sm:text-4xl md:text-5xl lg:text-[69.65px] lg:leading-[82px] tracking-[-2%] sm:tracking-[-3%] lg:tracking-[-5%] my-[20px] sm:my-[25px] lg:my-[80px] text-black text-center">
        Speak<span className="text-[#F2CB45]">3</span>rs
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 w-full max-w-7xl">
        {SpeakersList.map((speaker) => (
          <div
            key={speaker.name}
            className="flex flex-col items-center bg-white rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 md:p-6 border border-[#D1D1D1] shadow-sm hover:shadow-md transition-all duration-300 gap-y-4 sm:gap-y-6 justify-around group"
          >
            <div className="relative shrink-0 w-[140px] h-[140px] xs:w-[160px] xs:h-[160px] sm:w-[180px] sm:h-[180px] md:w-[220px] md:h-[220px] lg:w-[280px] lg:h-[280px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105">
              <Image
                src={speaker.image}
                alt={`${speaker.name} - ${speaker.title}`}
                fill
                className={`object-cover ${
                  speaker.imagePosition || "object-top"
                }`}
                quality={85}
                loading="lazy"
                sizes="(min-width: 1024px) 280px, (min-width: 768px) 220px, (min-width: 640px) 180px, (min-width: 480px) 160px, 140px"
              />
            </div>

            <div className="flex flex-col items-center gap-y-3 sm:gap-y-4 w-full">
              <div className="flex flex-col gap-y-1 sm:gap-y-2 items-center text-center w-full">
                <h3
                  className={`${gotham.className} text-lg xs:text-xl sm:text-2xl md:text-[26px] lg:text-[29px] font-bold md:font-semibold leading-tight`}
                >
                  {speaker.name}
                </h3>
                <p
                  className={`${gotham.className} text-sm xs:text-base sm:text-lg md:text-[18px] lg:text-[20px] font-medium text-[#A4A4A4] leading-relaxed px-2 sm:px-0`}
                >
                  {speaker.title}
                </p>
              </div>

              {/* Social links section */}
              <div className="inline-flex gap-x-3 items-center">
                {speaker.twitter && (
                  <div className="group relative">
                    <Link
                      href={speaker.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-[#1DA1F2] to-[#0ea5e9] text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-3 focus:ring-blue-500/50 focus:ring-offset-2"
                      aria-label={`Follow ${speaker.name} on Twitter`}
                      title={`Follow ${speaker.name} on Twitter`}
                    >
                      <FaXTwitter size={18} />
                    </Link>
                    {/* Tooltip */}
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                      Follow on Twitter
                    </div>
                  </div>
                )}
                {speaker.website && (
                  <div className="group relative">
                    <Link
                      href={speaker.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-[#3D7BE8] to-[#6597ED] text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-3 focus:ring-blue-500/50 focus:ring-offset-2"
                      aria-label={`Visit ${speaker.name}'s website`}
                      title={`Visit ${speaker.name}'s website`}
                    >
                      <CiGlobe size={20} />
                    </Link>
                    {/* Tooltip */}
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                      Visit Website
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
