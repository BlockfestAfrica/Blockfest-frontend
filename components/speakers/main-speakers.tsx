"use client";

import Image from "next/image";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useState, useMemo } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { SpeakersList } from "@/lib/speakers";

export function SpeakersGrid() {
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

  return (
    /* Light-section shell, minus the usual `border-t border-gray-200`: this grid
       only ever renders directly under <ComingSoonNotice> on /speakers, which
       already draws that divider as its own border-b. Adding one here would
       stack two rules into a 2px line. The divider the system asks for is
       present — it is just owned by the element above. */
    <section className="section-y bg-paper">
      <div className="container-page">
        {/* Header */}
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-brand-blue">2025 EDITION</p>
          <h1 className="text-display-sm mt-3 font-bold text-gray-900">
            Speak<span className="text-brand-blue">3</span>rs
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
            Meet the visionary speakers who shared their insights at Blockfest
            Africa 2025
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-10 space-y-4 lg:mb-12">
          <div className="relative group max-w-md">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors duration-200 group-focus-within:text-brand-blue"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search speakers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-h-11 w-full rounded-md border border-gray-200 bg-white py-3 pl-11 pr-12 text-base text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 hover:border-brand-blue focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-900"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <div className="sm:hidden">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition-colors duration-200 hover:border-brand-blue hover:text-gray-900 touch-manipulation"
              aria-label={showFilters ? "Hide filters" : "Show filters"}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span>Filter by expertise</span>
              {showFilters ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Filter Section - Hidden on mobile by default, always visible on desktop */}
          <div
            className={`space-y-3 transition-colors duration-300 ease-in-out overflow-hidden ${
              showFilters
                ? "block opacity-100 max-h-96"
                : "hidden opacity-0 max-h-0"
            } sm:block sm:opacity-100 sm:max-h-none sm:overflow-visible`}
          >
            <span className="hidden sm:block text-sm font-medium text-gray-600">
              Filter by expertise:
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter speakers by expertise"
            >
              <button
                type="button"
                onClick={() => setSelectedExpertise(null)}
                aria-pressed={selectedExpertise === null}
                className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${
                  selectedExpertise === null
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-brand-blue hover:text-gray-900"
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
                  className={`min-h-11 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${
                    selectedExpertise === expertise
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-brand-blue hover:text-gray-900"
                  }`}
                >
                  {expertise}
                </button>
              ))}
            </div>
          </div>

          <div className="text-gray-500">
            <span className="text-sm">
              Showing {filteredSpeakers.length} of {SpeakersList.length}{" "}
              speakers
            </span>
          </div>
        </div>

        {/* Speakers Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {filteredSpeakers.length > 0 ? (
            filteredSpeakers.map((speaker, index) => {
              const speakerSlug = generateSpeakerSlug(speaker.name);
              return (
                <div
                  key={`speaker-${speaker.name
                    .replace(/\s+/g, "-")
                    .toLowerCase()}-${index}`}
                  className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-6 transition-colors duration-300 hover:border-brand-blue"
                >
                  {/* Make card clickable via Link overlay */}
                  <Link
                    href={`/speakers/${speakerSlug}`}
                    className="absolute inset-0 z-0"
                    aria-label={`View ${speaker.name}'s profile`}
                  />

                  <div className="pointer-events-none relative z-10 h-32 w-32 shrink-0 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-105 sm:h-40 sm:w-40 lg:h-48 lg:w-48">
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

                  <div className="pointer-events-none z-10 mt-5 flex w-full flex-col">
                    <h2 className="text-lg font-bold text-gray-900">
                      {speaker.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {speaker.title}
                    </p>

                    {/* Social links section */}
                    <div className="pointer-events-auto relative z-20 mt-4 inline-flex items-center gap-x-2">
                      {speaker.twitter && (
                        <div className="relative group/icon">
                          <a
                            href={speaker.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 touch-manipulation"
                            aria-label={`Follow ${speaker.name} on Twitter`}
                          >
                            <FaXTwitter
                              className="h-5 w-5 shrink-0"
                              aria-hidden="true"
                            />
                          </a>
                          {/* Hide tooltip on mobile to prevent clipping */}
                          <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ground px-2 py-1 text-xs text-white sm:group-hover/icon:block">
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
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 touch-manipulation"
                            aria-label={`Visit ${speaker.name}'s website`}
                          >
                            <Globe
                              className="h-5 w-5 shrink-0"
                              aria-hidden="true"
                            />
                          </a>
                          {/* Hide tooltip on mobile to prevent clipping */}
                          <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ground px-2 py-1 text-xs text-white sm:group-hover/icon:block">
                            Visit Website
                          </div>
                        </div>
                      )}
                    </div>

                    {/* View Profile Indicator */}
                    <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-brand-blue">
                      <span>View Profile</span>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full rounded-xl border border-gray-200 bg-paper-muted p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <Search className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                No speakers found
              </h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-gray-600">
                Try adjusting your search terms or clearing the filters to see
                more speakers.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand-blue px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark touch-manipulation"
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
