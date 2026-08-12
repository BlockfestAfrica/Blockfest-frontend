import React from "react";
import { Calendar, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { blockfest2026SouthAfrica, blockfest2026Lagos } from "@/lib/events";
import { saGallery } from "@/lib/sa-gallery";
import { EventHighlights } from "@/components/shared/event-highlights";
import { EventCta } from "@/components/shared/event-cta";

export const metadata: Metadata = {
  title: "Blockfest Africa '26 South Africa - Cape Town Roadshow Recap",
  description:
    "That's a wrap on Blockf3st Africa '26 in South Africa! Relive the Cape Town roadshow. Builder meetups, sessions and experiences that brought Africa's Web3 community together ahead of Lagos.",
  keywords: [
    "blockfest africa south africa",
    "blockfest cape town 2026",
    "web3 south africa",
    "blockchain conference cape town",
    "blockfest roadshow recap",
    "web3 africa 2026",
  ],
  openGraph: {
    title: "Blockfest Africa '26 South Africa - Cape Town Roadshow Recap",
    description:
      "That's a wrap on Blockf3st Africa '26 in South Africa! Relive the Cape Town roadshow that brought Africa's Web3 community together.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Blockfest Africa '26 South Africa Recap",
      },
    ],
  },
  alternates: {
    canonical: "https://blockfestafrica.com/blockfest-south-africa-2026",
  },
};

const event = blockfest2026SouthAfrica;

export default function BlockfestSouthAfrica2026Page() {
  return (
    <main id="main" className="min-h-screen bg-paper">
      {/* Hero Section */}
      <section className="section-y relative isolate overflow-hidden bg-ground">
        <Image
          src="/images/south-africa/gallery/sa-08.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Scrim: keeps the type legible without flattening the photograph. */}
        <div
          className="absolute inset-0 bg-ground/80 md:bg-gradient-to-r md:from-ground md:via-ground/85 md:to-ground/25"
          aria-hidden="true"
        />

        <div className="container-page relative">
          <div className="max-w-3xl">
            {/* Badge */}
            <p className="eyebrow text-white/60">
              SOUTH AFRICA ROADSHOW · THAT&apos;S A WRAP
            </p>

            <h1 className="text-display-sm mt-5 font-bold uppercase text-white">
              Blockf<span className="text-brand-blue-light">3</span>st Africa{" "}
              <span className="text-brand-gold">&apos;26</span>
              <span className="mt-2 block text-2xl text-white/90 sm:text-3xl">
                South Africa
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-2xl">
              {event.tagline}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {event.location.city}, {event.location.country}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {event.date.displayDate}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Gallery — the centerpiece */}
      <section className="section-y bg-paper border-t border-gray-200">
        <div className="container-page">
          <div className="mb-10 max-w-2xl lg:mb-14">
            <h2 className="text-display-sm font-bold text-gray-900">
              Cape Town, <span className="text-brand-blue">In Frames</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              From the conference floor to mountain-top meetups and street-level
              energy. A week of bringing Africa&apos;s Web3 community together in
              South Africa.
            </p>
          </div>

          {/* Masonry: larger frames, mixed orientation preserved */}
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 lg:gap-5 [column-fill:_balance]">
            {saGallery.map((photo, index) => (
              <div
                key={photo.src}
                className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-gray-200 bg-paper-muted lg:mb-5"
              >
                <Image
                  src={photo.src}
                  alt={`Blockfest Africa '26 South Africa roadshow, photo ${index + 1}`}
                  width={photo.width}
                  height={photo.height}
                  loading={index < 6 ? "eager" : "lazy"}
                  className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <EventHighlights title="Roadshow Highlights" highlights={event.highlights ?? []} />

      {/* CTA → Lagos */}
      <EventCta
        title="Next stop: Lagos"
        description={
          <>
            The roadshow was just the warm-up. Join us for the main event,{" "}
            <span className="font-semibold text-white">
              {blockfest2026Lagos.location.city},{" "}
              {blockfest2026Lagos.date.displayDate}
            </span>{" "}
            . {blockfest2026Lagos.tagline}.
          </>
        }
        ctaLabel="Explore Lagos '26"
        ctaHref="/"
      />
    </main>
  );
}
