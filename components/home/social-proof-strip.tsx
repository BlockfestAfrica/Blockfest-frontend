"use client";
import Image from "next/image";

const photos = [
  { src: "/images/home/img1.jpg", alt: "Blockfest Africa 2025 crowd" },
  { src: "/images/home/img2.jpg", alt: "Blockfest Africa 2025 networking" },
  { src: "/images/home/img8.jpg", alt: "Blockfest Africa 2025 stage" },
  { src: "/images/home/img4.jpg", alt: "Blockfest Africa 2025 speakers" },
  { src: "/images/home/img9.jpg", alt: "Blockfest Africa 2025 connections" },
  { src: "/images/home/img3.jpg", alt: "Blockfest Africa 2025 builders" },
];

export function SocialProofStrip() {
  return (
    <section className="relative w-full overflow-hidden bg-black">
      <div className="grid grid-cols-3 md:grid-cols-6">
        {photos.map((photo) => (
          <div
            key={photo.src}
            className="relative aspect-square overflow-hidden"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 768px) 33vw, 16.67vw"
              loading="lazy"
              className="object-cover object-center hover:scale-105 transition-transform duration-500"
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
        <p className="text-white/70 text-xs sm:text-sm font-medium tracking-wider uppercase">
          12,000+ attendees across 54 countries in 2025
        </p>
      </div>
    </section>
  );
}
