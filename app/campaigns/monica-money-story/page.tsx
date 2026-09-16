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
import { buttonClass } from "@/components/shared/panel";
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
              {/* A plain anchor, but the house secondary SHAPE: it sits
                  beside the gold action and shared its row while being
                  drawn as body text, so the two read as a button and a
                  sentence rather than as two things you can press. */}
              <a
                href={monicaRoutes.pack}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("secondary", "whitespace-nowrap")}
              >
                See the Creator Pack
              </a>
            </div>
            {/* The utilities as chips, not as five underlined phrases in a
                row. Drawn as text they read as one run of prose the eye
                has to parse before it can use any of it, and on a laptop
                they crowded the gold action above them. A shape each, a
                tap target each, and a wrap that never strands one alone.
                Your page BEFORE Lost your link, deliberately: recovery
                rotates the token and kills the welcome email's link, so
                it must not be the first thing a returning creator
                reaches for. */}
            <nav aria-label="Campaign links" className="mt-6">
              <ul className="flex flex-wrap items-center gap-2">
                {[
                  { href: monicaRoutes.leaderboard, label: "Leaderboard" },
                  { href: "#resources", label: "Resources" },
                  { href: monicaRoutes.privacy, label: "Privacy notice" },
                  { href: monicaRoutes.me, label: "Your page" },
                  { href: monicaRoutes.recover, label: "Lost your link?" },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-line-2 px-4 text-sm font-semibold text-ink-2 transition-colors hover:bg-card-2 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </section>
    </main>
  );
}
