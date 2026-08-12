import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  MapPin,
  Building2,
  Calendar,
  Users,
} from "lucide-react";
import { FaXTwitter, FaLinkedin, FaYoutube } from "react-icons/fa6";
import  { SpeakersList,type Speaker } from "@/lib/speakers";
import { Button } from "@/components/ui/button";
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

  const socialLinks: {
    platform: string;
    url?: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }[] = [
    {
      platform: "Twitter",
      url: speaker.twitter,
      icon: FaXTwitter,
    },
    {
      platform: "LinkedIn",
      url: speaker.linkedin,
      icon: FaLinkedin,
    },
    {
      platform: "YouTube",
      url: speaker.youtube,
      icon: FaYoutube,
    },
    {
      platform: "Website",
      url: speaker.website,
      icon: Globe,
    },
  ].filter((link) => link.url);

  return (
    <>
      <main id="main">
      {/* Hero Section */}
      <section
        className="section-y bg-paper"
        aria-label={`${speaker.name} speaker profile`}
      >
        <div className="container-page">
          {/* Back Button */}
          <Link
            href="/speakers"
            className="group inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-blue transition-colors duration-200 hover:text-brand-blue-dark touch-manipulation"
          >
            <ArrowLeft
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1"
              aria-hidden="true"
            />
            <span className="text-sm">Back to Speakers</span>
          </Link>

          <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:flex-row lg:items-start lg:gap-12">
            {/* Speaker Image */}
            <div className="shrink-0">
              <div className="relative h-48 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white sm:h-60 sm:w-60 md:h-72 md:w-72 lg:h-80 lg:w-80">
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
            </div>

            {/* Speaker Info */}
            <div className="w-full max-w-2xl lg:max-w-none">
              <h1
                className={`${gotham.className} text-display-sm font-bold text-gray-900`}
              >
                {speaker.name}
              </h1>

              <p
                className={`${gotham.className} mt-4 text-lg font-semibold text-gray-600`}
              >
                {speaker.title}
              </p>

              {speaker.company && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-base font-semibold text-brand-blue">
                  <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {speaker.company}
                </p>
              )}

              {/* Event Info Card */}
              <div className="mt-8 rounded-xl border border-gray-200 bg-paper-muted p-6">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-600">
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Speaking at Blockfest Africa 2025
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Lagos, Nigeria • October 11th, 2025
                </p>
              </div>

              {/* Social Links */}
              {socialLinks.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {socialLinks.map(({ platform, url, icon: Icon }) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-brand-blue hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 touch-manipulation"
                      aria-label={`Follow ${speaker.name} on ${platform}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Biography Section */}
      <section className="section-y bg-paper border-t border-gray-200">
        <div className="container-page">
          {speaker.bio ? (
            <>
              <div className="mb-10 max-w-2xl lg:mb-14">
                <h2
                  className={`${gotham.className} text-display-sm font-bold text-gray-900`}
                >
                  About {speaker.name.split(" ")[0]}
                </h2>
              </div>

              <article className="max-w-3xl">
                <div className="space-y-6 text-base leading-relaxed text-gray-600">
                  {formatBio(speaker.bio)}
                </div>
              </article>
            </>
          ) : (
            <div className="max-w-2xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2
                className={`${gotham.className} mt-4 text-2xl font-bold text-gray-900`}
              >
                Biography Coming Soon
              </h2>
              <p className="mt-3 text-base leading-relaxed text-gray-600">
                We&apos;re currently crafting a comprehensive biography for{" "}
                {speaker.name.split(" ")[0]}. Check back soon for their
                inspiring story and professional journey.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-y bg-ground">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2
              className={`${gotham.className} text-display-sm font-bold text-white`}
            >
              Don&apos;t Miss Out
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              Join {speaker.name.split(" ")[0]} and other industry leaders in Lagos,
              October 22&ndash;24, 2026.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button
                asChild
                variant="gold"
                className="rounded-full px-7 text-base font-semibold"
              >
                <Link href="/tickets">
                  Get Tickets
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                className="rounded-full border border-white/20 bg-white/10 px-7 text-base font-semibold text-white hover:bg-white/20"
              >
                <Link href="/speakers">View All Speakers</Link>
              </Button>
            </div>
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
      </main>
    </>
  );
}
