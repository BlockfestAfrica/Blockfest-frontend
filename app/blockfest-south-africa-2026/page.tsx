import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { blockfest2026SouthAfrica, blockfest2026Lagos } from "@/lib/events";
import { saGallery } from "@/lib/sa-gallery";
import { EventHighlights } from "@/components/shared/event-highlights";
import { EventCta } from "@/components/shared/event-cta";
import { FaCalendarAlt, FaMapMarkerAlt } from "react-icons/fa";

export const metadata: Metadata = {
  title: "Blockfest Africa '26 South Africa - Cape Town Roadshow Recap",
  description:
    "That's a wrap on Blockf3st Africa '26 in South Africa! Relive the Cape Town roadshow — builder meetups, sessions and experiences that brought Africa's Web3 community together ahead of Lagos.",
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
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand-blue via-brand-blue-dark to-brand-blue-deep text-white py-14 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/south-africa/gallery/sa-08.webp')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-blue-deep/90 to-transparent" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 lg:px-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-6 border border-white/10">
            <span className="text-lg">🇿🇦</span>
            <span className="text-white font-semibold text-sm tracking-wide">
              SOUTH AFRICA ROADSHOW · THAT&apos;S A WRAP
            </span>
          </div>

          <h1 className="text-4xl lg:text-6xl xl:text-7xl font-bold mb-4">
            Blockf<span className="text-brand-gold">3</span>st Africa{" "}
            <span className="text-white">&apos;26</span>
            <span className="block text-2xl lg:text-4xl xl:text-5xl text-white/90 mt-2">
              South Africa
            </span>
          </h1>

          <p className="text-xl lg:text-2xl text-white/90 max-w-3xl mb-6">
            {event.tagline}
          </p>

          <div className="flex flex-wrap gap-4 text-white/80 text-lg">
            <div className="flex items-center gap-2">
              <FaMapMarkerAlt className="text-white/60" />
              <span>
                {event.location.city}, {event.location.country}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="text-white/60" />
              <span>{event.date.displayDate}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Gallery — the centerpiece */}
      <section className="py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-4 text-gray-900">
            Cape Town, <span className="text-brand-blue">In Frames</span>
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 lg:mb-12">
            From the conference floor to mountain-top meetups and street-level
            energy — a week of bringing Africa&apos;s Web3 community together in
            South Africa.
          </p>

          {/* Masonry: larger frames, mixed orientation preserved */}
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 lg:gap-5 [column-fill:_balance]">
            {saGallery.map((photo, index) => (
              <div
                key={photo.src}
                className="mb-4 lg:mb-5 break-inside-avoid overflow-hidden rounded-2xl bg-gray-100 group"
              >
                <Image
                  src={photo.src}
                  alt={`Blockfest Africa '26 South Africa roadshow — photo ${index + 1}`}
                  width={photo.width}
                  height={photo.height}
                  loading={index < 6 ? "eager" : "lazy"}
                  className="w-full h-auto group-hover:scale-[1.03] transition-transform duration-500"
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
        flag="🇳🇬"
        title="Next stop: Lagos"
        description={
          <>
            The roadshow was just the warm-up. Join us for the main event —{" "}
            <span className="font-semibold text-white">
              {blockfest2026Lagos.location.city},{" "}
              {blockfest2026Lagos.date.displayDate}
            </span>{" "}
            — {blockfest2026Lagos.tagline}.
          </>
        }
        ctaLabel="Explore Lagos '26"
        ctaHref="/"
      />
    </main>
  );
}
