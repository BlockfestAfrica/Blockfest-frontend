import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { blockfest2025Lagos } from "@/lib/events";
import { SpeakersList } from "@/lib/speakers";
import { EventHighlights } from "@/components/shared/event-highlights";
import { EventCta } from "@/components/shared/event-cta";
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUsers,
  FaGlobe,
  FaMicrophone,
  FaTwitter,
  FaTiktok,
  FaInstagram,
  FaYoutube,
  FaArrowRight,
} from "react-icons/fa";

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
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand-blue via-brand-blue-dark to-brand-blue-deep text-white py-12 lg:py-16">
        <div className="absolute inset-0 bg-[url('/images/home/img1.jpg')] bg-cover bg-center opacity-10" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 lg:px-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-6 border border-white/10">
            <span className="text-white font-semibold text-sm">
              COMPLETED EVENT
            </span>
          </div>

          <h1 className="text-4xl lg:text-6xl xl:text-7xl font-bold mb-4">
            Blockfest Africa <span className="text-white">2025</span>
          </h1>

          <p className="text-xl lg:text-2xl text-white/90 max-w-3xl mb-6">
            {event.theme}
          </p>

          <div className="flex flex-wrap gap-4 text-white/80 text-lg mb-8">
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

          <p className="text-2xl lg:text-3xl font-semibold text-white/90">
            {event.tagline}
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-brand-blue to-brand-blue-deep py-12 lg:py-16">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            <div className="text-center text-white">
              <div className="flex items-center justify-center mb-2">
                <FaUsers className="text-white/60 text-2xl" />
              </div>
              <p className="text-3xl lg:text-5xl font-bold">
                {stats.totalRegistrations?.toLocaleString()}+
              </p>
              <p className="text-white/80">Total Registrations</p>
            </div>
            <div className="text-center text-white">
              <div className="flex items-center justify-center mb-2">
                <FaUsers className="text-white/60 text-2xl" />
              </div>
              <p className="text-3xl lg:text-5xl font-bold">
                {stats.totalAttendees?.toLocaleString()}+
              </p>
              <p className="text-white/80">Total Attendees</p>
            </div>
            <div className="text-center text-white">
              <div className="flex items-center justify-center mb-2">
                <FaMicrophone className="text-white/60 text-2xl" />
              </div>
              <p className="text-3xl lg:text-5xl font-bold">
                {stats.speakers}+
              </p>
              <p className="text-white/80">Speakers</p>
            </div>
            <div className="text-center text-white">
              <div className="flex items-center justify-center mb-2">
                <FaGlobe className="text-white/60 text-2xl" />
              </div>
              <p className="text-3xl lg:text-5xl font-bold">
                {stats.countriesRepresented}+
              </p>
              <p className="text-white/80">Countries</p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="py-12 lg:py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-4 text-gray-900">
            The BIG <span className="text-brand-blue">Impact</span>
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 lg:mb-10">
            Blockfest Africa 2025 made waves across the continent and beyond
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg text-center hover:shadow-xl transition-shadow">
              <FaTwitter className="text-[#1DA1F2] text-4xl mx-auto mb-4" />
              <p className="text-3xl lg:text-4xl font-bold text-gray-900">
                2.2M+
              </p>
              <p className="text-gray-600">Twitter (X) Impressions</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg text-center hover:shadow-xl transition-shadow">
              <FaTiktok className="text-black text-4xl mx-auto mb-4" />
              <p className="text-3xl lg:text-4xl font-bold text-gray-900">
                400K+
              </p>
              <p className="text-gray-600">TikTok Impressions</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg text-center hover:shadow-xl transition-shadow">
              <FaInstagram className="text-[#E4405F] text-4xl mx-auto mb-4" />
              <p className="text-3xl lg:text-4xl font-bold text-gray-900">
                100K+
              </p>
              <p className="text-gray-600">Instagram Impressions</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg text-center hover:shadow-xl transition-shadow">
              <FaYoutube className="text-[#FF0000] text-4xl mx-auto mb-4" />
              <p className="text-3xl lg:text-4xl font-bold text-gray-900">
                7.2K+
              </p>
              <p className="text-gray-600">YouTube Livestream Viewers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Attendance Breakdown */}
      <section className="py-12 lg:py-16">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-8 lg:mb-10 text-gray-900">
            Attendance <span className="text-brand-blue">Breakdown</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-brand-blue to-brand-blue-light rounded-3xl p-8 text-white text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaUsers className="text-4xl" />
              </div>
              <p className="text-5xl lg:text-6xl font-bold mb-2">
                {stats.physicalAttendees?.toLocaleString()}+
              </p>
              <p className="text-xl text-white/90">Physical Attendees</p>
              <p className="text-white/70 mt-2">On-ground at Lagos, Nigeria</p>
            </div>
            <div className="bg-gradient-to-br from-brand-blue-deep to-brand-blue-dark rounded-3xl p-8 text-white text-center">
              <div className="w-20 h-20 bg-white/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaGlobe className="text-4xl" />
              </div>
              <p className="text-5xl lg:text-6xl font-bold mb-2">
                {stats.virtualAttendees?.toLocaleString()}
              </p>
              <p className="text-xl text-white/90">Virtual Attendees</p>
              <p className="text-white/70 mt-2">Joined from across the globe</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Speakers */}
      <section className="py-12 lg:py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-4 text-gray-900">
            Our <span className="text-brand-blue">Speakers</span>
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 lg:mb-10">
            We gathered some of the brightest minds in Web3 in Africa under one
            roof
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {featuredSpeakers.map((speaker) => (
              <div
                key={speaker.name}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
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
                  <h3 className="font-bold text-gray-900 text-sm lg:text-base line-clamp-1">
                    {speaker.name}
                  </h3>
                  <p className="text-gray-600 text-xs lg:text-sm line-clamp-2">
                    {speaker.title}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/speakers"
              className="inline-flex items-center gap-2 bg-brand-blue text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue-pressed transition-colors"
            >
              View All Speakers
              <FaArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Photo Gallery */}
      <section className="py-12 lg:py-16">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-4 text-gray-900">
            Event <span className="text-brand-blue">Gallery</span>
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 lg:mb-10">
            Relive the memorable moments from Blockfest Africa 2025
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                className="relative aspect-[4/3] rounded-2xl overflow-hidden"
              >
                <Image
                  src={img}
                  alt={`Blockfest Africa 2025 gallery image ${index + 1}`}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <a
              href="https://drive.google.com/drive/folders/1qazNDRl38iq26pQP5YPsM1H8x9u1FcN7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-brand-blue text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue-pressed transition-colors"
            >
              📸 Main Event Photos
            </a>
            <a
              href="https://drive.google.com/drive/folders/1QcTYo1xr6h8A6HHQvU0gwxbyL_BoWBSE"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-brand-gold text-gray-900 px-6 py-3 rounded-full font-semibold hover:bg-brand-gold-hover transition-colors"
            >
              🎉 Mixer & Networking Event
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
