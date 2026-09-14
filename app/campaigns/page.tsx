import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Trophy } from "lucide-react";
import { campaignRun, campaigns, type Campaign } from "@/lib/campaigns";
import { formatNaira } from "@/lib/tickets";
import { SITE_URL } from "@/lib/seo-event";

const OG_TITLE = "Campaigns | Blockf3st Africa";
const OG_DESCRIPTION =
  "Creator competitions from Blockfest Africa. Tell the story, earn the points, take the prize.";

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

/**
 * A campaign that is open, as the marketing team sketched it.
 *
 * Their mockup made two calls this implements: the two cards are EQUAL, side
 * by side, because "coming soon" earning half the room made the page read as
 * one product and a leftover; and each card carries a picture, because a
 * prize card with no life in it is a spreadsheet row. The photograph sits
 * under a left-heavy gradient so the text never fights it, and until a real
 * photo lands in the registry the gradient treatment stands on its own.
 *
 * The content order is theirs too: state, name, the hook, one selling line,
 * then the two facts a creator decides on (the pool, the dates), the CTA,
 * and the sponsor signing the card at the foot.
 */
function FeaturedCampaign({ campaign }: { campaign: Campaign }) {
  const dates = campaignRun(campaign);

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line-2 bg-card transition-colors duration-150 hover:border-line-3"
    >
      {/* The picture layer, behind everything. object-cover from the right
          so a portrait reads while the text column stays clean. */}
      {campaign.cardImage && (
        <Image
          src={campaign.cardImage}
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-right"
          aria-hidden="true"
        />
      )}
      {/* Legibility gradient: solid ground on the text side, opening to the
          image on the right; a low gold wash keeps the card alive when no
          photo has landed yet. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-ground via-ground/90 to-ground/30"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(242,203,69,0.14),transparent_60%)]"
      />
      {/* A narrow fade where the photo meets the card's right border. The
          hairline border over the poster's bright green read as a white line
          down that edge; over ground it reads as the same quiet edge the rest
          of the card has. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ground/70 to-transparent"
      />

      <div className="relative flex flex-1 flex-col p-6 sm:p-7">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-brand-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
          Open now
        </span>

        <h2 className="mt-5 text-display-sm font-bold text-white">
          {campaign.name}
        </h2>
        <p className="mt-1 text-lg font-semibold text-brand-gold">
          {campaign.hook}
        </p>
        {/* The two facts a creator decides on, as labelled figures. */}
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
          {campaign.rewardPool && (
            <div className="flex items-start gap-2.5">
              <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <div>
                <dt className="eyebrow text-ink-3">Prize pool</dt>
                <dd className="mt-0.5 font-bold tabular-nums text-white">
                  {formatNaira(campaign.rewardPool)}
                </dd>
              </div>
            </div>
          )}
          {dates && (
            <div className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <div>
                <dt className="eyebrow text-ink-3">Runs</dt>
                <dd className="mt-0.5 text-sm font-semibold text-ink">{dates}</dd>
              </div>
            </div>
          )}
        </dl>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
          {/* A span, not a nested link: the whole card is the link already. */}
          <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-7 text-base font-semibold text-black transition-colors duration-150 group-hover:bg-brand-gold-hover">
            Enter the campaign
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>

          {campaign.sponsorLogo && (
            <span className="flex flex-col items-end gap-1.5">
              <span className="text-xs text-ink-4">Headline sponsor</span>
              <span className="inline-flex items-center rounded-md bg-white px-3 py-1.5">
                <Image
                  src={campaign.sponsorLogo}
                  alt={campaign.sponsor}
                  width={110}
                  height={26}
                  className="h-5 w-auto object-contain"
                />
              </span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * A campaign announced but not named, now the same size as the open one.
 *
 * The marketing mockup's second call: half-width made this read as a
 * leftover, and equal framing makes the programme read as a programme. The
 * veiled-object treatment is theirs too, done in gradients rather than a
 * staged photograph, so there is nothing in the markup to leak. The name
 * itself is still never rendered: bars stand where it will go, because a
 * CSS blur over real text is concealment only from people who do not view
 * source.
 */
function UpcomingCampaign() {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-dashed border-line-2">
      {/* The veil: a cold violet glow rising from the covered thing. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(109,74,255,0.22),transparent_55%),radial-gradient(ellipse_at_top_left,rgba(27,100,228,0.10),transparent_50%)]"
      />

      <div className="relative flex flex-1 flex-col p-6 sm:p-7">
        <span className="inline-flex w-fit items-center rounded-full border border-line-2 px-3 py-1 text-xs font-semibold text-ink-3">
          Coming soon
        </span>

        <h2 className="mt-5 text-display-sm font-bold text-white">
          We know who is next
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink-3">
          You will find out soon
        </p>

        {/* Where the name will go. Decorative, hidden from screen readers. */}
        <div className="mt-auto flex select-none items-center gap-3 pt-8" aria-hidden="true">
          <span className="h-8 w-36 rounded-md bg-white/20 blur-[6px] sm:h-9 sm:w-44" />
          <span className="h-8 w-24 rounded-md bg-white/10 blur-[6px] sm:h-9 sm:w-28" />
        </div>
      </div>
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
          {/* No prose here, by the owner's call: the cards carry everything
              a visitor needs to choose, and anything further belongs on the
              campaign's own page rather than being said twice. The heading
              survives for screen readers and the document outline, which is
              what an h1 is actually for. */}
          <h1 className="sr-only">Campaigns</h1>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
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
