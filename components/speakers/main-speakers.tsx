"use client";

import Image from "next/image";
import Link from "next/link";
import { CiGlobe } from "react-icons/ci";
import React, { useState, useEffect, useMemo } from "react";
import { FaXTwitter } from "react-icons/fa6";
import {
  FiSearch,
  FiX,
  FiFilter,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
} from "react-icons/fi";
import { SpeakersList } from "@/lib/speakers";
import { SpeakersGridSkeleton } from "./skeleton";

export function SpeakersGrid() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string | null>(
    null
  );
  const [showFilters, setShowFilters] = useState(false);

  const clearAllFilters = React.useCallback(() => {
    setSearchTerm("");
    setSelectedExpertise(null);
  }, []);

  const generateSpeakerSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

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
    const allExpertise = SpeakersList.flatMap(
      (speaker) => speaker.expertise || []
    );
    return Array.from(new Set(allExpertise)).sort();
  }, []);

  if (isLoading) {
    return <SpeakersGridSkeleton />;
  }

  return (
    <section className="py-12 lg:py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 lg:mb-10">
          <div className="inline-flex items-center gap-2 bg-brand-blue/10 rounded-full px-4 py-2 mb-4 border border-brand-blue/20">
            <span className="text-brand-blue font-semibold text-sm">
              2025 EDITION
            </span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold mb-4 text-gray-900">
            Speak<span className="text-brand-blue">3</span>rs
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Meet the visionary speakers who shared their insights at Blockfest
            Africa 2025
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="max-w-4xl mx-auto mb-8 lg:mb-10 space-y-4">
          <div className="relative group">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-brand-blue transition-colors duration-200" />
            <input
              type="text"
              placeholder="Search speakers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent focus:shadow-lg outline-none transition-all duration-300 hover:border-gray-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                aria-label="Clear search"
              >
                <FiX className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <div className="sm:hidden">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all duration-200 touch-manipulation"
              aria-label={showFilters ? "Hide filters" : "Show filters"}
            >
              <FiFilter className="w-4 h-4" />
              <span>Filter by expertise</span>
              {showFilters ? (
                <FiChevronUp className="w-4 h-4" />
              ) : (
                <FiChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Filter Section - Hidden on mobile by default, always visible on desktop */}
          <div
            className={`space-y-3 transition-all duration-300 ease-in-out overflow-hidden ${
              showFilters
                ? "block opacity-100 max-h-96"
                : "hidden opacity-0 max-h-0"
            } sm:block sm:opacity-100 sm:max-h-none sm:overflow-visible`}
          >
            <span className="hidden sm:block text-sm font-medium text-gray-600">
              Filter by expertise:
            </span>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2" role="group" aria-label="Filter speakers by expertise">
              <button
                type="button"
                onClick={() => setSelectedExpertise(null)}
                aria-pressed={selectedExpertise === null}
                className={`px-4 py-2.5 min-h-[44px] rounded-full text-sm font-medium transition-all duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${
                  selectedExpertise === null
                    ? "bg-brand-blue text-white shadow-sm"
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
                  aria-pressed={selectedExpertise === expertise}
                  className={`px-4 py-2.5 min-h-[44px] rounded-full text-sm font-medium transition-all duration-200 touch-manipulation whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${
                    selectedExpertise === expertise
                      ? "bg-brand-blue text-white shadow-sm"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400"
                  }`}
                >
                  {expertise}
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-gray-600">
            <span className="text-sm">
              Showing {filteredSpeakers.length} of {SpeakersList.length}{" "}
              speakers
            </span>
          </div>
        </div>

        {/* Speakers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filteredSpeakers.length > 0 ? (
            filteredSpeakers.map((speaker, index) => {
              const speakerSlug = generateSpeakerSlug(speaker.name);
              return (
                <div
                  key={`speaker-${speaker.name
                    .replace(/\s+/g, "-")
                    .toLowerCase()}-${index}`}
                  className="relative flex flex-col items-center bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl hover:shadow-brand-blue/10 hover:-translate-y-2 transition-all duration-500 ease-out gap-y-4 group"
                >
                  {/* Make card clickable via Link overlay */}
                  <Link
                    href={`/speakers/${speakerSlug}`}
                    className="absolute inset-0 z-0"
                    aria-label={`View ${speaker.name}'s profile`}
                  />

                  <div className="relative shrink-0 w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105 z-10 pointer-events-none">
                    <Image
                      src={speaker.image}
                      alt={`${speaker.name} - ${speaker.title}`}
                      fill
                      className={`object-cover ${
                        speaker.imagePosition || "object-top"
                      }`}
                      quality={85}
                      loading="lazy"
                      sizes="(min-width: 1024px) 192px, (min-width: 640px) 160px, 128px"
                    />
                  </div>

                  <div className="flex flex-col items-center gap-y-3 w-full z-10 pointer-events-none">
                    <div className="flex flex-col gap-y-1 items-center text-center w-full">
                      <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
                        {speaker.name}
                      </h3>
                      <p className="text-sm lg:text-base text-gray-600">
                        {speaker.title}
                      </p>
                    </div>

                    {/* Social links section */}
                    <div className="inline-flex gap-x-3 items-center relative z-20 pointer-events-auto">
                      {speaker.twitter && (
                        <div className="relative group/icon">
                          <a
                            href={speaker.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-11 h-11 rounded-full bg-brand-blue text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-brand-blue/25 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:ring-offset-2 touch-manipulation"
                            aria-label={`Follow ${speaker.name} on Twitter`}
                          >
                            <FaXTwitter size={18} className="shrink-0" />
                          </a>
                          {/* Hide tooltip on mobile to prevent clipping */}
                          <div className="hidden sm:block absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover/icon:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Follow on Twitter
                          </div>
                        </div>
                      )}

                      {speaker.website && (
                        <div className="relative group/icon">
                          <a
                            href={speaker.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-11 h-11 rounded-full bg-brand-gold text-gray-900 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-brand-gold/25 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:ring-offset-2 touch-manipulation"
                            aria-label={`Visit ${speaker.name}'s website`}
                          >
                            <CiGlobe size={20} className="shrink-0" />
                          </a>
                          {/* Hide tooltip on mobile to prevent clipping */}
                          <div className="hidden sm:block absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover/icon:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Visit Website
                          </div>
                        </div>
                      )}
                    </div>

                    {/* View Profile Indicator */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1 text-brand-blue text-sm font-medium">
                      <span>View Profile</span>
                      <FiExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-8 sm:py-12 px-4">
              <div className="text-gray-400 mb-3 sm:mb-4">
                <FiSearch className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2 text-center">
                No speakers found
              </h3>
              <p className="text-sm sm:text-base text-gray-500 text-center max-w-sm sm:max-w-md mb-4">
                Try adjusting your search terms or clearing the filters to see
                more speakers.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-2 px-6 py-3 bg-brand-blue text-white rounded-lg hover:bg-[#1553c7] active:bg-brand-blue-dark transition-colors touch-manipulation"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
