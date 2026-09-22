"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Globe,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { SpeakersList, isPastSpeaker } from "@/lib/speakers";

const PastSpeakersList = SpeakersList.filter(isPastSpeaker);

function generateSpeakerSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function PastSpeakersGrid() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const clearAllFilters = React.useCallback(() => {
    setSearchTerm("");
    setSelectedExpertise(null);
  }, []);

  const filteredSpeakers = useMemo(() => {
    return PastSpeakersList.filter((speaker) => {
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
    const all = PastSpeakersList.flatMap((s) => s.expertise || []);
    return Array.from(new Set(all)).sort();
  }, []);

  return (
    <section className="section-y bg-paper">
      <div className="container-page">
        {/* Header — a number does the talking instead of a stock "meet our
            speakers" line. Speak3rs wordmark stays so this still reads as the
            same brand as /speakers, just the archive edition of it. */}
        <div className="mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-brand-blue">THE ARCHIVE</p>
            <h1 className="text-display-sm mt-3 font-bold text-gray-900">
              Past Speak<span className="text-brand-blue">3</span>rs
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">
              Every founder, regulator and builder who has stood on the
              Blockfest Africa stage — the voices that got us here.
            </p>
          </div>
          <div className="flex shrink-0 items-baseline gap-3 lg:flex-col lg:items-end lg:text-right">
            <span className="text-display-sm font-bold text-brand-blue">
              {PastSpeakersList.length}
            </span>
            <span className="text-sm font-medium text-gray-600">
              speakers across 3 editions
            </span>
          </div>
        </div>

        {/* Search + filter — same behaviour as before, just restyled to sit
            under the new header. */}
        <div className="mb-10 space-y-4 lg:mb-12">
          <div className="group relative max-w-md">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors duration-200 group-focus-within:text-brand-blue"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search past speakers..."
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

          <div
            className={`space-y-3 overflow-hidden transition-colors duration-300 ease-in-out ${showFilters
                ? "block max-h-96 opacity-100"
                : "hidden max-h-0 opacity-0"
              } sm:block sm:max-h-none sm:overflow-visible sm:opacity-100`}
          >
            <span className="hidden text-sm font-medium text-gray-600 sm:block">
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
                className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${selectedExpertise === null
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
                  className={`min-h-11 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${selectedExpertise === expertise
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
              Showing {filteredSpeakers.length} of {PastSpeakersList.length}{" "}
              speakers
            </span>
          </div>
        </div>

        {/* Poster-style grid: photo fills the card, name/title/bio live in a
            scrim at the base, like an event lineup poster rather than a
            circle-avatar "team member" card. This is the main departure from
            the old design and the thing that stops it reading as templated. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSpeakers.length > 0 ? (
            filteredSpeakers.map((speaker, index) => {
              const slug = generateSpeakerSlug(speaker.name);
              const bioTeaser = speaker.bio?.split("\n\n")[0];
              return (
                <div
                  key={`${slug}-${index}`}
                  className="group relative aspect-3/4 overflow-hidden rounded-xl border border-gray-200 bg-gray-900"
                >
                  <Link
                    href={`/speakers/${slug}`}
                    className="absolute inset-0 z-10"
                    aria-label={`View ${speaker.name}'s profile`}
                  />

                  <Image
                    src={speaker.image}
                    alt={`${speaker.name} - ${speaker.title}`}
                    fill
                    className={`object-cover transition-transform duration-500 group-hover:scale-105 ${speaker.imagePosition || "object-top"
                      }`}
                    quality={85}
                    loading="lazy"
                    sizes="(min-width: 1280px) 23vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 47vw"
                  />

                  {/* Thin gradient band at rest so photos still read as
                      photos, deepening on hover to hold the teaser legibly. */}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent transition-all duration-300 group-hover:from-black/95 group-hover:via-black/50" />

                  {speaker.expertise?.[0] && (
                    <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                      {speaker.expertise[0]}
                    </span>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4">
                    <h2 className="text-base font-bold text-white sm:text-lg">
                      {speaker.name}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/70 sm:text-sm">
                      {speaker.title}
                    </p>

                    {/* Bio teaser + socials, revealed on hover/focus, per
                        your call — max-height transition so it animates
                        rather than snapping open. group-focus-within picks up
                        keyboard tabbing too. */}
                    <div className="mt-0 max-h-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:mt-2 group-hover:max-h-40 group-hover:opacity-100 group-focus-within:mt-2 group-focus-within:max-h-40 group-focus-within:opacity-100">
                      {bioTeaser && (
                        <p className="line-clamp-3 text-xs leading-relaxed text-white/80">
                          {bioTeaser}
                        </p>
                      )}
                      <div className="pointer-events-auto relative z-20 mt-3 flex items-center gap-2">
                        {speaker.twitter && (
<a
                          href = { speaker.twitter }
                            target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:border-white hover:bg-white/10 touch-manipulation"
                        aria-label={`Follow ${speaker.name} on Twitter`}
                          >
                        <FaXTwitter className="h-4 w-4" aria-hidden="true" />
                      </a>
                        )}
                      {speaker.website && (
                          <a

                        href = { speaker.website }
                            target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:border-white hover:bg-white/10 touch-manipulation"
                      aria-label={`Visit ${speaker.name}'s website`}
                          >
                      <Globe className="h-4 w-4" aria-hidden="true" />
                    </a>
                        )}
                  </div>
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
      </div >
    </section >
  );
}