import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { campaigns, type Campaign } from "@/lib/campaigns";
import { formatNaira } from "@/lib/tickets";
import { SITE_URL } from "@/lib/seo-event";

const OG_TITLE = "Creator Campaigns | Blockf3st Africa";
const OG_DESCRIPTION =
  "Sponsor-backed creator competitions from Blockfest Africa. Tell the story, earn the points, take the prize.";

export const metadata: Metadata = {
  // The root layout appends "| Blockf3st Africa 2026", so branding here would
  // be the third copy in one title tag.
  title: "Campaigns",
  description: OG_DESCRIPTION,
  keywords: [
    "blockfest africa creator campaign",
    "nigeria creator competition",
    "web3 content campaign africa",
  ],
  openGraph: {
    type: "website",
    url: `${SITE_URL}/campaigns`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  alternates: { canonical: `${SITE_URL}/campaigns` },
};

/** e.g. "14 September – 17 October 2026", or nothing if the dates are unset. */
function campaignDates(campaign: Campaign): string | null {
  if (!campaign.startsAt || !campaign.endsAt) return null;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const from = new Date(campaign.startsAt).toLocaleDateString("en-GB", opts);
  const to = new Date(campaign.endsAt).toLocaleDateString("en-GB", {
    ...opts,
    year: "numeric",
  });
  return `${from} – ${to}`;
}

function LiveCampaignCard({ campaign }: { campaign: Campaign }) {
  const dates = campaignDates(campaign);

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group flex flex-col rounded-2xl border border-white/20 bg-white/5 p-6 transition-colors duration-300 hover:bg-white/10 sm:p-8"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-brand-gold">
          <span
            className="h-1.5 w-1.5 rounded-full bg-brand-gold"
            aria-hidden="true"
          />
          Open now
        </span>
        {dates && <span className="text-xs text-white/60">{dates}</span>}
      </div>

      <h2 className="text-display-sm mt-5 font-bold text-white">
        {campaign.name}
      </h2>
      <p className="mt-2 text-lg font-semibold text-brand-gold">
        {campaign.hook}
      </p>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-white/60">
        {campaign.summary}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        {campaign.rewardPool && (
          <p className="text-sm text-white/60">
            <span className="text-2xl font-bold tabular-nums text-white">
              {formatNaira(campaign.rewardPool)}
            </span>{" "}
            up for grabs
          </p>
        )}
        {campaign.sponsorLogo && (
          <p className="flex items-center gap-2 text-sm text-white/60">
            Sponsored by
            {/* On a white chip, as the partner sections do it. These are dark
                wordmarks and they disappear against the ground otherwise. */}
            <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5">
              <Image
                src={campaign.sponsorLogo}
                alt={campaign.sponsor}
                width={96}
                height={24}
                className="h-4 w-auto object-contain"
              />
            </span>
          </p>
        )}
      </div>

      <span className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 group-hover:text-white">
        See the campaign
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

function ComingSoonCard({ campaign }: { campaign: Campaign }) {
  return (
    // Deliberately not a link and not focusable. A card that looks clickable
    // and does nothing is worse than one that plainly says "not yet".
    <div className="flex flex-col rounded-2xl border border-dashed border-white/20 p-6 sm:p-8">
      <span className="inline-flex w-fit items-center rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/60">
        Coming soon
      </span>
      <h2 className="text-display-sm mt-5 font-bold text-white/70">
        {campaign.name}
      </h2>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-white/50">
        {campaign.summary}
      </p>
    </div>
  );
}

/**
 * The campaigns index.
 *
 * An index rather than a single campaign page because a second campaign is
 * already known about. Rovv appears as a card that cannot be clicked — it
 * exists so the page reads as a programme rather than a one-off, and so the
 * first visitor to arrive after Rovv opens finds it where they last looked.
 */
export default function CampaignsPage() {
  const live = campaigns.filter((c) => c.status === "live");
  const upcoming = campaigns.filter((c) => c.status === "coming-soon");

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page">
          <p className="eyebrow text-white/60">Creator campaigns</p>
          <h1 className="text-display mt-3 font-bold uppercase text-white">
            Campaigns
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
            Sponsor-backed creator competitions run by Blockfest Africa. Real
            briefs, real prize money, and your own audience — you keep the work,
            we help it travel.
          </p>

          <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-2">
            {live.map((campaign) => (
              <LiveCampaignCard key={campaign.slug} campaign={campaign} />
            ))}
            {upcoming.map((campaign) => (
              <ComingSoonCard key={campaign.slug} campaign={campaign} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
