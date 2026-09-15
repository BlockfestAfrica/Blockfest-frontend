import { TrackView } from "@/components/campaigns/track-view";
import { CAMPAIGN_EVENTS } from "@/lib/sabilytics";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CampaignJoinCTA } from "@/components/campaigns/campaign-join-cta";
import { MonicaHero } from "@/components/campaigns/monica-hero";
import { MonicaIntro } from "@/components/campaigns/monica-intro";
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
// The team's positioning line, verbatim: "30 days. 4 stages. ₦5,000,000 on
// the line." The figures are read from the registry so the description can
// never disagree with the page it describes.
const OG_DESCRIPTION = `A creator competition from Blockfest Africa. ${MONICA_CAMPAIGN_DAYS} days. 4 stages. ${formatNaira(
  monicaRewardPool,
)} on the line. Are you skillful?`;

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
  <TrackView event={CAMPAIGN_EVENTS.viewed} />
      <nav aria-label="Breadcrumb" className="container-page pt-8">
        <Link
          href="/campaigns"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All campaigns
        </Link>
      </nav>

      <MonicaHero />
      <MonicaIntro />
      <MonicaHowItWorks />
      <MonicaStages />
      <MonicaPrizes />
      <MonicaFaq />

      <section className="section-y border-t border-line-2 bg-ground">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-display-sm font-bold text-white">
              {CAMPAIGN.hook}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-3">
              {MONICA_CAMPAIGN_DAYS} days. 4 stages.{" "}
              {formatNaira(monicaRewardPool)} on the line. Register once and
              the first challenge is waiting.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              {CAMPAIGN.startsAt && OPENS_LABEL && (
                <CampaignJoinCTA
                  href={monicaRoutes.register}
                  opensAt={CAMPAIGN.startsAt}
                  opensLabel={OPENS_LABEL}
                />
              )}
              {/* A plain anchor: the pack is an external doc, and Next's
                  Link buys nothing for an off-site URL. New tab, so the
                  campaign page stays where the reader left it. */}
              <a
                href={monicaRoutes.pack}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                See the Creator Pack
              </a>
            </div>
            {/* The utilities, on their own quiet line. Five controls in one
                row read fine stacked on a phone and jampacked side by side
                on a laptop: the gold action and its one companion keep the
                row, and the reference links breathe below it. Nowrap,
                because "Privacy notice" split across two lines reads as
                two links. */}
            <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-1">
              <Link
                href={monicaRoutes.leaderboard}
                className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                Leaderboard
              </Link>
              <a
                href="#resources"
                className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                Resources
              </a>
              <Link
                href={monicaRoutes.privacy}
                className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                Privacy notice
              </Link>
              <Link
                href={monicaRoutes.recover}
                className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
              >
                Lost your link?
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
