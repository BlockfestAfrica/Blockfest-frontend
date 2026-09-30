"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";
import { LogoTile } from "@/components/home/partner-logo";
import { PartnerPaths } from "@/components/partners/partner-paths";
import { partners2025 } from "@/lib/partners-2025";

/*
 * How many 2025 logos the home page shows before sending people to
 * /partners for the rest. Twelve fills whole rows at every width here: 3, 4
 * and 6 to a row. Sponsors come first in the list, so they are the ones
 * shown.
 */
const HOME_LIMIT = 12;

/**
 * The 2025 partners on the same white tiles as 2026. Last year's dark tiles
 * are what about half these files were drawn for, so the logos are the
 * prepared copies scripts/logos-on-white.mjs writes.
 *
 * With a `limit` it is the home page's short version, 6 to a row; without,
 * the whole list, 8 to a row.
 */
export function PastPartnersWall({ limit }: { limit?: number }) {
  const shown = limit ? partners2025.slice(0, limit) : partners2025;

  return (
    // mobile-grid-ok: logo tiles, three fit at 360px
    <ul
      className={`grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 ${limit ? "" : "lg:grid-cols-8"}`}
    >
      {shown.map((partner) => (
        <li key={partner.name}>
          <LogoTile
            partner={partner}
            sizes="(min-width: 768px) 170px, 30vw"
            className="h-16 rounded-xl [--logo:22px] md:h-20 md:[--logo:24px]"
          />
        </li>
      ))}
    </ul>
  );
}

export function PartnersSection() {
  useSubtleAnimations();

  return (
    <section className="section-y bg-ground border-t border-line-2">
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-ink-3">2025 PARTNERS</p>
          <h2 className="text-display-sm mt-3 font-bold text-white fade-in-on-scroll">
            Previous Partners
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-3">
            These companies shared our vision at Blockfest Africa 2025, and
            brought new eyes to their brand.
          </p>
        </div>

        <PastPartnersWall limit={HOME_LIMIT} />

        <Link
          href="/partners#previous-partners"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline"
        >
          See all {partners2025.length} previous partners
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {/*
          * The ways in, one per kind of partner, where this used to be one
          * card with "View 2026 Packages" and "Contact Us".
          */}
        <div className="mt-12 lg:mt-16">
          <h3 className="text-2xl font-bold text-white">
            Partner with Blockfest Africa 2026
          </h3>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-3">
            Sponsor the festival, cover it, bring your community, or partner
            as an institution.
          </p>
          <div className="mt-6">
            <PartnerPaths location="Home partners" headingLevel="h4" />
          </div>
        </div>
      </div>
    </section>
  );
}
