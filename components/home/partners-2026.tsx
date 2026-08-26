// components/shared/partners-section.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";
import { partners, PartnerLogo } from "@/lib/partners-2026";
import { XBadge } from "../icons/xbadge";



function PartnerCard({ logo, twitter }: PartnerLogo) {
  const card = (
    <div className="group relative flex h-20 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/5 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D7A64B]/50 hover:bg-white/10 hover:shadow-[0_0_24px_-6px_rgba(215,166,75,0.35)] lg:h-24">
      <Image
        src={logo}
        alt="Partner logo"
        width={160}
        height={64}
        className="h-10 w-auto object-contain grayscale-[15%] transition-all duration-300 group-hover:grayscale-0 lg:h-14"
      />
      {twitter && <XBadge />}
    </div>
  );

  if (twitter) {
    return (
      <Link
        href={twitter}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7A64B]/60"
        aria-label="Partner logo"
      >
        {card}
      </Link>
    );
  }

  return card;
}

function HeadlineSpotlight({ headline }: { headline: PartnerLogo[] }) {
  if (headline.length === 0) return null;

  return (
    <div className="mb-14 lg:mb-20">
      <p className="eyebrow text-center text-white">
        HEADLINE{" "}
        <span className="text-brand-gold px-1 ">
          {headline.length === 1 ? "SPONSOR" : "SPONSORS"}
        </span>
      </p>
      <div className={`mt-4 grid gap-4 ${headline.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {headline.map((sponsor) => {
          const inner = (
            <div className="flex h-20 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/2 p-6 transition-colors duration-300 hover:bg-white/8 sm:h-32">
              <Image
                src={sponsor.logo}
                alt="Headline sponsor logo"
                width={800}
                height={220}
                className="h-full w-auto max-w-full object-contain"
                priority
              />
            </div>
          );

          return sponsor.twitter ? (
            <Link
              key={sponsor.logo}
              href={sponsor.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label="Headline sponsor logo"
            >
              {inner}
            </Link>
          ) : (
            <div key={sponsor.logo}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

function PartnerGroup({ label, items = [] }: { label: string; items?: PartnerLogo[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-12 lg:mb-16">
      <div className="mb-5 flex items-baseline justify-between lg:mb-6">
        <h3 className="text-xl font-bold text-white lg:text-2xl">{label}</h3>
        <span className="text-sm font-medium text-white/40">{items.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-4">
        {items.map((item) => (
          <PartnerCard key={item.logo} {...item} />
        ))}
      </div>
    </div>
  );
}

export function PartnersSection2026() {
  useSubtleAnimations();

  return (
    <section className="section-y bg-ground border-t border-white/20">
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-white/60">2026 PARTNERS</p>
          <h2 className="text-display-sm mt-3 font-bold text-white fade-in-on-scroll">
            Our Partners
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            The brands, communities, and media backing Blockfest Africa 2026
            from South Africa to Lagos this October.
          </p>
        </div>

        <HeadlineSpotlight headline={partners.headline} />

        <div className="scale-in">
          <PartnerGroup label="Community Partners" items={partners.community} />
          <PartnerGroup label="Media Partners" items={partners.media} />
          <PartnerGroup label="Ecosystem Partners" items={partners.ecosystem} />
        </div>

      </div>
    </section>
  );
}