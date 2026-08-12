import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { blockfest2026SouthAfrica } from "@/lib/events";

// A small teaser of the freshest roadshow frames for the homepage.
const teaser = [
  "/images/south-africa/gallery/sa-20.webp",
  "/images/south-africa/gallery/sa-08.webp",
  "/images/south-africa/gallery/sa-36.webp",
  "/images/south-africa/gallery/sa-05.webp",
];

export function SouthAfricaRecapSection() {
  const event = blockfest2026SouthAfrica;

  return (
    <section className="py-12 lg:py-16 bg-paper">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Copy */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue mb-5">
            SOUTH AFRICA · THAT&apos;S A WRAP
          </p>
            <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4">
              We took it to{" "}
              <span className="text-brand-blue">Cape Town</span>
            </h2>
            <p className="text-gray-600 text-base lg:text-lg mb-6 max-w-xl">
              {event.date.displayDate}. A week of builder meetups, sessions and
              experiences that brought Africa&apos;s Web3 community together
              across South Africa. The roadshow set the stage for the main event
              in Lagos.
            </p>
            <Link
              href="/blockfest-south-africa-2026"
              className="inline-flex items-center gap-2 bg-brand-blue text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue-pressed transition-colors"
            >
              View the South Africa recap
              <ArrowRight />
            </Link>
          </div>

          {/* Photo teaser */}
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            {teaser.map((img, index) => (
              <div
                key={img}
                className="relative aspect-square rounded-xl overflow-hidden bg-gray-100"
              >
                <Image
                  src={img}
                  alt={`Blockfest Africa South Africa roadshow ${index + 1}`}
                  fill
                  loading="lazy"
                  className="object-cover hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
