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
import { XBadge } from "../icons/xbadge";

/*
 * Each tier is drawn a clear step smaller than the one above it: the plate,
 * the logo inside it, and the share of the column it takes. Headline, silver
 * and mobility used to sit in near-identical white boxes stacked down the
 * middle, so the one sponsor paying for the headline read the same as the
 * rest.
 *
 * Widths are fractions of one shared column, not fixed sizes, so a tier with
 * several sponsors fills an even row (two gold, three silver, four bronze,
 * five official to a row on a laptop) and every tier spans the same column.
 * Fixed widths wrapped differently per tier: three gold stacked into a narrow
 * column on a tablet while silver below spread wider, which reads as
 * scattered. A lone sponsor keeps its tier's share, centred, so one gold is
 * still wider than one silver.
 *
 * Gap is 1rem, so n to a row is calc(100%/n - (n-1)rem/n).
 */
const TIER = {
  headline: {
    item: "w-full max-w-3xl md:[&:not(:only-child)]:w-[calc(50%-0.5rem)]",
    plate: "h-28 sm:h-40 lg:h-44 rounded-2xl ring-1 ring-brand-gold/50 shadow-[0_0_56px_-16px_rgba(242,203,69,0.45)]",
    logo: "h-14 sm:h-20 lg:h-24",
    sizes: "(min-width: 1024px) 720px, (min-width: 640px) calc(100vw - 80px), 80vw",
  },
  gold: {
    item: "w-[85%] sm:w-[calc(50%-0.5rem)] lg:[&:not(:only-child)]:w-[calc(33.333%-0.667rem)]",
    plate: "h-24 sm:h-32 rounded-2xl ring-1 ring-[#D7A64B]/40",
    logo: "h-12 sm:h-16",
    sizes: "(min-width: 640px) 440px, 85vw",
  },
  silver: {
    item: "w-[calc(50%-0.5rem)] only:w-[70%] sm:w-[calc(33.333%-0.667rem)] sm:only:w-[calc(33.333%-0.667rem)]",
    plate: "h-20 sm:h-28 rounded-2xl",
    logo: "h-10 sm:h-14",
    sizes: "(min-width: 640px) 300px, 70vw",
  },
  bronze: {
    item: "w-[calc(50%-0.5rem)] sm:w-[calc(25%-0.75rem)]",
    plate: "h-16 sm:h-24 rounded-xl",
    logo: "h-8 sm:h-11",
    sizes: "(min-width: 640px) 220px, 45vw",
  },
  official: {
    item: "w-[calc(50%-0.5rem)] sm:w-[calc(25%-0.75rem)] lg:w-[calc(20%-0.8rem)]",
    plate: "h-14 sm:h-20 rounded-xl",
    logo: "h-7 sm:h-10",
    sizes: "(min-width: 640px) 180px, 45vw",
  },
} as const;

type TierName = keyof typeof TIER;

/** A tier's name between two rules, so the step from one tier to the next reads. */
function TierLabel({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div className="flex w-full items-center gap-4">
      <span className="h-px flex-1 bg-line-2" aria-hidden="true" />
      <h3 className={`eyebrow shrink-0 text-center ${className}`}>{children}</h3>
      <span className="h-px flex-1 bg-line-2" aria-hidden="true" />
    </div>
  );
}

/** A logo on a white plate, at its tier's size, linking out where there is a link. */
function SponsorPlate({ sponsor, tier }: { sponsor: PartnerLogo; tier: TierName }) {
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
        // Not priority, headline included: this section sits far below the
        // fold, and a preload here competes with the hero for the first paint.
      />
    </div>
  );

  if (!sponsor.twitter) return plate;
  return (
    <Link
      href={sponsor.twitter}
      target="_blank"
      rel="noopener noreferrer"
      // w-full so a linked plate fills its slot exactly as an unlinked one
      // does; without it the link shrank to the logo inside a column flex.
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
  tier: Exclude<TierName, "official">;
  label: string;
  labelClassName: string;
  sponsors?: PartnerLogo[];
}) {
  if (sponsors.length === 0) return null;
  return (
    <div className="flex w-full flex-col items-center gap-6 sm:gap-8">
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
 * Sponsors of one part of the event, the smallest named tier.
 *
 * One of them is labelled by its part, "Mobility Sponsor", like the tiers
 * above. Several share "Official Sponsors", with each part under its logo.
 */
function OfficialTier({ partners: official = [] }: { partners?: OfficialPartner[] }) {
  if (official.length === 0) return null;
  const single = official.length === 1;
  return (
    <div className="flex w-full flex-col items-center gap-6 sm:gap-8">
      <TierLabel className="text-ink-3">
        {single ? `${official[0].role} Sponsor` : "Official Sponsors"}
      </TierLabel>
      <ul className="flex w-full flex-wrap justify-center gap-4">
        {official.map((partner) => (
          <li key={partner.logo} className={`${TIER.official.item} flex flex-col items-center gap-2`}>
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
 * Community, media and ecosystem partners: the smallest tier, as dark tiles.
 *
 * A step below the official sponsors at every width, in the same centred
 * column and under the same kind of label. They used to be a left-aligned,
 * full-width grid with its own large heading and a count, bigger logos than
 * the bronze and official sponsors above them, which outranked the paying
 * tiers the moment the lists were filled in.
 */
function PartnerCard({ name, logo, twitter }: PartnerLogo) {
  const card = (
    <div className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl border border-line-2 bg-card-2 px-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D7A64B]/50 hover:bg-card-3 hover:shadow-[0_0_24px_-6px_rgba(215,166,75,0.35)] sm:h-16">
      <Image
        src={logo}
        alt={name}
        width={160}
        height={64}
        sizes="(min-width: 640px) 140px, 30vw"
        className="h-6 w-auto max-w-full object-contain grayscale-15 transition-all duration-300 group-hover:grayscale-0 sm:h-8"
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
        className="block w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7A64B]/60"
      >
        {card}
        <span className="sr-only"> on X (opens in a new tab)</span>
      </Link>
    );
  }

  return card;
}

function PartnerGroup({ label, items = [] }: { label: string; items?: PartnerLogo[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex w-full flex-col items-center gap-6 sm:gap-8">
      <TierLabel className="text-ink-3">{label}</TierLabel>
      {/* Gap 0.75rem: three to a row on a phone, five from sm, six from lg. */}
      <ul className="flex w-full flex-wrap justify-center gap-3">
        {items.map((item) => (
          <li
            key={item.logo}
            className="w-[calc(33.333%-0.5rem)] sm:w-[calc(20%-0.6rem)] lg:w-[calc(16.666%-0.625rem)]"
          >
            <PartnerCard {...item} />
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

        <div className="flex w-full max-w-4xl flex-col items-center gap-12 sm:gap-16">
          <Tier tier="headline" label="Headline" labelClassName="text-brand-gold" sponsors={partners.headline} />
          <Tier tier="gold" label="Gold" labelClassName="text-[#D7A64B]" sponsors={partners.gold} />
          <Tier tier="silver" label="Silver" labelClassName="text-ink-2" sponsors={partners.silver} />
          <Tier tier="bronze" label="Bronze" labelClassName="text-ink-3" sponsors={partners.bronze} />
          <OfficialTier partners={partners.official} />
          <PartnerGroup label="Community Partners" items={partners.community} />
          <PartnerGroup label="Media Partners" items={partners.media} />
          <PartnerGroup label="Ecosystem Partners" items={partners.ecosystem} />
        </div>
      </div>
    </section>
  );
}
