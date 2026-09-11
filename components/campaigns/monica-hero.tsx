import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import {
  campaignBySlug,
  monicaRoutes,
  MONICA_SLUG,
  monicaRewardPool,
} from "@/lib/campaigns";
import { formatNaira } from "@/lib/tickets";

/**
 * The pitch, in the order a creator decides in.
 *
 * What it is, what is in it for them, and how to start. The prize figure is
 * the loudest thing on the page because it is the reason anyone reads the rest,
 * and it is derived from the prize breakdown rather than typed, so it cannot
 * drift from the number the rules page states.
 */
export function MonicaHero() {
  const campaign = campaignBySlug(MONICA_SLUG);
  if (!campaign) return null;

  return (
    <section className="section-y bg-ground">
      <div className="container-page">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="eyebrow text-white/60">Presented by Blockfest Africa</p>
          {campaign.sponsorLogo && (
            <span className="flex items-center gap-2 text-xs text-white/60">
              <span className="text-white/20" aria-hidden="true">
                /
              </span>
              Headline sponsor
              <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5">
                <Image
                  src={campaign.sponsorLogo}
                  alt={campaign.sponsor}
                  width={110}
                  height={26}
                  className="h-4 w-auto object-contain"
                />
              </span>
            </span>
          )}
        </div>

        <h1 className="text-display mt-6 font-bold uppercase text-white">
          {campaign.name}
        </h1>
        <p className="mt-4 text-2xl font-bold uppercase text-brand-gold sm:text-3xl">
          {campaign.hook}
        </p>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
          Monica has a story to tell. About money, about payments, about moving
          value across borders. We are not telling it for you. We are handing it
          to the creators, because knowing the story is not the point. Telling
          it well is.
        </p>

        <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
          <div>
            <p className="eyebrow text-white/60">Total reward pool</p>
            <p className="text-display-sm mt-1 font-bold tabular-nums text-white">
              {formatNaira(monicaRewardPool)}
            </p>
          </div>
          <div
            className="hidden h-12 w-px bg-white/15 sm:block"
            aria-hidden="true"
          />
          <div>
            <p className="eyebrow text-white/60">30 days</p>
            <p className="mt-1 text-base text-white/80">
              Four stages, weekly prizes, one final leaderboard.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href={monicaRoutes.register}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-8 text-base font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover"
          >
            Join the challenge
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={monicaRoutes.rules}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4 hover:text-white"
          >
            Read the rules first
          </Link>
        </div>
      </div>
    </section>
  );
}
