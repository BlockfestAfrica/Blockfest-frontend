"use client";

import Image from "next/image";
import Link from "next/link";
import { Building2, Globe } from "lucide-react";
import { useMemo, useState } from "react";
import { FaXTwitter, FaLinkedin, FaYoutube } from "react-icons/fa6";
import { arrangeLineup, type Speaker } from "@/lib/speakers";

function generateSpeakerSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/**
 * The title without its company when the company line right under it already
 * says it: "Co-Founder & CEO, Owego" over "Owego" read the name twice.
 */
function titleWithoutCompany(title: string, company?: string) {
  if (!company) return title;
  const suffix = `, ${company}`;
  return title.toLowerCase().endsWith(suffix.toLowerCase())
    ? title.slice(0, -suffix.length)
    : title;
}

/** A chip reached by Tab is scrolled fully into the phone's chip row. */
function revealChip(event: React.FocusEvent<HTMLButtonElement>) {
  event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
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
    const list = selectedExpertise
      ? speakers.filter((s) => s.expertise?.includes(selectedExpertise))
      : speakers;
    // The lineup's arrangement, within whatever the filter leaves.
    return arrangeLineup(list);
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
          /* One row that scrolls sideways on a phone, where wrapping put
             five rows of chips above the first speaker; wraps from sm up.
             - Runs to the screen edge and fades out there, so the row reads
               as continuing at every width. A chip cut by the edge only
               happened at some widths; at 320px the edge fell between two.
             - A little room above and below, so a focus ring is not clipped
               by the scroller.
             - Scrollbar hidden on touch screens only: a mouse in a narrow
               window has nothing else to drag.
             - scroll-px keeps a chip scrolled into view clear of the edges. */
          <div
            className="-mx-4 -mt-1 mb-10 flex scroll-px-4 gap-2 overflow-x-auto py-1 pl-4 pr-12 [mask-image:linear-gradient(to_right,black_85%,transparent)] pointer-coarse:[scrollbar-width:none] sm:mx-0 sm:mt-0 sm:flex-wrap sm:overflow-visible sm:p-0 sm:[mask-image:none] lg:mb-12 pointer-coarse:[&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Filter speakers by expertise"
          >
            <button
              type="button"
              onClick={() => setSelectedExpertise(null)}
              onFocus={revealChip}
              aria-pressed={selectedExpertise === null}
              className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${selectedExpertise === null
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
                onFocus={revealChip}
                aria-pressed={selectedExpertise === expertise}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${selectedExpertise === expertise
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {filteredSpeakers.map((speaker) => {
            const slug = generateSpeakerSlug(speaker.name);
            const bioTeaser = speaker.bio?.split("\n\n")[0];
            const isSpecialGuest = speaker.role === "special-guest";
            const isKeynote = speaker.role === "keynote";
            /* The one label a speaker wears in gold over their portrait. */
            const badge = isKeynote ? "Keynote Speaker" : isSpecialGuest ? "Special Guest" : null;

            return (
              /* The ring is on the card: the profile link covering it is
                 clipped by the card's rounded overflow, so its own outline
                 never showed. */
              <div
                key={speaker.name}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow duration-300 hover:shadow-lg has-[>a:focus-visible]:ring-2 has-[>a:focus-visible]:ring-brand-blue has-[>a:focus-visible]:ring-offset-2"
              >
                <Link
                  href={`/speakers/${slug}`}
                  className="absolute inset-0 z-10"
                  aria-label={`View ${speaker.name}'s profile${badge ? ` (${badge.toLowerCase()})` : ""
                    }`}
                />

                {/* A little shorter than square on a phone, where six
                    full-width squares made a very long page. */}
                <div className="relative aspect-4/3 w-full overflow-hidden bg-gray-100 sm:aspect-square">
                  <Image
                    src={speaker.image}
                    alt={`${speaker.name} - ${speaker.title}`}
                    fill
                    // The phone frame is 4:3, shorter than the square above it,
                    // so it is framed a fifth of the way down rather than at the
                    // very top: object-top cut a tall portrait off at the mouth.
                    className={`object-cover transition-transform duration-500 group-hover:scale-105 ${speaker.imagePosition || "object-[50%_20%] sm:object-top"}`}
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    // The first portrait is the page's largest paint.
                    priority={speaker === speakers[0]}
                  />

                  {/* Keynote speakers and special guests wear the brand gold,
                      the same one the site's gold CTAs use. Everyone else
                      keeps their expertise chip. */}
                  {badge ? (
                    <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-brand-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-900">
                      {badge}
                    </span>
                  ) : (
                    speaker.expertise?.[0] && (
                      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-900 backdrop-blur-sm">
                        {speaker.expertise[0]}
                      </span>
                    )
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-bold text-gray-900">
                    {speaker.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {titleWithoutCompany(speaker.title, speaker.company)}
                  </p>

                  {speaker.company && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-blue">
                      <Building2
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
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

                  {(speaker.twitter ||
                    speaker.linkedin ||
                    speaker.youtube ||
                    speaker.website) && (
                      <div className="pointer-events-auto relative z-20 mt-auto flex items-center gap-2 pt-4">
                        {speaker.twitter && (
                          <a
                            href={speaker.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
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
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
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
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
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
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue touch-manipulation"
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