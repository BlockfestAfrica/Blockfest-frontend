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

/**
 * A campaign that is open.
 *
 * Laid out in two parts rather than one column: what the campaign is on the
 * left, and the facts a creator decides on reading down the right. Stacking all
 * of it vertically was the problem with the first pass. The prize, the dates
 * and the sponsor are not prose, and setting them as a rail lets the prize
 * carry the weight it deserves while the summary keeps a readable measure.
 */
function FeaturedCampaign({ campaign }: { campaign: Campaign }) {
  const dates = campaignDates(campaign);

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group flex flex-col rounded-2xl border border-white/20 bg-white/5 transition-colors duration-300 hover:border-white/30 hover:bg-white/[0.07] lg:col-span-2"
    >
      <div className="flex flex-1 flex-col gap-8 p-6 sm:p-8 md:flex-row md:gap-10 lg:p-10">
        <div className="flex flex-1 flex-col">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-brand-gold">
            <span
              className="h-1.5 w-1.5 rounded-full bg-brand-gold"
              aria-hidden="true"
            />
            Open now
          </span>

          <h2 className="text-display-sm mt-5 font-bold text-white">
            {campaign.name}
          </h2>
          <p className="mt-2 text-lg font-semibold text-brand-gold">
            {campaign.hook}
          </p>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-white/60">
            {campaign.summary}
          </p>

          <span className="mt-auto pt-8">
            {/* A span, not a nested link. The whole card is already the link,
                and a link inside a link is invalid and unpredictable. */}
            <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-300 group-hover:bg-brand-gold-hover">
              See the campaign
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </span>
        </div>

        {/* Spread over the full height so the rail ends where the column rule
            does. Top-aligned, its divider ran on past the last item and the
            card read as unfinished. The left column already pins its button to
            the bottom, so this balances against it. */}
        <dl className="flex flex-col justify-between gap-6 border-t border-white/15 pt-8 md:w-52 md:shrink-0 md:border-l md:border-t-0 md:pl-10 md:pt-0">
          {campaign.rewardPool && (
            <div>
              <dt className="eyebrow text-white/60">Prize pool</dt>
              <dd className="mt-1.5 text-3xl font-bold tabular-nums text-white">
                {formatNaira(campaign.rewardPool)}
              </dd>
            </div>
          )}
          {dates && (
            <div>
              <dt className="eyebrow text-white/60">Runs</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-white/80">
                {dates}
              </dd>
            </div>
          )}
          {campaign.sponsorLogo && (
            <div>
              <dt className="eyebrow text-white/60">Sponsor</dt>
              <dd className="mt-2">
                {/* On a white chip, as the partner sections do it. These are
                    dark wordmarks and they vanish against the ground. */}
                <span className="inline-flex items-center rounded-md bg-white px-3 py-2">
                  <Image
                    src={campaign.sponsorLogo}
                    alt={campaign.sponsor}
                    width={120}
                    height={28}
                    className="h-5 w-auto object-contain"
                  />
                </span>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Link>
  );
}

/**
 * A campaign that has been announced but not named.
 *
 * The point is that a visitor knows something is coming without learning what,
 * so the name is not rendered at all. A CSS blur would not do: the text would
 * still be in the markup and readable from view-source, which is concealment
 * that only works on people who do not look. What renders instead is a pair of
 * bars roughly the shape of a name, blurred, leaking nothing because there is
 * nothing there to leak. The registry keeps the real name for our own use.
 *
 * Deliberately not a link and not focusable: a card that looks clickable and
 * does nothing is worse than one that plainly says it is not ready. Its content
 * sits at the top rather than stretching, so a short card reads as compact
 * instead of as a tall box somebody forgot to fill.
 */
function UpcomingCampaign() {
  return (
    <div className="flex flex-col rounded-2xl border border-dashed border-white/20 p-6 sm:p-8 lg:p-10">
      <span className="inline-flex w-fit items-center rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/60">
        Coming soon
      </span>

      {/* Where the name will go. Decorative, so it is hidden from screen
          readers and the real message is given as text below. */}
      <div
        className="mt-6 flex select-none items-center gap-3"
        aria-hidden="true"
      >
        <span className="h-7 w-32 rounded-md bg-white/25 blur-[6px] sm:h-9 sm:w-40" />
        <span className="h-7 w-20 rounded-md bg-white/15 blur-[6px] sm:h-9 sm:w-24" />
      </div>

      <p className="mt-7 text-base leading-relaxed text-white/50">
        The next creator campaign from Blockfest Africa. We are not saying who
        yet.
      </p>
    </div>
  );
}

/**
 * The campaigns index.
 *
 * An index rather than a single campaign page because a second campaign is
 * already known about. It exists so the page reads as a programme rather than a
 * one-off, and so the first visitor to arrive after Rovv opens finds it where
 * they last looked.
 *
 * The grid is three columns rather than two because the campaigns are not
 * equals. An open campaign with a prize pool deserves twice the room of one
 * that is only a name so far, and giving them matching halves made the short
 * card look broken.
 */
export default function CampaignsPage() {
  const live = campaigns.filter((c) => c.status === "live");
  const upcoming = campaigns.filter((c) => c.status === "coming-soon");

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page">
          {/* Title and lead sit side by side above the large breakpoint. In one
              column the lead left half the width empty at exactly the point the
              page is meant to look considered. */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <div>
              <p className="eyebrow text-white/60">Creator campaigns</p>
              <h1 className="text-display mt-3 font-bold uppercase text-white">
                Campaigns
              </h1>
            </div>
            <p className="max-w-md text-base leading-relaxed text-white/60 lg:pb-2 lg:text-right">
              Sponsor-backed creator competitions run by Blockfest Africa. Real
              briefs, real prize money, and your own audience. You keep the
              work, we help it travel.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-3 lg:items-start">
            {live.map((campaign) => (
              <FeaturedCampaign key={campaign.slug} campaign={campaign} />
            ))}
            {/* Keyed by index on purpose: the slug is the one identifier that
                would give the name away if it ever reached an attribute. */}
            {upcoming.map((_, i) => (
              <UpcomingCampaign key={i} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
