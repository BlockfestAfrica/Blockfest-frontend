"use client";

import Link from "next/link";
import Image from "next/image";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";
import {
  partners,
  type OfficialPartner,
  type PartnerLogo,
} from "@/lib/partners-2026";

/*
 * Each tier is drawn a clear step smaller than the one above it: the plate,
 * the logo inside it, and the share of the column it takes.
 *
 * Widths are fractions of one shared column, not fixed sizes, so a tier with
 * several sponsors fills an even row and every tier spans the same column.
 *
 * Gap is 1rem, so n to a row is calc(100%/n - (n-1)rem/n).
 */
const TIER = {
  headline: {
    item: "w-full max-w-3xl md:[&:not(:only-child)]:w-[calc(50%-0.5rem)]",
    plate:
      "h-28 md:h-40 lg:h-44 rounded-2xl ring-1 ring-brand-gold/50 shadow-[0_0_56px_-16px_rgba(242,203,69,0.45)]",
    logo: "h-14 md:h-20 lg:h-24",
    sizes:
      "(min-width: 1024px) 720px, (min-width: 768px) calc(100vw - 80px), 80vw",
  },

  gold: {
    item:
      "w-[85%] md:w-[calc(50%-0.5rem)] lg:[&:not(:only-child)]:w-[calc(33.333%-0.667rem)]",
    plate: "h-24 md:h-32 rounded-2xl ring-1 ring-[#D7A64B]/40",
    logo: "h-12 md:h-16",
    sizes: "(min-width: 768px) 440px, 85vw",
  },

  silver: {
    item:
      "w-[calc(50%-0.5rem)] only:w-[70%] md:w-[calc(33.333%-0.667rem)] md:only:w-[calc(33.333%-0.667rem)]",
    plate: "h-20 md:h-28 rounded-2xl",
    logo: "h-10 md:h-14",
    sizes: "(min-width: 768px) 300px, 70vw",
  },

  bronze: {
    item: "w-[calc(50%-0.5rem)] md:w-[calc(25%-0.75rem)]",
    plate: "h-16 md:h-24 rounded-xl",
    logo: "h-8 md:h-11",
    sizes: "(min-width: 768px) 220px, 45vw",
  },

  official: {
    item:
      "w-[calc(50%-0.5rem)] md:w-[calc(25%-0.75rem)] lg:w-[calc(20%-0.8rem)]",
    plate: "h-14 md:h-20 rounded-xl",
    logo: "h-7 md:h-10",
    sizes: "(min-width: 768px) 180px, 45vw",
  },

  community: {
    item: "w-[calc(50%-0.375rem)] md:w-[calc(25%-0.5625rem)]",
    plate: "h-12 md:h-16 rounded-xl",
    logo: "h-8 md:h-10 scale-100 md:scale-[1.2]",
    sizes: "(min-width: 768px) 220px, 45vw",
  },
} as const;

type TierName = keyof typeof TIER;

/** A tier's name between two rules, so the step from one tier to the next reads. */
function TierLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <div className="flex w-full items-center gap-4">
      <span className="h-px flex-1 bg-line-2" aria-hidden="true" />

      <h3 className={`eyebrow shrink-0 text-center ${className}`}>
        {children}
      </h3>

      <span className="h-px flex-1 bg-line-2" aria-hidden="true" />
    </div>
  );
}

/** A logo on a white plate, at its tier's size, linking out where there is a link. */
function SponsorPlate({
  sponsor,
  tier,
}: {
  sponsor: PartnerLogo;
  tier: TierName;
}) {
  const size = TIER[tier];

  const plate = (
    <div
      className={`flex w-full items-center justify-center bg-white px-6 transition-opacity duration-300 hover:opacity-90 ${size.plate}`}
    >
      <Image
        src={sponsor.logo}
        alt={sponsor.name}
        width={800}
        height={240}
        sizes={size.sizes}
        className={`w-auto max-w-full object-contain ${size.logo}`}
      />
    </div>
  );

  if (!sponsor.twitter) return plate;

  return (
    <Link
      href={sponsor.twitter}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
    >
      {plate}

      <span className="sr-only"> on X (opens in a new tab)</span>
    </Link>
  );
}

function Tier({
  tier,
  label,
  labelClassName,
  sponsors = [],
}: {
  tier: Exclude<TierName, "official" | "community">;
  label: string;
  labelClassName: string;
  sponsors?: PartnerLogo[];
}) {
  if (sponsors.length === 0) return null;

  return (
    <div className="flex w-full flex-col items-center gap-6 md:gap-8">
      <TierLabel className={labelClassName}>
        {label} {sponsors.length === 1 ? "Sponsor" : "Sponsors"}
      </TierLabel>

      <ul className="flex w-full flex-wrap justify-center gap-4">
        {sponsors.map((sponsor) => (
          <li key={sponsor.logo} className={TIER[tier].item}>
            <SponsorPlate sponsor={sponsor} tier={tier} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Official sponsors.
 *
 * One sponsor is labelled by its specific role.
 * Several sponsors share "Official Sponsors", with each role underneath.
 */
function OfficialTier({
  partners: official = [],
}: {
  partners?: OfficialPartner[];
}) {
  if (official.length === 0) return null;

  const single = official.length === 1;

  return (
    <div className="flex w-full flex-col items-center gap-6 md:gap-8">
      <TierLabel className="text-ink-3">
        {single ? `${official[0].role} Sponsor` : "Official Sponsors"}
      </TierLabel>

      <ul className="flex w-full flex-wrap justify-center gap-4">
        {official.map((partner) => (
          <li
            key={partner.logo}
            className={`${TIER.official.item} flex flex-col items-center gap-2`}
          >
            <SponsorPlate sponsor={partner} tier="official" />

            {!single && (
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-ink-3">
                {partner.role}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Community, media and ecosystem partners.
 *
 * These remain the smallest tier while still having larger, more visible
 * logos inside their plates.
 */
function PartnerGroup({
  label,
  items = [],
}: {
  label: string;
  items?: PartnerLogo[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex w-full flex-col items-center gap-6 md:gap-8">
      <TierLabel className="text-ink-3">{label}</TierLabel>

      <ul className="flex w-full flex-wrap justify-center gap-4">
        {items.map((item) => (
          <li key={item.logo} className={TIER.community.item}>
            <SponsorPlate sponsor={item} tier="community" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PartnersSection2026() {
  useSubtleAnimations();

  return (
    <section className="section-y border-t border-line-2 bg-ground">
      <div className="container-page flex flex-col items-center">
        <div className="mb-12 flex w-full flex-col items-center text-center lg:mb-16">
          <p className="eyebrow text-ink-3">2026 PARTNERS</p>

          <h2 className="text-display-sm mt-3 font-bold text-white fade-in-on-scroll">
            Our Partners
          </h2>

          <p className="mt-4 w-full max-w-xl text-base leading-relaxed text-ink-3">
            The brands, communities, and media backing Blockfest Africa 2026
            from South Africa to Lagos this October.
          </p>
        </div>

        <div className="flex w-full max-w-4xl flex-col items-center gap-12 md:gap-16">
          <Tier
            tier="headline"
            label="Headline"
            labelClassName="text-brand-gold"
            sponsors={partners.headline}
          />

          <Tier
            tier="gold"
            label="Gold"
            labelClassName="text-[#D7A64B]"
            sponsors={partners.gold}
          />

          <Tier
            tier="silver"
            label="Silver"
            labelClassName="text-ink-2"
            sponsors={partners.silver}
          />

          <Tier
            tier="bronze"
            label="Bronze"
            labelClassName="text-ink-3"
            sponsors={partners.bronze}
          />

          <OfficialTier partners={partners.official} />

          <PartnerGroup
            label="Community Partners"
            items={partners.community}
          />

          <PartnerGroup label="Media Partners" items={partners.media} />

          <PartnerGroup
            label="Ecosystem Partners"
            items={partners.ecosystem}
          />
        </div>
      </div>
    </section>
  );
}