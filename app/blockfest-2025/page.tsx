import React from "react";
import { ArrowRight, Calendar, Globe, MapPin, Mic, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { blockfest2025Lagos } from "@/lib/events";
import { SpeakersList } from "@/lib/speakers";
import { EventHighlights } from "@/components/shared/event-highlights";
import { EventCta } from "@/components/shared/event-cta";
import { FaInstagram, FaTiktok, FaXTwitter, FaYoutube } from "react-icons/fa6";

export const metadata: Metadata = {
  title: "Blockfest Africa 2025 - Event Recap",
  description:
    "Relive the magic of Blockfest Africa 2025 - Africa's biggest Web3 festival. 12,000+ attendees, 20+ speakers, 54+ countries represented. View photos, stats, and highlights.",
  keywords: [
    "blockfest africa 2025",
    "blockchain conference africa",
    "web3 africa 2025",
    "cryptocurrency conference nigeria",
    "defi conference lagos",
    "blockfest recap",
    "web3 event highlights",
  ],
  openGraph: {
    title: "Blockfest Africa 2025 - Event Recap",
    description:
      "Relive the magic of Blockfest Africa 2025 - 12,000+ attendees, 20+ speakers, 54+ countries represented.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Blockfest Africa 2025 Recap",
      },
    ],
  },
  alternates: {
    canonical: "https://blockfestafrica.com/blockfest-2025",
  },
};

const event = blockfest2025Lagos;
const stats = event.stats ?? {
  totalRegistrations: 0,
  totalAttendees: 0,
  speakers: 0,
  countriesRepresented: 0,
  physicalAttendees: 0,
  virtualAttendees: 0,
};

// Select featured speakers for display
const featuredSpeakers = SpeakersList.slice(0, 8);

export default function Blockfest2025Page() {
  return (
    <main id="main" className="min-h-screen bg-paper">
      {/* Hero Section */}
      <section className="section-y relative isolate overflow-hidden bg-ground">
        <Image
          src="/images/home/img1.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%]"
        />
        {/* Scrim: keeps the type legible without flattening the photograph. */}
        <div
          className="absolute inset-0 bg-ground/80 md:bg-gradient-to-r md:from-ground md:via-ground/85 md:to-ground/25"
          aria-hidden="true"
        />

        <div className="container-page relative">
          <div className="max-w-3xl">
            {/* Badge */}
            <p className="eyebrow text-white/60">COMPLETED EVENT</p>

            <h1 className="text-display-sm mt-5 font-bold uppercase text-white">
              Blockfest Africa <span className="text-white">2025</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-2xl">
              {event.theme}
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

            <p className="mt-8 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-5 py-2 text-base font-semibold text-white/90">
              {event.tagline}
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-y bg-ground border-t border-white/20">
        <div className="container-page">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-bold text-white">
                {stats.totalRegistrations?.toLocaleString()}+
              </p>
              <p className="mt-1 text-sm text-white/60">Total Registrations</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-bold text-white">
                {stats.totalAttendees?.toLocaleString()}+
              </p>
              <p className="mt-1 text-sm text-white/60">Total Attendees</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                <Mic className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-bold text-white">
                {stats.speakers}+
              </p>
              <p className="mt-1 text-sm text-white/60">Speakers</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/15 text-brand-blue-light">
                <Globe className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-bold text-white">
                {stats.countriesRepresented}+
              </p>
              <p className="mt-1 text-sm text-white/60">Countries</p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="section-y bg-paper-muted border-t border-gray-200">
        <div className="container-page">
          <div className="mb-10 max-w-2xl lg:mb-14">
            <h2 className="text-display-sm font-bold text-gray-900">
              The BIG <span className="text-brand-blue">Impact</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              Blockfest Africa 2025 made waves across the continent and beyond
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 transition-colors duration-300 hover:border-brand-blue">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <FaXTwitter className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-bold text-gray-900">2.2M+</p>
              <p className="mt-1 text-sm text-gray-600">
                Twitter (X) Impressions
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 transition-colors duration-300 hover:border-brand-blue">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <FaTiktok className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-bold text-gray-900">400K+</p>
              <p className="mt-1 text-sm text-gray-600">TikTok Impressions</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 transition-colors duration-300 hover:border-brand-blue">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <FaInstagram className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-bold text-gray-900">100K+</p>
              <p className="mt-1 text-sm text-gray-600">Instagram Impressions</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 transition-colors duration-300 hover:border-brand-blue">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <FaYoutube className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-3xl font-bold text-gray-900">7.2K+</p>
              <p className="mt-1 text-sm text-gray-600">
                YouTube Livestream Viewers
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Attendance Breakdown */}
      <section className="section-y bg-paper border-t border-gray-200">
        <div className="container-page">
          <div className="mb-10 max-w-2xl lg:mb-14">
            <h2 className="text-display-sm font-bold text-gray-900">
              Attendance <span className="text-brand-blue">Breakdown</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-paper-muted p-6 transition-colors duration-300 hover:border-brand-blue">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-5xl font-bold text-gray-900">
                {stats.physicalAttendees?.toLocaleString()}+
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                Physical Attendees
              </p>
              <p className="mt-1 text-sm text-gray-600">
                On-ground at Lagos, Nigeria
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-paper-muted p-6 transition-colors duration-300 hover:border-brand-blue">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <Globe className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-5xl font-bold text-gray-900">
                {stats.virtualAttendees?.toLocaleString()}
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                Virtual Attendees
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Joined from across the globe
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Speakers */}
      <section className="section-y bg-paper-muted border-t border-gray-200">
        <div className="container-page">
          <div className="mb-10 max-w-2xl lg:mb-14">
            <h2 className="text-display-sm font-bold text-gray-900">
              Our <span className="text-brand-blue">Speakers</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              We gathered some of the brightest minds in Web3 in Africa under one
              roof
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {featuredSpeakers.map((speaker) => (
              <div
                key={speaker.name}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors duration-300 hover:border-brand-blue"
              >
                <div className="relative h-48 lg:h-56">
                  <Image
                    src={speaker.image}
                    alt={speaker.name}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-1 text-sm font-bold text-gray-900 lg:text-base">
                    {speaker.name}
                  </h3>
                  <p className="line-clamp-2 text-xs text-gray-600 lg:text-sm">
                    {speaker.title}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/speakers"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-base font-semibold text-white transition-colors duration-300 hover:bg-brand-blue-dark"
            >
              View All Speakers
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Photo Gallery */}
      <section className="section-y bg-paper border-t border-gray-200">
        <div className="container-page">
          <div className="mb-10 max-w-2xl lg:mb-14">
            <h2 className="text-display-sm font-bold text-gray-900">
              Event <span className="text-brand-blue">Gallery</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              Relive the memorable moments from Blockfest Africa 2025
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {[
              "/images/home/img1.jpg",
              "/images/home/img2.jpg",
              "/images/home/img3.jpg",
              "/images/home/img4.jpg",
              "/images/home/img5.jpg",
              "/images/home/img6.jpg",
            ].map((img, index) => (
              <div
                key={img}
                className="relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-200 bg-paper-muted"
              >
                <Image
                  src={img}
                  alt={`Blockfest Africa 2025 gallery image ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="https://drive.google.com/drive/folders/1qazNDRl38iq26pQP5YPsM1H8x9u1FcN7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-base font-semibold text-white transition-colors duration-300 hover:bg-brand-blue-dark"
            >
              Main Event Photos
            </a>
            <a
              href="https://drive.google.com/drive/folders/1QcTYo1xr6h8A6HHQvU0gwxbyL_BoWBSE"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-colors duration-300 hover:border-brand-blue"
            >
              Mixer & Networking Event
            </a>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <EventHighlights title="Event Highlights" highlights={event.highlights ?? []} />

      {/* CTA Section */}
      <EventCta
        title="Don't Miss 2026!"
        description="The South Africa roadshow is a wrap. Lagos is next, October 22–24. Be part of it."
        ctaLabel="Explore Lagos '26"
        ctaHref="/"
      />
    </main>
  );
}
