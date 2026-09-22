import Image from "next/image";
import Link from "next/link";
import { Building2 } from "lucide-react";
import type { Speaker } from "@/lib/speakers";

function generateSpeakerSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function FeaturedSpeakersGrid({ speakers }: { speakers: Speaker[] }) {
  return (
    <section className="section-y bg-paper">
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-brand-blue">2026 EDITION</p>
          <h1 className="text-display-sm mt-3 font-bold text-gray-900">
            The Lineup
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
            The founders, builders and voices taking the Blockfest Africa
            stage this October.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {speakers.map((speaker) => {
            const slug = generateSpeakerSlug(speaker.name);
            return (
              <Link
                key={speaker.name}
                href={`/speakers/${slug}`}
                className="group relative aspect-4/5 overflow-hidden rounded-xl border border-gray-200"
              >
                <Image
                  src={speaker.image}
                  alt={`${speaker.name} - ${speaker.title}`}
                  fill
                  className={`object-cover transition-transform duration-500 group-hover:scale-105 ${speaker.imagePosition || "object-top"
                    }`}
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h2 className="text-xl font-bold text-white">{speaker.name}</h2>
                  <p className="mt-1 text-sm text-white/75">{speaker.title}</p>
                  {speaker.company && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-white/60">
                      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {speaker.company}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}