"use client";

import Image from "next/image";
import Link from "next/link";
import { Building2, Globe } from "lucide-react";
import { useMemo, useState } from "react";
import { FaXTwitter, FaLinkedin, FaYoutube } from "react-icons/fa6";
import type { Speaker } from "@/lib/speakers";

function generateSpeakerSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function FeaturedSpeakersGrid({ speakers }: { speakers: Speaker[] }) {
  const [selectedExpertise, setSelectedExpertise] = useState<string | null>(
    null
  );

  const expertiseOptions = useMemo(() => {
    const all = speakers.flatMap((s) => s.expertise || []);
    return Array.from(new Set(all)).sort();
  }, [speakers]);

  const filteredSpeakers = useMemo(() => {
    if (!selectedExpertise) return speakers;
    return speakers.filter((s) => s.expertise?.includes(selectedExpertise));
  }, [speakers, selectedExpertise]);

  return (
    <section className="section-y bg-paper">
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-brand-blue">2026 EDITION</p>
          <h1 className="text-display-sm mt-3 font-bold text-gray-900">
            The Lineup
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
            The founders, builders, regulators and voices taking the
            Blockfest Africa stage this October.
          </p>
        </div>

        {expertiseOptions.length > 1 && (
          <div
            className="mb-10 flex flex-wrap gap-2 lg:mb-12"
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
              All Speakers
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
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSpeakers.map((speaker) => {
            const slug = generateSpeakerSlug(speaker.name);
            const bioTeaser = speaker.bio?.split("\n\n")[0];

            return (
              <div
                key={speaker.name}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow duration-300 hover:shadow-lg"
              >
                <Link
                  href={`/speakers/${slug}`}
                  className="absolute inset-0 z-10"
                  aria-label={`View ${speaker.name}'s profile`}
                />

                <div className="relative aspect-4/4 w-full overflow-hidden bg-gray-100">
                  <Image
                    src={speaker.image}
                    alt={`${speaker.name} - ${speaker.title}`}
                    fill
                    className={`object-cover transition-transform duration-500 group-hover:scale-105 ${speaker.imagePosition || "object-top"}`}
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                  />
                  {speaker.expertise?.[0] && (
                    <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-900 backdrop-blur-sm">
                      {speaker.expertise[0]}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-bold text-gray-900">
                    {speaker.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">{speaker.title}</p>

                  {speaker.company && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-blue">
                      <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {speaker.company}
                    </p>
                  )}

                  {bioTeaser && (
                    <div className="mt-0 max-h-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:mt-3 group-hover:max-h-32 group-hover:opacity-100 group-focus-within:mt-3 group-focus-within:max-h-32 group-focus-within:opacity-100">
                      <p className="line-clamp-4 text-sm leading-relaxed text-gray-500">
                        {bioTeaser}
                      </p>
                    </div>
                  )}

                  {(speaker.twitter || speaker.linkedin || speaker.youtube || speaker.website) && (
                    <div className="pointer-events-auto relative z-20 mt-auto flex items-center gap-2 pt-4">
                      {speaker.twitter && (
                        <a
                          href={speaker.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
                          aria-label={`Follow ${speaker.name} on Twitter`}
                        >
                          <FaXTwitter className="h-4 w-4" aria-hidden="true" />
                        </a>
                      )}

                      {speaker.linkedin && (
                        <a
                          href={speaker.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
                          aria-label={`Connect with ${speaker.name} on LinkedIn`}
                        >
                          <FaLinkedin className="h-4 w-4" aria-hidden="true" />
                        </a>
                      )}

                      {speaker.youtube && (
                        <a
                          href={speaker.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
                          aria-label={`Watch ${speaker.name} on YouTube`}
                        >
                          <FaYoutube className="h-4 w-4" aria-hidden="true" />
                        </a>
                      )}

                      {speaker.website && (
                        <a
                          href={speaker.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
                          aria-label={`Visit ${speaker.name}'s website`}
                        >
                          <Globe className="h-4 w-4" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}