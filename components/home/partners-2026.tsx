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
 * the logo inside it, and the width it may take. Headline, silver and
 * mobility used to sit in near-identical white boxes stacked down the middle,
 * so the one sponsor paying for the headline read the same as the rest.
 *
 * Widths are per item, in a centred wrapping row, so one sponsor in a tier
 * sits centred at its tier's size and more of them sit side by side.
 */
const TIER = {
  headline: {
    item: "w-full max-w-3xl",
    plate: "h-28 sm:h-40 lg:h-44 rounded-2xl ring-1 ring-brand-gold/50 shadow-[0_0_56px_-16px_rgba(242,203,69,0.45)]",
    logo: "h-14 sm:h-20 lg:h-24",
    sizes: "(min-width: 768px) 480px, 80vw",
  },
  gold: {
    item: "w-[90%] sm:w-[24rem]",
    plate: "h-24 sm:h-32 rounded-2xl ring-1 ring-[#D7A64B]/40",
    logo: "h-12 sm:h-16",
    sizes: "(min-width: 640px) 320px, 70vw",
  },
  silver: {
    item: "w-[78%] sm:w-[20rem]",
    plate: "h-20 sm:h-28 rounded-2xl",
    logo: "h-10 sm:h-14",
    sizes: "(min-width: 640px) 260px, 60vw",
  },
  bronze: {
    item: "w-[calc(50%-0.5rem)] sm:w-[15rem]",
    plate: "h-16 sm:h-24 rounded-xl",
    logo: "h-8 sm:h-11",
    sizes: "(min-width: 640px) 200px, 40vw",
  },
  official: {
    item: "w-[calc(50%-0.5rem)] sm:w-[14rem]",
    plate: "h-16 sm:h-20 rounded-xl",
    logo: "h-8 sm:h-10",
    sizes: "(min-width: 640px) 180px, 40vw",
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
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
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
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                {partner.role}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PartnerCard({ name, logo, twitter }: PartnerLogo) {
  const card = (
    <div className="group relative flex h-20 items-center justify-center overflow-hidden rounded-xl border border-line-2 bg-card-2 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D7A64B]/50 hover:bg-card-3 hover:shadow-[0_0_24px_-6px_rgba(215,166,75,0.35)] lg:h-24">
      <Image
        src={logo}
        alt={name}
        width={160}
        height={64}
        className="h-10 w-auto object-contain grayscale-15 transition-all duration-300 group-hover:grayscale-0 lg:h-14"
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
    <div className="mb-12 lg:mb-16">
      <div className="mb-5 flex items-baseline justify-between lg:mb-6">
        <h3 className="text-xl font-bold text-white lg:text-2xl">{label}</h3>
        <span className="text-sm font-medium text-ink-4">{items.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-4">
        {items.map((item) => (
          <PartnerCard key={item.logo} {...item} />
        ))}
      </div>
    </div>
  );
}

export function PartnersSection2026() {
  useSubtleAnimations();

  const groups = [partners.community, partners.media, partners.ecosystem];
  const hasGroups = groups.some((g) => (g?.length ?? 0) > 0);

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
        </div>

        {hasGroups && (
          <div className="scale-in mt-16 w-full lg:mt-20">
            <PartnerGroup label="Community Partners" items={partners.community} />
            <PartnerGroup label="Media Partners" items={partners.media} />
            <PartnerGroup label="Ecosystem Partners" items={partners.ecosystem} />
          </div>
        )}
      </div>
    </section>
  );
}
