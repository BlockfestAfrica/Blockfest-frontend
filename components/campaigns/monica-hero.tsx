import Link from "next/link";
import Image from "next/image";
import { CampaignJoinCTA } from "./campaign-join-cta";
import {
  campaignBySlug,
  campaignOpensLabel,
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
import { TimeLeftLabel } from "./time-left-label";
import { formatTimeLeft } from "@/lib/countdown";
import { buttonClass } from "@/components/shared/panel";

/** One row of the facts panel. */
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="eyebrow text-ink-4">{label}</dt>
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
  const opens = campaignOpensLabel(campaign);

  return (
    <section className="section-y bg-ground">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-16">
          <div className="lg:col-span-7">
            <p className="eyebrow text-ink-3">
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

            {/* One wrapping row of actions. As underlined text links these
                stacked one per line on a phone, three loose blue lines under
                the button; as buttons they share the CTA's shape and wrap
                side by side. */}
            <div className="mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
              {campaign.startsAt && opens && (
                <CampaignJoinCTA
                  href={monicaRoutes.register}
                  opensAt={campaign.startsAt}
                  opensLabel={opens}
                />
              )}
              <Link href={monicaRoutes.rules} className={buttonClass("secondary")}>
                Read the rules first
              </Link>
              <Link
                href={monicaRoutes.leaderboard}
                className={buttonClass("secondary")}
              >
                Leaderboard
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <dl className="flex flex-col gap-7 rounded-2xl border border-line-2 bg-card-2 p-6 sm:p-8">
              <Fact label="Total reward pool">
                <p className="text-display-sm font-bold tabular-nums leading-none text-white">
                  {formatNaira(monicaRewardPool)}
                </p>
                <p className="mt-2 text-sm text-ink-3">
                  Weekly prizes plus a final leaderboard.
                </p>
              </Fact>

              {campaign.endsAt && (
                <Fact label="Time left">
                  <p className="text-2xl font-bold tabular-nums leading-none text-white">
                    <TimeLeftLabel
                      endsAt={campaign.endsAt}
                      initial={formatTimeLeft(campaign.endsAt)}
                    />
                  </p>
                  <p className="mt-2 text-sm text-ink-3">
                    {run}. {MONICA_CAMPAIGN_DAYS} days,{" "}
                    {monicaStages.length} stages.
                  </p>
                </Fact>
              )}

              <Fact label="Publish on">
                <ul className="flex flex-wrap gap-2">
                  {CAMPAIGN_PLATFORMS.map((platform) => (
                    <li
                      key={platform}
                      className="rounded-full border border-line-2 px-3 py-1 text-sm font-semibold text-ink-2"
                    >
                      {platformLabels[platform]}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-ink-3">
                  Post on one, two or all three platforms. More platforms,
                  more points.
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
