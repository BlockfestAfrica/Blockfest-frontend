import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import {
  campaignBySlug,
  campaignRun,
  CAMPAIGN_PLATFORMS,
  MONICA_CAMPAIGN_DAYS,
  MONICA_SLUG,
  monicaRewardPool,
  monicaRoutes,
  monicaStages,
  platformLabels,
} from "@/lib/campaigns";
import { formatNaira } from "@/lib/tickets";

/** One row of the facts panel. */
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/10 pb-5 last:border-0 last:pb-0">
      <dt className="eyebrow text-white/50">{label}</dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}

/**
 * The pitch, and the facts, side by side.
 *
 * These are two different reading jobs and they were fighting when stacked in
 * one column. The prose wants to be read in order; the facts want to be
 * scanned in any order and compared against whatever else a creator is
 * considering. So the argument runs down the left at a readable measure, and
 * the things somebody decides on sit in a panel to the right where each is
 * labelled and none is buried in a sentence.
 *
 * Every figure is read from lib/campaigns.ts. The prize total is derived from
 * the prize breakdown, so it cannot drift from the rules page, and the run is
 * formatted by the same helper the index uses.
 */
export function MonicaHero() {
  const campaign = campaignBySlug(MONICA_SLUG);
  if (!campaign) return null;
  const run = campaignRun(campaign);

  return (
    <section className="section-y bg-ground">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="lg:col-span-7">
            <p className="eyebrow text-white/60">
              Presented by Blockfest Africa
            </p>

            {/* Not .text-display, which tops out at 6.5rem and is built for
                one short word like "CAMPAIGNS". At twenty-three characters this
                title took four lines there and left the panel beside it
                stranded. This tops out at 4rem, which sets it in two. */}
            <h1 className="mt-5 text-[clamp(2.25rem,5.2vw,4rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">
              {campaign.name}
            </h1>
            <p className="mt-4 text-2xl font-bold uppercase text-brand-gold sm:text-3xl">
              {campaign.hook}
            </p>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
              Monica has a story to tell. About money, about payments, about
              moving value across borders. We are not telling it for you. We are
              handing it to the creators, because knowing the story is not the
              point. Telling it well is.
            </p>

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

          <div className="lg:col-span-5">
            <dl className="flex flex-col gap-5 rounded-2xl border border-white/20 bg-white/5 p-6 sm:p-8">
              <Fact label="Total reward pool">
                <p className="text-display-sm font-bold tabular-nums leading-none text-white">
                  {formatNaira(monicaRewardPool)}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  Weekly prizes plus a final leaderboard.
                </p>
              </Fact>

              {run && (
                <Fact label="Runs">
                  <p className="text-base font-semibold text-white">{run}</p>
                  <p className="mt-1 text-sm text-white/60">
                    {MONICA_CAMPAIGN_DAYS} days, {monicaStages.length} stages.
                  </p>
                </Fact>
              )}

              <Fact label="Publish on">
                <ul className="flex flex-wrap gap-2">
                  {CAMPAIGN_PLATFORMS.map((platform) => (
                    <li
                      key={platform}
                      className="rounded-full border border-white/20 px-3 py-1 text-sm font-semibold text-white/80"
                    >
                      {platformLabels[platform]}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-white/60">
                  Post once, or on all three for more points.
                </p>
              </Fact>

              {campaign.sponsorLogo && (
                <Fact label="Headline sponsor">
                  {/* On a white chip, as the partner sections do it. These are
                      dark wordmarks and they vanish against the ground. */}
                  <span className="inline-flex items-center rounded-md bg-white px-3 py-2">
                    <Image
                      src={campaign.sponsorLogo}
                      alt={campaign.sponsor}
                      width={130}
                      height={30}
                      className="h-5 w-auto object-contain"
                      priority
                    />
                  </span>
                </Fact>
              )}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
