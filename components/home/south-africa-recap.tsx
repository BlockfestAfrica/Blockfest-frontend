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
    <section className="section-y bg-paper border-t border-gray-200">
      <div className="container-page">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Copy */}
          <div>
            <p className="eyebrow text-brand-blue">
              SOUTH AFRICA · THAT&apos;S A WRAP
            </p>
            <h2 className="text-display-sm mt-3 font-bold text-gray-900">
              We took it to <span className="text-brand-blue">Cape Town</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">
              {event.date.displayDate}. A week of builder meetups, sessions and
              experiences that brought Africa&apos;s Web3 community together
              across South Africa. The roadshow set the stage for the main event
              in Lagos.
            </p>
            <Link
              href="/blockfest-south-africa-2026"
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-blue-dark"
            >
              View the South Africa recap
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {/* Photo teaser */}
          <div className="grid grid-cols-2 gap-4">
            {teaser.map((img, index) => (
              <div
                key={img}
                className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-paper-muted"
              >
                <Image
                  src={img}
                  alt={`Blockfest Africa South Africa roadshow ${index + 1}`}
                  fill
                  loading="lazy"
                  className="object-cover transition-transform duration-500 hover:scale-105"
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
