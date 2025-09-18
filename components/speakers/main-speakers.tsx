"use client";

import Image from "next/image";
import { CiGlobe } from "react-icons/ci";
import React, { useState, useEffect, useMemo } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { FiSearch, FiX } from "react-icons/fi";
import Link from "next/link";
import { SpeakersList } from "@/lib/speakers";
import { gotham } from "@/lib/fonts";
import { SpeakersGridSkeleton } from "./skeleton";
import "./animations.css";

export function SpeakersGrid() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const filteredSpeakers = useMemo(() => {
    return SpeakersList.filter((speaker) => {
      const matchesSearch =
        speaker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        speaker.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        speaker.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        speaker.expertise?.some((exp) =>
          exp.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesExpertise = selectedExpertise
        ? speaker.expertise?.includes(selectedExpertise)
        : true;

      return matchesSearch && matchesExpertise;
    });
  }, [searchTerm, selectedExpertise]);

  const expertiseOptions = useMemo(() => {
    const allExpertise = SpeakersList.flatMap((speaker) => speaker.expertise || []);
    return Array.from(new Set(allExpertise)).sort();
  }, []);

  if (isLoading) {
    return <SpeakersGridSkeleton />;
  }

  return (
    <section className="flex flex-col items-center justify-center lg:py-[30px] lg:px-[70px] py-8 px-4 sm:px-6">
      <h2 className="font-medium text-3xl sm:text-4xl md:text-5xl lg:text-[69.65px] lg:leading-[82px] tracking-[-2%] sm:tracking-[-3%] lg:tracking-[-5%] my-[20px] sm:my-[25px] lg:my-[60px] text-black text-center">
        Speak<span className="text-[#F2CB45]">3</span>rs
      </h2>

      {/* Search and Filter Section */}
      <div className="w-full max-w-4xl mb-6 sm:mb-8 space-y-3 sm:space-y-4 animate-slide-in-left px-2 sm:px-0">
        <div className="relative group">
          <FiSearch className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 group-focus-within:text-blue-500 transition-colors duration-200" />
          <input
            type="text"
            placeholder="Search speakers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 sm:pl-12 pr-8 sm:pr-10 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:shadow-lg outline-none transition-all duration-300 hover:border-gray-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Clear search"
            >
              <FiX className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        <div className="space-y-3">
          <span className="block text-xs sm:text-sm font-medium text-gray-600 text-center sm:text-left">
            Filter by expertise:
          </span>
          <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSelectedExpertise(null)}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 touch-manipulation ${selectedExpertise === null
                  ? "bg-blue-500 text-white shadow-sm"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400"
                }`}
            >
              All
            </button>
            {expertiseOptions.map((expertise) => (
              <button
                type="button"
                key={expertise}
                onClick={() => setSelectedExpertise(expertise)}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 touch-manipulation whitespace-nowrap ${selectedExpertise === expertise
                    ? "bg-blue-500 text-white shadow-sm"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400"
                  }`}
              >
                {expertise}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center text-gray-600">
          <span className="text-xs sm:text-sm">
            Showing {filteredSpeakers.length} of {SpeakersList.length} speakers
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 w-full max-w-7xl">
        {filteredSpeakers.length > 0 ? (
          filteredSpeakers.map((speaker, index) => (
            <div
              key={speaker.name}
              className={`flex flex-col items-center bg-white rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 md:p-6 border border-[#D1D1D1] shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-2 transition-all duration-500 ease-out gap-y-4 sm:gap-y-6 justify-around group animate-fade-in ${index < 6 ? `animate-delay-${(index + 1) * 100}` : ""
                }`}
            >
              <div className="relative shrink-0 w-[140px] h-[140px] xs:w-[160px] xs:h-[160px] sm:w-[180px] sm:h-[180px] md:w-[220px] md:h-[220px] lg:w-[280px] lg:h-[280px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105">
                <Image
                  src={speaker.image}
                  alt={`${speaker.name} - ${speaker.title}`}
                  fill
                  className={`object-cover ${speaker.imagePosition || "object-top"}`}
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
                    <div className="relative group/icon">
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
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover/icon:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                        Follow on Twitter
                      </div>
                    </div>
                  )}

                  {speaker.website && (
                    <div className="relative group/icon">
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
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover/icon:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                        Visit Website
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-8 sm:py-12 px-4">
            <div className="text-gray-400 mb-3 sm:mb-4">
              <FiSearch className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2 text-center">
              No speakers found
            </h3>
            <p className="text-sm sm:text-base text-gray-500 text-center max-w-sm sm:max-w-md mb-4">
              Try adjusting your search terms or clearing the filters to see more speakers.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedExpertise(null);
              }}
              className="mt-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-500 text-white text-sm sm:text-base rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors touch-manipulation"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
}