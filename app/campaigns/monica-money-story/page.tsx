import type { Metadata } from "next";
import Link from "next/link";
import { CampaignJoinCTA } from "@/components/campaigns/campaign-join-cta";
import { MonicaHero } from "@/components/campaigns/monica-hero";
import { MonicaHowItWorks } from "@/components/campaigns/monica-how-it-works";
import { MonicaStages } from "@/components/campaigns/monica-stages";
import { MonicaPrizes } from "@/components/campaigns/monica-prizes";
import { MonicaFaq } from "@/components/campaigns/monica-faq";
import {
  campaignBySlug,
  campaignOpensLabel,
  MONICA_CAMPAIGN_DAYS,
  monicaRewardPool,
  monicaRoutes,
  MONICA_SLUG,
} from "@/lib/campaigns";
import { formatNaira } from "@/lib/tickets";
import { SITE_URL } from "@/lib/seo-event";

const CAMPAIGN = campaignBySlug(MONICA_SLUG)!;
const OPENS_LABEL = campaignOpensLabel(CAMPAIGN);

const OG_TITLE = "Monica: The Money Story | Blockf3st Africa";
const OG_DESCRIPTION = `A ${MONICA_CAMPAIGN_DAYS}-day creator competition from Blockfest Africa. ${formatNaira(
  monicaRewardPool,
)} in prizes across four stages. Are you skillful?`;

export const metadata: Metadata = {
  // The root layout appends "| Blockf3st Africa 2026", so branding here would
  // be the third copy in one title tag.
  title: "Monica: The Money Story",
  description: OG_DESCRIPTION,
  keywords: [
    "monica the money story",
    "blockfest africa creator campaign",
    "nigeria creator competition 2026",
    "stablecoin content campaign",
    "are you skillful",
  ],
  openGraph: {
    type: "website",
    url: `${SITE_URL}${monicaRoutes.landing}`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        // TODO: replace with a campaign-specific card once Monica supplies
        // artwork. The generic event image is accurate but does not sell this.
        url: `${SITE_URL}/images/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: CAMPAIGN.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [`${SITE_URL}/images/twitter-image.jpg`],
  },
  alternates: { canonical: `${SITE_URL}${monicaRoutes.landing}` },
};

/**
 * The campaign pitch.
 *
 * Statically prerendered, like every other marketing page here. Nothing on it
 * reads the database: the leaderboard and the live challenge arrive in later
 * milestones as client-fetched islands in this shell, so a database that is
 * asleep can never take the pitch offline.
 *
 * Its own directory rather than a [slug] route. There is exactly one campaign
 * with a page, and a dynamic route rendering one hardcoded set of sections
 * would be indirection pretending to be flexibility. The second campaign can
 * have its own directory, or force the generalisation properly when it needs to.
 */
export default function MonicaMoneyStoryPage() {
  return (
    <main id="main" className="bg-ground">
      <nav aria-label="Breadcrumb" className="container-page pt-8">
        <Link
          href="/campaigns"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
        >
          All campaigns
        </Link>
      </nav>

      <MonicaHero />
      <MonicaHowItWorks />
      <MonicaStages />
      <MonicaPrizes />
      <MonicaFaq />

      <section className="section-y border-t border-white/20 bg-ground">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-display-sm font-bold text-white">
              {CAMPAIGN.hook}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              {MONICA_CAMPAIGN_DAYS} days, one story, told by the community.
              Register once and the first brief is waiting.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              {CAMPAIGN.startsAt && OPENS_LABEL && (
                <CampaignJoinCTA
                  href={monicaRoutes.register}
                  opensAt={CAMPAIGN.startsAt}
                  opensLabel={OPENS_LABEL}
                />
              )}
              <Link
                href={monicaRoutes.pack}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                See the Creator Pack
              </Link>
              <Link
                href={monicaRoutes.privacy}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                Privacy notice
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
