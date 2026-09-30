import type { Metadata } from "next";
import { ArrowDown } from "lucide-react";
import { PartnerWall2026 } from "@/components/home/partners-2026";
import { PastPartnersWall } from "@/components/home/partners";
import { PartnerPaths } from "@/components/partners/partner-paths";
import { partners2025 } from "@/lib/partners-2025";
import { CURRENT_EDITION, EVENT_ID, SITE_URL } from "@/lib/seo-event";
import { jsonLd } from "@/lib/json-ld";

const OG_TITLE = "Partners | Blockf3st Africa '26 Lagos";
const OG_DESCRIPTION =
  "Who is backing Blockf3st Africa 2026, and how to sponsor, cover or partner with the festival.";

export const metadata: Metadata = {
  // The root layout appends "| Blockf3st Africa 2026", so branding here would
  // be the second copy in one title tag.
  title: "Partners",
  description:
    "The sponsors, media, community and institutional partners behind Blockfest Africa 2026, the partners who backed 2025, and how to become one.",
  keywords: [
    "blockfest africa partners",
    "blockfest africa sponsors",
    "web3 conference lagos sponsors",
    "media partner tech conference nigeria",
  ],
  // Next replaces these objects wholesale rather than merging them into the
  // layout's, so the image and url have to be restated or the card ships bare.
  openGraph: {
    type: "website",
    url: `${SITE_URL}/partners`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/images/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: `Partners of ${CURRENT_EDITION.name}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [`${SITE_URL}/images/twitter-image.jpg`],
  },
  alternates: { canonical: `${SITE_URL}/partners` },
};

/**
 * Every partner, in one place, and the ways to become one.
 *
 * The home page shows the 2026 wall and a short 2025 wall; this is the full
 * list, the way conference sites keep a partners page (TOKEN2049, Consensus,
 * Web Summit) so the home page does not have to grow with it. The walls are
 * the home page's own components, so the two cannot drift apart.
 */
export default function PartnersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script injection
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Partners",
            url: `${SITE_URL}/partners`,
            about: { "@id": EVENT_ID },
            description: `The sponsors and partners of ${CURRENT_EDITION.name}, and how to become one.`,
          }),
        }}
      />

      <main id="main">
        <section className="section-y bg-ground">
          <div className="container-page">
            <p className="eyebrow text-ink-3">2026 Partners</p>
            <h1 className="text-display-sm mt-3 max-w-3xl font-bold text-white">
              Our partners
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-3">
              The brands, communities, media and institutions backing
              Blockfest Africa 2026, from South Africa to Lagos this October.
            </p>
            <a
              href="#become-a-partner"
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline"
            >
              Become a partner
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </a>

            <div className="mt-10 lg:mt-14">
              <PartnerWall2026 level={2} />
            </div>
          </div>
        </section>

        <section
          id="become-a-partner"
          className="section-y scroll-mt-24 border-t border-line-2 bg-ground"
        >
          <div className="container-page">
            <h2 className="text-display-sm font-bold text-white">
              Become a partner
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-3">
              Sponsor the festival, cover it, bring your community, or partner
              as an institution.
            </p>
            <div className="mt-8">
              <PartnerPaths location="Partners page" />
            </div>
          </div>
        </section>

        <section
          id="previous-partners"
          className="section-y scroll-mt-24 border-t border-line-2 bg-ground"
        >
          <div className="container-page">
            <p className="eyebrow text-ink-3">2025 Partners</p>
            <h2 className="text-display-sm mt-3 font-bold text-white">
              Previous partners
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-3">
              The {partners2025.length} companies, communities and media who
              backed Blockfest Africa 2025.
            </p>
            <div className="mt-10">
              <PastPartnersWall />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
