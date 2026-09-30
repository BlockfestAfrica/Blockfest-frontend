"use client";

import { useSubtleAnimations } from "@/lib/hooks/use-subtle-animations";
import "./subtle-animations.css";
import { LogoTile } from "@/components/home/partner-logo";
import {
  headline,
  partners,
  sponsors,
  type Partner,
  type PartnerKind,
} from "@/lib/partners-2026";

/*
 * Two groups, not a band per category.
 *
 * This was eight labelled bands (Headline, Gold, Silver, Bronze, the
 * category sponsors, Community, Media, Ecosystem), each with its own centred
 * title between two rules, so every new kind of partner meant another band
 * and the page read as a stack of headings with a few logos under each. Big
 * conference sites mostly do not do that: Permissionless shows its tiers
 * only by how many logos share a row, Africa Tech Summit puts every logo on
 * the same white pill, and Breakpoint's home page has one wall.
 *
 * So: sponsors, where the tier is what they paid for and is said inside each
 * tile, drawn a clear step smaller from the headline down; then one wall for
 * everyone else, named once by the kinds it holds.
 */

/* One row for the sponsors, however many there are, so two do not leave a
   third of the row empty. */
const SPONSOR_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
};

const KINDS: PartnerKind[] = ["Media", "Community", "Government", "Ecosystem"];

/** "Media partners", "Media, community & government partners". */
export function partnerGroupLabel(list: Partner[]): string {
  const kinds = KINDS.filter((kind) => list.some((p) => p.kind === kind)).map(
    (kind, i) => (i === 0 ? kind : kind.toLowerCase()),
  );
  if (kinds.length === 0) return "Partners";
  const named =
    kinds.length === 1
      ? kinds[0]
      : `${kinds.slice(0, -1).join(", ")} & ${kinds[kinds.length - 1]}`;
  return `${named} partners`;
}

/**
 * The 2026 sponsors and partners, without a section header, so the home page
 * and /partners show the same thing. `level` is the heading level of the two
 * group labels: under the home page's h2, or straight under /partners' h1.
 */
export function PartnerWall2026({ level = 3 }: { level?: 2 | 3 }) {
  const Label = level === 2 ? "h2" : "h3";

  return (
    <>
      {(headline || sponsors.length > 0) && (
        <div>
          <Label className="eyebrow text-ink-3">Sponsors</Label>

          {headline && (
            <LogoTile
              partner={headline}
              sizes="(min-width: 1024px) 600px, 80vw"
              caption={`${headline.tier} sponsor`}
              className="mt-4 h-32 rounded-2xl px-8 [--logo:40px] sm:h-40 sm:[--logo:52px] lg:h-44 lg:[--logo:60px]"
            />
          )}

          {sponsors.length > 0 && (
            // mobile-grid-ok: logo tiles, two fit at 360px
            <ul
              className={`mt-3 grid gap-3 ${SPONSOR_COLUMNS[sponsors.length] ?? "grid-cols-2 md:grid-cols-4"}`}
            >
              {sponsors.map((sponsor) => (
                <li key={sponsor.name}>
                  <LogoTile
                    partner={sponsor}
                    sizes="(min-width: 768px) 360px, 45vw"
                    caption={`${sponsor.tier} sponsor`}
                    className="h-24 rounded-2xl [--logo:30px] md:h-32 md:[--logo:38px]"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {partners.length > 0 && (
        <div className={headline || sponsors.length > 0 ? "mt-12" : ""}>
          <Label className="eyebrow text-ink-3">{partnerGroupLabel(partners)}</Label>

          {/* mobile-grid-ok: logo tiles, three fit at 360px */}
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
            {partners.map((partner) => (
              <li key={partner.name}>
                <LogoTile
                  partner={partner}
                  sizes="(min-width: 768px) 160px, 30vw"
                  className="h-16 rounded-xl [--logo:22px] md:h-20 md:[--logo:26px]"
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function PartnersSection2026() {
  useSubtleAnimations();

  return (
    <section className="section-y border-t border-line-2 bg-ground">
      <div className="container-page">
        <div className="mb-10 lg:mb-14">
          <p className="eyebrow text-ink-3">2026 PARTNERS</p>

          <h2 className="text-display-sm mt-3 font-bold text-white fade-in-on-scroll">
            Our Partners
          </h2>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-3">
            The sponsors and partners backing Blockfest Africa 2026, from
            South Africa to Lagos this October.
          </p>
        </div>

        <PartnerWall2026 />
      </div>
    </section>
  );
}
