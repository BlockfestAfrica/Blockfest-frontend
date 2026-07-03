import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Twitter,
  Linkedin,
  Globe,
  Youtube,
  MapPin,
  Building2,
  Calendar,
  Users,
} from "lucide-react";
import  { SpeakersList,type Speaker } from "@/lib/speakers";
import { gotham } from "@/lib/fonts";
import { generateSEO } from "@/lib/seo";
import { SpeakerSchema } from "@/components/seo/speakers-schema";
import { BreadcrumbSchema } from "@/components/seo/schema-markup";

// Generate static params for all speakers
export async function generateStaticParams() {
  return SpeakersList.map((speaker) => ({
    slug: speaker.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, ""),
  }));
}

// Generate metadata for each speaker
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const speaker = findSpeakerBySlug(slug);

  if (!speaker) {
    return generateSEO({
      title: "Speaker Not Found",
      description: "The speaker you are looking for does not exist.",
      url: `/speakers/${slug}`,
      noIndex: true,
    });
  }

  const speakerDescription = speaker.bio
    ? `${speaker.bio.substring(0, 150)}...`
    : `Meet ${speaker.name}, ${speaker.title} at Blockfest Africa 2025 - Africa's premier blockchain conference.`;

  const speakerKeywords = [
    speaker.name.toLowerCase().replace(/\s+/g, " "),
    `${speaker.name} blockchain`,
    `${speaker.name} web3`,
    `${speaker.name} crypto`,
    speaker.title.toLowerCase(),
    speaker.company ? speaker.company.toLowerCase() : "",
    "blockfest africa speaker",
    "blockchain conference speaker",
    "web3 expert africa",
    "crypto thought leader",
    "defi speaker",
    "blockchain pioneer",
    "web3 innovator",
    "african blockchain leader",
  ].filter(Boolean);

  return generateSEO({
    title: `${speaker.name} - ${speaker.title}`,
    description: speakerDescription,
    keywords: speakerKeywords,
    image: speaker.image,
    url: `/speakers/${slug}`,
    type: "article",
    author: speaker.name,
  });
}

function findSpeakerBySlug(slug: string): Speaker | undefined {
  return SpeakersList.find(
    (speaker) =>
      speaker.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") === slug
  );
}

function formatBio(bio: string) {
  return bio.split("\n\n").map((paragraph, index) => (
    <p key={index} className="mb-4 last:mb-0">
      {paragraph.split("\n").map((line, lineIndex, lineArray) => (
        <React.Fragment key={lineIndex}>
          {line
            .split("**")
            .map((part, partIndex) =>
              partIndex % 2 === 1 ? (
                <strong key={partIndex}>{part}</strong>
              ) : (
                part
              )
            )}
          {lineIndex < lineArray.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  ));
}

export default async function SpeakerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const speaker = findSpeakerBySlug(slug);

  if (!speaker) {
    notFound();
  }

  const socialLinks = [
    {
      platform: "Twitter",
      url: speaker.twitter,
      icon: Twitter,
      color: "bg-brand-blue hover:bg-brand-blue-dark",
    },
    {
      platform: "LinkedIn",
      url: speaker.linkedin,
      icon: Linkedin,
      color: "bg-brand-blue hover:bg-brand-blue-dark",
    },
    {
      platform: "YouTube",
      url: speaker.youtube,
      icon: Youtube,
      color: "bg-brand-blue hover:bg-brand-blue-dark",
    },
    {
      platform: "Website",
      url: speaker.website,
      icon: Globe,
      color: "bg-brand-blue hover:bg-brand-blue-dark",
    },
  ].filter((link) => link.url);

  return (
    <>
      {/* Hero Section */}
      <section
        className="relative min-h-[40vh] sm:min-h-[45vh] lg:min-h-[50vh] flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 overflow-hidden"
        aria-label={`${speaker.name} speaker profile`}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-brand-blue"/>
          <svg
            className="absolute inset-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="speaker-pattern"
                x="0"
                y="0"
                width="100"
                height="100"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="50" cy="50" r="2" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#speaker-pattern)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {/* Back Button */}
          <Link
            href="/speakers"
            className="inline-flex items-center gap-2 text-brand-blue hover:text-brand-blue-dark font-medium mb-4 sm:mb-6 transition-colors duration-200 group touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span className="text-sm sm:text-base">Back to Speakers</span>
          </Link>

          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 sm:gap-8 lg:gap-10">
            {/* Speaker Image */}
            <div className="relative flex-shrink-0">
              <div className="relative w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-80 lg:h-80 rounded-2xl lg:rounded-3xl overflow-hidden bg-white shadow-xl ring-2 sm:ring-4 ring-white/50">
                <Image
                  src={speaker.image}
                  alt={`${speaker.name} - ${speaker.title}`}
                  fill
                  className={`object-cover ${
                    speaker.imagePosition || "object-top"
                  }`}
                  priority
                  sizes="(min-width: 1024px) 320px, (min-width: 768px) 288px, (min-width: 640px) 240px, 192px"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                />
              </div>

              {/* Decorative Elements */}
              <div className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-16 h-16 sm:w-20 sm:h-20 bg-brand-blue rounded-full opacity-20 blur-xl"/>
              <div className="absolute -bottom-3 -left-3 sm:-bottom-4 sm:-left-4 w-20 h-20 sm:w-24 sm:h-24 bg-brand-blue-light rounded-full opacity-20 blur-xl"/>
            </div>

            {/* Speaker Info */}
            <div className="flex-1 text-center lg:text-left w-full max-w-2xl lg:max-w-none">
              <div className="mb-4 sm:mb-6">
                <h1
                  className={`${gotham.className} text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight px-2 sm:px-0`}
                >
                  {speaker.name}
                </h1>

                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 sm:px-6 py-3 sm:py-4 inline-block max-w-full">
                    <p
                      className={`${gotham.className} text-base sm:text-lg md:text-xl text-gray-800 font-semibold break-words`}
                    >
                      {speaker.title}
                    </p>
                  </div>

                  {speaker.company && (
                    <div className="flex items-center justify-center lg:justify-start gap-2 text-brand-blue flex-wrap px-2 sm:px-0">
                      <Building2 className="w-5 h-5 flex-shrink-0" />
                      <p className="text-base sm:text-lg font-semibold text-center lg:text-left break-words">
                        {speaker.company}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex flex-col gap-4 sm:gap-5 w-full px-2 sm:px-0">
                {/* Event Info Card */}
                <div className="bg-white/70 rounded-xl p-4 sm:p-5 border border-white/40 shadow-lg flex-1 w-full">
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-gray-600 mb-2 flex-wrap">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm sm:text-base font-medium text-center lg:text-left">
                      Speaking at Blockfest Africa 2025
                    </span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-gray-600 flex-wrap">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm sm:text-base text-center lg:text-left">
                      Lagos, Nigeria • October 11th, 2025
                    </span>
                  </div>
                </div>

                {/* Social Links */}
                {socialLinks.length > 0 && (
                  <div className="w-full">
                    <div className="flex items-center justify-center lg:justify-start gap-3 sm:gap-4 flex-wrap">
                      {socialLinks.map(
                        ({ platform, url, icon: Icon, color }) => (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white transition-all duration-300 hover:scale-110 hover:shadow-lg active:scale-95 ${color} focus:outline-none focus:ring-4 focus:ring-blue-500/50 touch-manipulation shadow-md`}
                            aria-label={`Follow ${speaker.name} on ${platform}`}
                          >
                            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                          </a>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Biography Section */}
      <section className="py-8 sm:py-10 lg:py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {speaker.bio ? (
            <>
              <div className="text-center mb-6 sm:mb-8">
                <h2
                  className={`${gotham.className} text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2`}
                >
                  About {speaker.name.split(" ")[0]}
                </h2>
                <div className="w-24 h-1 bg-brand-blue mx-auto rounded-full"/>
              </div>

              <article className="prose prose-lg max-w-none">
                <div className="text-gray-700 leading-relaxed text-base sm:text-lg space-y-6">
                  {formatBio(speaker.bio)}
                </div>
              </article>
            </>
          ) : (
            <div className="text-center py-12 sm:py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-brand-blue" />
              </div>
              <h2
                className={`${gotham.className} text-xl sm:text-2xl font-bold text-gray-900 mb-4`}
              >
                Biography Coming Soon
              </h2>
              <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                We&apos;re currently crafting a comprehensive biography for{" "}
                {speaker.name.split(" ")[0]}. Check back soon for their
                inspiring story and professional journey.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 sm:py-12 bg-gradient-to-r from-brand-blue to-brand-blue-deep">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className={`${gotham.className} text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4`}
          >
            Don&apos;t Miss Out
          </h2>
          <p className="text-white/80 text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            Join {speaker.name.split(" ")[0]} and other industry leaders at
            Blockfest Africa 2026. Secure your spot at Africa&apos;s premier
            blockchain conference.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-center items-center max-w-md mx-auto sm:max-w-none">
            <Link
              href="/#register"
              className="bg-brand-gold text-black px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl font-bold hover:bg-brand-gold-hover hover:shadow-lg transform hover:scale-105 transition-all duration-300 touch-manipulation text-base sm:text-lg w-full sm:w-auto text-center"
            >
              Register Now
            </Link>
            <Link
              href="/speakers"
              className="border-2 border-white text-white px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl font-bold hover:bg-white hover:text-brand-blue hover:shadow-lg transform hover:scale-105 transition-all duration-300 touch-manipulation text-base sm:text-lg w-full sm:w-auto text-center"
            >
              View All Speakers
            </Link>
          </div>
        </div>
      </section>

      {/* Structured Data */}
      <SpeakerSchema
        speaker={{
          name: speaker.name,
          jobTitle: speaker.title,
          description:
            speaker.bio ||
            `${speaker.title} at ${speaker.company || "Blockfest Africa 2025"}`,
          image: speaker.image,
          url: `/speakers/${slug}`,
          sameAs: [
            speaker.twitter,
            speaker.linkedin,
            speaker.website,
            speaker.youtube,
          ].filter(Boolean) as string[],
        }}
      />

      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Speakers", url: "/speakers" },
          { name: speaker.name, url: `/speakers/${slug}` },
        ]}
      />
    </>
  );
}
